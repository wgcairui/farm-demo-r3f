import { useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl'
import { StatusBar } from 'expo-status-bar'
import * as THREE from 'three'
import { CROPS, stageOf } from '@farm/game'

// ---- three r185 on expo-gl 的环境补丁（RN 无 DOM、EXGL API 面不全）----
// 踩坑记录见 README「expo-gl × three」一节。要点：
// - gl 实例自身只有几个属性，GL 方法/常量全集挂在全局 WebGLRenderingContext.prototype
//   上，但 gl 的原型链并不过它（instanceof 是品牌式 Symbol.hasInstance 的结果），
//   所以 getParameter/VERSION 等直接 undefined —— 需要把方法/常量拷为实例 own property。
// - three r163+ 见 `context instanceof WebGLRenderingContext` 就按 WebGL1 拒绝，
//   故运行时把全局类换成哑类使检查落空（three 的 capabilities 已硬编码 isWebGL2=true）。
// - WebGLRenderer 构造会 createCanvasElement()（摸 document），setSize 写 canvas.style，
//   RN 无 DOM，需最小 canvas/document shim。

const fakeCanvas = {
  style: {},
  addEventListener: () => {},
  removeEventListener: () => {},
  width: 0,
  height: 0,
} as unknown as HTMLCanvasElement
if (typeof (globalThis as Record<string, unknown>).document === 'undefined') {
  ;(globalThis as Record<string, unknown>).document = { createElementNS: () => fakeCanvas }
}

/** 把真类 prototype 上的 GL 方法/常量拷为 gl 实例 own property（方法绑 this）。
 *  注意：gl 是 JSI HostObject，`in`/has 恒为 true 不可用作存在性判断，
 *  必须用 typeof 真读（读取未知属性可能抛异常，视为缺失）。 */
function graftGLBindings(gl: ExpoWebGLRenderingContext, proto: Record<string, unknown> | undefined): void {
  if (!proto) throw new Error('WebGLRenderingContext.prototype 不存在，expo-gl 版本异常')
  const glTarget = gl as unknown as Record<string, unknown>
  let copied = 0
  let present = 0
  for (const k of Object.getOwnPropertyNames(proto)) {
    if (k === 'constructor') continue
    let existing: unknown
    try {
      existing = glTarget[k]
    } catch {
      existing = undefined
    }
    if (existing !== undefined) {
      present++
      continue
    }
    const d = Object.getOwnPropertyDescriptor(proto, k)
    if (!d) continue
    try {
      if (typeof d.get === 'function') {
        const get = d.get
        Object.defineProperty(gl, k, { get: () => get.call(gl), configurable: true })
      } else if (typeof d.value === 'function') {
        const fn = d.value as (...a: unknown[]) => unknown
        Object.defineProperty(gl, k, { value: fn.bind(gl), configurable: true })
      } else {
        Object.defineProperty(gl, k, { value: d.value, configurable: true })
      }
      copied++
    } catch {
      // 个别只读属性拷不上不致命，three 用到的核心方法都在
    }
  }
  console.log(`[gl] graftGLBindings: copied ${copied}, native-present ${present}`)
}

/** EXGL 缺的查询函数按语义兜底（拷贝后仍缺的）。 */
function shimMissingQueries(gl: ExpoWebGLRenderingContext): void {
  const glAny = gl as unknown as Record<string, unknown>
  if (typeof glAny.getExtension !== 'function') glAny.getExtension = () => null
  if (typeof glAny.getSupportedExtensions !== 'function') glAny.getSupportedExtensions = () => []
  if (typeof glAny.getShaderPrecisionFormat !== 'function') {
    glAny.getShaderPrecisionFormat = () => ({ rangeMin: 127, rangeMax: 127, precision: 23 })
  }
  if (typeof glAny.getContextAttributes !== 'function') {
    glAny.getContextAttributes = () => ({ alpha: false, antialias: true, depth: true, stencil: false })
  }
}

const FRAME_MS = 1000 / 60
// 模拟器 GLES→Metal 转译层片元着色极慢（全屏 Lambert ~6fps）。渲染缓冲按视图
// 点尺寸 × 屏幕 scale 建，视图减半 → 像素 1/4 → ~22fps，够 Phase 0/1 逻辑联调。
// 真机跑原生 GLES 无此瓶颈，上真机前把 SIM_DOWNSCALE 关掉恢复全屏全分辨率。
const SIM_DOWNSCALE = true

function onContextCreate(gl: ExpoWebGLRenderingContext, onReady: () => void) {
  const G = globalThis as Record<string, any>
  // 必须在任何全局替换前捕获真类（GL 方法/常量全在其 prototype 上）
  const realGLProto = G.WebGLRenderingContext?.prototype as Record<string, unknown> | undefined

  // three 的 WebGL1 检查每次构造 renderer 都会读全局类；每次 context 创建后都重设哑类
  G.WebGLRenderingContext = function WebGLRenderingContextShim() {}

  graftGLBindings(gl, realGLProto)
  shimMissingQueries(gl)
  const rawgl = gl as unknown as {
    getError: () => number
    COLOR_BUFFER_BIT: number
    clearColor: (r: number, g: number, b: number, a: number) => void
    clear: (mask: number) => void
  }

  const renderer = new THREE.WebGLRenderer({
    canvas: fakeCanvas,
    context: gl as unknown as WebGLRenderingContext,
    antialias: true,
  })
  renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87ceeb)
  const camera = new THREE.PerspectiveCamera(
    70,
    gl.drawingBufferWidth / gl.drawingBufferHeight,
    0.01,
    100,
  )
  camera.position.set(0, 1.2, 3)
  camera.lookAt(0, 0, 0)

  // 低多边形风格用 Lambert（Standard/PBR 在模拟器 GLES 转译层上每帧 500ms+，Lambert ~10x 便宜）
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0x2a4d3a }),
  )
  scene.add(cube)
  const light = new THREE.DirectionalLight(0xffffff, 2)
  light.position.set(2, 3, 4)
  scene.add(light)
  scene.add(new THREE.AmbientLight(0xffffff, 0.6))

  // 渲染循环：自调度 setTimeout + 每帧 getError() 背压屏障。
  // EXGL 命令队列无背压：JS 提交快于 GL 线程消费时 backlog 无界增长，
  // blit/present 排在队尾永不上屏（黑屏）。getError 是阻塞批，等 GL 线程
  // 排空后在途帧恒 ≤2，屏障耗时即单帧真实 GL 成本；再按 60fps 目标补足延时。
  let frames = 0
  let lastLogAt = Date.now()
  const tick = () => {
    const t0 = Date.now()
    cube.rotation.x += 0.01
    cube.rotation.y += 0.013
    renderer.render(scene, camera)
    gl.endFrameEXP()
    const err = rawgl.getError()
    if (err !== 0) console.log('[gl] getError =', err)
    frames++
    const now = Date.now()
    if (now - lastLogAt >= 5000) {
      const fps = (frames * 1000) / (now - lastLogAt)
      console.log(`[gl] ~${fps.toFixed(0)} fps (frame ${frames})`)
      lastLogAt = now
      frames = 0
    }
    setTimeout(tick, Math.max(0, FRAME_MS - (Date.now() - t0)))
  }
  tick()
  onReady()
}

export default function App() {
  const [glReady, setGlReady] = useState(false)
  const smoked = useRef(false)

  if (!smoked.current) {
    smoked.current = true
    // Phase 0 验收：@farm/game 在 RN 端可 import 且逻辑正确（控制台可见）
    const stage = stageOf({ crop: null, plantedAt: null }, Date.now())
    console.log(`[smoke] @farm/game stageOf(empty) = ${stage} | crops = ${Object.keys(CROPS).join(',')}`)
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <GLView
        style={SIM_DOWNSCALE ? styles.glScaled : styles.gl}
        msaaSamples={1}
        onContextCreate={(gl) => {
          try {
            onContextCreate(gl, () => setGlReady(true))
          } catch (e) {
            console.log('[gl] onContextCreate failed:', (e as Error).message)
            throw e
          }
        }}
      />
      <Text style={styles.badge}>{glReady ? 'expo-gl ✓ three ✓' : 'starting GL…'}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  glScaled: { width: '50%', height: '50%', alignSelf: 'center' },
  gl: { flex: 1 },
  badge: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
})
