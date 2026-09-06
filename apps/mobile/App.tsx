import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl'
import { StatusBar } from 'expo-status-bar'
import * as THREE from 'three'
import { CROPS, stageOf } from '@farm/game'

// ---- three r185 on expo-gl（SDK 57 / expo-gl 57.0.2）环境适配 ----
// 以下机制已对照 node_modules/expo-gl 57.0.2 源码校准（EXWebGLRenderer.cpp / EXWebGLMethods.def），
// 完整踩坑记录见 README「expo-gl × three」一节：
// - gl 实例自带完整 GL 原型链：expo-gl 的 WebGL2 stub 原型非规范地继承 WebGL1 原型
//   （全部 698 个方法/常量在链上），无需任何手工嫁接。曾误判为"JSI HostObject 链断裂
//   需拷贝"，运行日志 copied 0 与源码审计双双证伪，相关死代码已删。
// - 唯一必须的 hack：three r163+ 见 `context instanceof WebGLRenderingContext` 即按
//   WebGL1 拒载，而上述继承恰好让 EXGL 上下文 instanceof 为 true → 首次创建 context
//   时把全局类换成哑类使检查落空；一次性替换，后续 context 不再命中真类。
// - WebGLRenderer 构造会 createCanvasElement()（摸 document），setSize 写 canvas.style，
//   RN 无 DOM，需最小 canvas/document shim。
// - 渲染循环：自调度 setTimeout 链 + 每帧 getError() 背压屏障（EXGL 队列无背压，
//   JS 超前提交会永久黑屏；rAF 在 JS 阻塞后会突发补发，二次打爆队列）。

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

// three 的 WebGL1 检查每次构造 renderer 都读全局类；哑类替换做一次即永久生效。
// 放在首次 context 创建时（而非模块顶层）执行：expo-gl 的全局 stub 在其模块初始化
// 阶段才安装，顶层执行时真类可能尚未就位。
let webgl1BypassDone = false
function ensureWebGL1Bypass(): void {
  if (webgl1BypassDone) return
  const G = globalThis as Record<string, unknown>
  if (typeof G.WebGLRenderingContext === 'function') {
    G.WebGLRenderingContext = function WebGLRenderingContextDummy() {}
  }
  webgl1BypassDone = true
}

const FRAME_MS = 1000 / 60
// 模拟器 GLES→Metal 转译层片元着色极慢（全屏 Lambert ~6fps）。渲染缓冲按视图
// 点尺寸 × 屏幕 scale 建，视图减半 → 像素 1/4 → ~22fps，够 Phase 0/1 逻辑联调。
// 真机跑原生 GLES 无此瓶颈，上真机前把 SIM_DOWNSCALE 关掉恢复全屏全分辨率。
const SIM_DOWNSCALE = true

interface RawGL {
  getError: () => number
  COLOR_BUFFER_BIT: number
  clearColor: (r: number, g: number, b: number, a: number) => void
  clear: (mask: number) => void
}

export default function App() {
  const [glReady, setGlReady] = useState(false)
  const smoked = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aliveRef = useRef(false)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)

  const stopLoop = () => {
    aliveRef.current = false
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  // 卸载兜底：停循环 + 释放 GL 资源。GLView 无 onContextDestroy 回调，
  // context 被原生侧销毁的场景由 tick 的 try/catch 兜住（异常即停表）。
  useEffect(
    () => () => {
      stopLoop()
      rendererRef.current?.dispose()
      rendererRef.current = null
    },
    [],
  )

  const handleContextCreate = (gl: ExpoWebGLRenderingContext) => {
    try {
      // 重入安全：新 context 建立前先停掉旧循环、释放旧 renderer
      stopLoop()
      rendererRef.current?.dispose()
      ensureWebGL1Bypass()
      aliveRef.current = true

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
      const rawgl = gl as unknown as RawGL
      let frames = 0
      let lastLogAt = Date.now()
      const tick = () => {
        if (!aliveRef.current) return
        const t0 = Date.now()
        try {
          cube.rotation.x += 0.01
          cube.rotation.y += 0.013
          renderer.render(scene, camera)
          gl.endFrameEXP()
          const err = rawgl.getError()
          if (err !== 0) console.log('[gl] getError =', err)
        } catch (e) {
          // context 被原生侧销毁（GLView 卸载）等：停表，不再排下一帧
          console.log('[gl] loop stopped:', (e as Error).message)
          aliveRef.current = false
          return
        }
        frames++
        const now = Date.now()
        if (now - lastLogAt >= 5000) {
          const fps = (frames * 1000) / (now - lastLogAt)
          console.log(`[gl] ~${fps.toFixed(0)} fps (frame ${frames})`)
          lastLogAt = now
          frames = 0
        }
        timerRef.current = setTimeout(tick, Math.max(0, FRAME_MS - (Date.now() - t0)))
      }
      tick()
      rendererRef.current = renderer
      setGlReady(true)
      console.log('[gl] context ready — GL 链完整，无需嫁接（expo-gl 57.0.2 实测）')
    } catch (e) {
      aliveRef.current = false
      console.log('[gl] onContextCreate failed:', (e as Error).message)
      throw e
    }
  }

  if (!smoked.current) {
    smoked.current = true
    // Phase 0 验收：@farm/game 在 RN 端可 import 且逻辑正确（控制台可见）
    const stage = stageOf({ crop: null, plantedAt: null }, Date.now())
    console.log(`[smoke] @farm/game stageOf(empty) = ${stage} | crops = ${Object.keys(CROPS).join(',')}`)
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <GLView style={SIM_DOWNSCALE ? styles.glScaled : styles.gl} msaaSamples={1} onContextCreate={handleContextCreate} />
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
