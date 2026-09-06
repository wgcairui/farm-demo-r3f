import { memo, Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type {
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  MeshBasicMaterial,
} from 'three'
import { Color, Mesh, Object3D, Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CROPS, progressOf, type CropId, type PlotState, type SaveData } from '@farm/game'
import { ASSETS } from './assets'
import { isClick } from './clickGuard'
import {
  getActive,
  getBonus,
  getFx,
  getPlotStateRecoveryMs,
  isDrought,
  isRain,
  isThirsty,
  PEST_TTL_MS,
  tickEvents,
  tickPlotStates,
} from './events'
import {
  consumeShake,
  getLeafs,
  getPops,
  getCoins,
  getShockwaves,
  LEAF_MS,
  MAX_COINS,
  removePop,
  SHOCKWAVE_MS,
  spawnHarvestPop,
  spawnLeafBurst,
  spawnShockwave,
  triggerShake,
  updateCoins,
} from './effects'
import { DecoLayer } from './deco'
import { mountFloaterDom, queueFloater, takeFloaters } from './floaters'
import { normalized, useGLTF } from './gltf'
import { PLOT_COLS, PLOT_ROWS, plotPosition } from './layout'
import { DUR, ease } from './motion'
import { PLOT_STATE_TINT } from './landState'

export interface FarmSceneProps {
  data: SaveData
  onPlot: (i: number) => void
  onPest: () => void
  /** D7：withered 自动恢复推动，每次 tickPlotStates 产生新数组时回调 */
  onTickPlots: (plots: SaveData['plots']) => void
}

// D3 环绕相机。边界 clamp：距离 3.2~14、极角 0.3~1.25 rad（不钻地、不翻顶）、禁平移。
// 在 useEffect 里创建（StrictMode 双挂载安全），damping 需要每帧 update。
function CameraRig() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const controlsRef = useRef<OrbitControls | null>(null)

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement)
    controls.target.set(0, 0.25, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.minDistance = 3.2
    controls.maxDistance = 14
    controls.minPolarAngle = 0.3
    controls.maxPolarAngle = 1.25
    controls.update()
    controlsRef.current = controls
    return () => {
      controls.dispose()
      controlsRef.current = null
    }
  }, [camera, gl])

  useFrame(() => controlsRef.current?.update())

  return null
}

// 光照随天气过渡：雨调暗、旱调亮（lerp 慢过渡，避免瞬跳）
const Lights = memo(function Lights() {
  const dir = useRef<DirectionalLight>(null)
  const hemi = useRef<HemisphereLight>(null)

  useFrame((_, dt) => {
    const dTarget = isRain() ? 1.5 : isDrought() ? 2.7 : 2.4
    const hTarget = isRain() ? 0.85 : isDrought() ? 1.25 : 1.1
    // 帧率无关阻尼 1-e^(-k·dt)（k=6，dt 钳 0.1s）：60/120Hz 过渡速度一致，替代裸 lerp 系数
    const k = 1 - Math.exp(-6 * Math.min(dt, 0.1))
    if (dir.current) dir.current.intensity += (dTarget - dir.current.intensity) * k
    if (hemi.current) hemi.current.intensity += (hTarget - hemi.current.intensity) * k
  })

  return (
    <>
      <hemisphereLight ref={hemi} args={[0xbfe8ff, 0x9c7a4f, 1.1]} />
      <directionalLight
        ref={dir}
        position={[5, 8, 4]}
        intensity={2.4}
        color={0xfff3dd}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={25}
        shadow-bias={-0.0004}
      />
    </>
  )
})

const Ground = memo(function Ground() {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <meshLambertMaterial color={0x72b356} />
    </mesh>
  )
})

// 天气氛围：天空/雾色向目标色缓慢靠拢（<color attach> 的实例就在 scene.background 上）
const SKY = new Color(0x87ceeb)
const SKY_RAIN = new Color(0x9fb4c4)
const SKY_DROUGHT = new Color(0xe0c98d)

function WeatherMood() {
  const scene = useThree((s) => s.scene)
  useFrame((_, dt) => {
    const target = isRain() ? SKY_RAIN : isDrought() ? SKY_DROUGHT : SKY
    // 同 Lights：帧率无关阻尼（k=5），天空过渡速度不随刷新率变化
    const k = 1 - Math.exp(-5 * Math.min(dt, 0.1))
    const bg = scene.background
    if (bg instanceof Color) bg.lerp(target, k)
    const fog = scene.fog as { color: Color } | null
    if (fog) fog.color.lerp(target, k)
  })
  return null
}

interface MakeMap {
  dirt: () => Group
  carrot: () => Group
  corn: () => Group
}

interface PlotViewProps {
  index: number
  crop: CropId | null
  plantedAt: number | null
  state: PlotState
  /** 空地提示环：仅当选中种子买得起且地块为空 */
  hint: boolean
  onPlot: (i: number) => void
  make: MakeMap
}

function PlotView({ index, crop, plantedAt, state, hint, onPlot, make }: PlotViewProps) {
  const [x, z] = plotPosition(index)
  const dirt = useMemo(() => make.dirt(), [make])
  // withered 状态不显示作物模型（即使 crop 字段还有值）
  const plant = useMemo(() => (crop && state !== 'withered' ? make[crop]() : null), [crop, state, make])

  const scaleGroupRef = useRef<Group>(null)
  const hintRef = useRef<Group>(null)
  const squashAtRef = useRef<number | null>(null)
  const matureBounceAtRef = useRef<number | null>(null)
  const wasMatureRef = useRef(false)
  const stateRef = useRef<{ crop: CropId | null; plant: Group | null; state: PlotState }>({ crop, plant, state })

  // 播种/收获的边界检测：播种 → 压弹；收获 → 把旧模型交给 PopLayer 起跳消失
  useEffect(() => {
    const prev = stateRef.current
    if (prev.crop && !crop && prev.plant) spawnHarvestPop(prev.plant, x, z)
    if (!prev.crop && crop) squashAtRef.current = performance.now()
    stateRef.current = { crop, plant, state }
  }, [crop, plant, state, x])

  useFrame(() => {
    const now = performance.now()

    // 空地提示呼吸（D5）：withered 不显示提示环
    if (hintRef.current) {
      const k = Math.sin((now / 1000) * Math.PI * 1.2)
      hintRef.current.scale.setScalar(1 + 0.06 * k)
      const ring = hintRef.current.children[0] as Mesh
      ;(ring.material as MeshBasicMaterial).opacity = 0.28 + 0.18 * k
    }

    // 生长连续插值：Date.now 对齐 plantedAt 的时间基（帧级平滑，不等重渲染）；
    // 进度含事件偏移（getBonus），与进度条/收获判定同源。
    // withered 状态 base 固定 0.85（略缩，凹下感），不用 progressOf。
    let base = 0.08
    if (state === 'withered') {
      base = 0.85
      wasMatureRef.current = false
    } else if (crop && plantedAt !== null) {
      const t = ease.clamp01(progressOf({ crop, plantedAt: plantedAt - getBonus(index), state, witheredAt: null }, Date.now()))
      // 成熟瞬间的一次弹跳（D5：可收获信号）
      if (t >= 1 && !wasMatureRef.current) matureBounceAtRef.current = now
      wasMatureRef.current = t >= 1
      base = 0.08 + 0.92 * ease.outCubic(t)
    } else {
      wasMatureRef.current = false
    }

    // 播种压弹（DUR.base）
    let squash = 1
    if (squashAtRef.current !== null) {
      const t = (now - squashAtRef.current) / DUR.base
      if (t >= 1) squashAtRef.current = null
      else squash = 1 - 0.45 * ease.sinPing(t)
    }

    // 成熟弹跳（DUR.base）
    let bounce = 1
    if (matureBounceAtRef.current !== null) {
      const t = (now - matureBounceAtRef.current) / DUR.base
      if (t >= 1) matureBounceAtRef.current = null
      else bounce = 1 + 0.22 * ease.sinPing(t)
    }

    const g = scaleGroupRef.current
    if (g) g.scale.setScalar(base * squash * bounce)

    // D7：按 state 驱动 dirt 材质颜色（metalness=0 前提，flat tone mapping）
    if (dirtRef.current) {
      dirtRef.current.traverse((o) => {
        if (o instanceof Mesh) {
          const mat = o.material as MeshBasicMaterial | import('three').MeshLambertMaterial
          if ('color' in mat && mat) mat.color.setHex(PLOT_STATE_TINT[state])
        }
      })
    }
  })

  // D7：dirt 对象 ref（用于 useFrame 内颜色驱动）
  const dirtRef = useRef<Group>(null)

  return (
    <group
      position={[x, 0.02, z]}
      onClick={(e) => {
        e.stopPropagation()
        if (isClick(e.nativeEvent)) onPlot(index)
      }}
      onPointerOver={() => {
        ;(window as unknown as { __hoverPlot?: number }).__hoverPlot = index
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        ;(window as unknown as { __hoverPlot?: number | null }).__hoverPlot = null
        document.body.style.cursor = 'auto'
      }}
    >
      <primitive object={dirt} ref={dirtRef} />
      {!crop && hint && state === 'empty' && (
        <group ref={hintRef} position={[0, 0.07, 0]} rotation-x={-Math.PI / 2}>
          <mesh>
            <ringGeometry args={[0.26, 0.33, 32]} />
            <meshBasicMaterial color={0xfff2b0} transparent opacity={0.3} depthWrite={false} />
          </mesh>
        </group>
      )}
      {plant && (
        <group ref={scaleGroupRef}>
          <primitive object={plant} />
        </group>
      )}
      {/* D6：倒计时浮字（QQ 农场风格：作物头顶小字，< 1 分钟换色+图标）+ 状态环 */}
      {crop && plantedAt !== null && state !== 'withered' && (
        <CountdownFloater index={index} crop={crop} plantedAt={plantedAt} />
      )}
      <StatusRing index={index} crop={crop} state={state} />
    </group>
  )
}

function Farm({
  data,
  onPlot,
  make,
}: Pick<FarmSceneProps, 'data' | 'onPlot'> & { make: MakeMap }) {
  const afford = data.coins >= CROPS[data.selected].seedPrice
  return (
    <>
      {data.plots.map((p, i) => (
        <PlotView
          key={i}
          index={i}
          crop={p.crop}
          plantedAt={p.plantedAt}
          state={p.state}
          hint={!p.crop && afford}
          onPlot={onPlot}
          make={make}
        />
      ))}
    </>
  )
}

// —— QQ 农场风格倒计时浮字：作物头顶小字 billboard，靠 FloaterBridge 投影到 DOM ——
// 不用 Mesh 画文字（字太小看不清），改为：每帧根据剩余时间往 queueFloater 投递文本
// （同一帧内同地块只投一次——把浮字状态记在 ref 里，避免帧内重投造成栈炸裂）。
// 视觉风格：sprout/growing 期 `🌱 mm:ss`，成熟前 < 60s 切到 `🌾 00:XX` + 金色，
// 成熟瞬间投递 `✨ +N金币` 直接交给普通浮字通道，不在此停留。

function CountdownFloater({
  index,
  crop,
  plantedAt,
}: {
  index: number
  crop: CropId
  plantedAt: number
}) {
  const lastShownAtRef = useRef(0)
  const [x, z] = plotPosition(index)
  const y = crop === 'corn' ? 0.95 : 0.62

  useFrame(() => {
    const def = CROPS[crop]
    const total = def.stageMs[0] + def.stageMs[1]
    const remain = Math.max(0, plantedAt + total - Date.now() + getBonus(index))
    const mature = remain <= 0
    // 节流：每秒最多投递一次新浮字（mature 同样限流，否则"✨ 可收获"会按帧堆栈）
    const now = performance.now()
    if (now - lastShownAtRef.current < 1000) return
    lastShownAtRef.current = now

    let text: string
    if (mature) {
      text = '✨ 可收获'
    } else {
      const secs = Math.ceil(remain / 1000)
      const mm = Math.floor(secs / 60)
      const ss = secs % 60
      const icon = secs <= 60 ? '🌾' : '🌱'
      text = `${icon} ${mm}:${ss.toString().padStart(2, '0')}`
    }
    queueFloater(x, y, z, text)
  })

  return null
}

// —— D6 地块状态环：干旱缺水橙红脉冲 > 已浇水蓝 > 已施肥绿 > withered 深棕无脉冲 ——

function StatusRing({ index, crop, state }: { index: number; crop: CropId | null; state: PlotState }) {
  const ref = useRef<Mesh>(null)

  useFrame(() => {
    const m = ref.current
    if (!m) return
    const f = getFx(index)
    const drought = isDrought()
    let color = 0
    let opacity = 0
    let pulse = 0
    if (state === 'withered') {
      color = 0x3e2723
      opacity = 0.45
    } else if (drought && crop && isThirsty(crop) && !f?.watered) {
      color = 0xff8c42
      opacity = 0.42
      pulse = 0.2
    } else if (drought && f?.watered) {
      color = 0x5ab7ff
      opacity = 0.38
    } else if (f?.fert) {
      color = 0x7ee06a
      opacity = 0.34
    }
    m.visible = opacity > 0
    if (opacity > 0) {
      const mat = m.material as MeshBasicMaterial
      mat.color.set(color)
      mat.opacity = opacity + pulse * Math.sin((performance.now() / 1000) * Math.PI * 4.8)
    }
  })

  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position={[0, 0.055, 0]} visible={false} raycast={() => null}>
      <ringGeometry args={[0.3, 0.38, 32]} />
      <meshBasicMaterial transparent opacity={0.3} depthWrite={false} />
    </mesh>
  )
}

// —— D6 害虫：在目标作物头顶盘旋的小虫 + 红色警示环（越接近超时闪得越急）——

function PestBug({ onPest }: { onPest: () => void }) {
  const grp = useRef<Group>(null)
  const ring = useRef<Mesh>(null)

  useFrame(() => {
    const g = grp.current
    if (!g) return
    const ev = getActive()
    const on = ev?.type === 'pest'
    g.visible = on
    if (!on || !ev) return
    const [px, pz] = plotPosition(ev.plot)
    const t = performance.now() / 1000
    g.position.set(
      px + Math.cos(t * 2.1) * 0.13,
      0.32 + Math.sin(t * 6) * 0.025,
      pz + Math.sin(t * 2.1) * 0.13,
    )
    const urgency = 1 - Math.max(0, (ev.endAt - performance.now()) / PEST_TTL_MS)
    if (ring.current) {
      ;(ring.current.material as MeshBasicMaterial).opacity =
        0.3 + 0.3 * (0.5 + 0.5 * Math.sin(t * Math.PI * (3 + 7 * urgency)))
    }
  })

  return (
    <group
      ref={grp}
      visible={false}
      onClick={(e) => {
        e.stopPropagation()
        if (isClick(e.nativeEvent)) onPest()
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      <mesh scale={[1, 0.8, 1.3]}>
        <sphereGeometry args={[0.055, 12, 10]} />
        <meshLambertMaterial color={0x3a2a20} />
      </mesh>
      <mesh position={[0, 0.012, 0.055]}>
        <sphereGeometry args={[0.032, 10, 8]} />
        <meshLambertMaterial color={0x241812} />
      </mesh>
      {/* 透明放大 hitbox：虫体太小难点中，点偏落回地块会误触发施肥/收获 */}
      <mesh scale={[2.4, 2.4, 2.4]}>
        <sphereGeometry args={[0.055, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, -0.27, 0]} raycast={() => null}>
        <ringGeometry args={[0.24, 0.31, 28]} />
        <meshBasicMaterial color={0xff5252} transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  )
}

// —— D6 雨：90 条下落细柱循环回收，只有 rain 事件期间可见 ——

const RAIN_COUNT = 90

function RainParticles() {
  const ref = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const drops = useMemo(
    () =>
      Array.from({ length: RAIN_COUNT }, () => ({
        x: (Math.random() - 0.5) * 12,
        y: Math.random() * 7,
        z: (Math.random() - 0.5) * 12,
        v: 7 + Math.random() * 3,
      })),
    [],
  )

  useFrame((_, dt) => {
    const mesh = ref.current
    if (!mesh) return
    const on = isRain()
    mesh.visible = on
    if (!on) return
    const d = Math.min(dt, 0.05)
    for (let i = 0; i < RAIN_COUNT; i++) {
      const p = drops[i]
      p.y -= p.v * d
      if (p.y < 0) {
        p.y = 6.5 + Math.random()
        p.x = (Math.random() - 0.5) * 12
        p.z = (Math.random() - 0.5) * 12
      }
      dummy.position.set(p.x, p.y, p.z)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined!, undefined!, RAIN_COUNT]} frustumCulled={false} visible={false}>
      <boxGeometry args={[0.014, 0.3, 0.014]} />
      <meshBasicMaterial color={0xaed6ff} transparent opacity={0.55} />
    </instancedMesh>
  )
}

// —— D6 收获动效层（作物起跳 + 径向金光 + 叶子碎屑）——

/** 收获弹出：作物起跳 + 先胀后缩 + 自旋（DUR.slow） */
function PopLayer() {
  const groupRef = useRef<Group>(null)

  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    const now = performance.now()
    for (const p of [...getPops()]) {
      const t = (now - p.born) / DUR.slow
      if (t >= 1) {
        g.remove(p.obj)
        removePop(p)
        continue
      }
      if (!p.obj.parent) {
        p.obj.position.set(p.x, 0, p.z)
        g.add(p.obj)
      }
      const k = ease.outQuad(t)
      p.obj.position.y = 0.55 * k
      const s = t < 0.3 ? 1 + 0.5 * (t / 0.3) : 1.5 - 0.9 * ((t - 0.3) / 0.7)
      p.obj.scale.setScalar(Math.max(0.001, s))
      p.obj.rotation.y += 0.06
    }
  })

  return <group ref={groupRef} />
}

/** 径向金光：圆环从中心向外扩散 + 不透明度衰减（SHOCKWAVE_MS） */
function Shockwave() {
  const meshRef = useRef<Mesh>(null)
  const matRef = useRef<MeshBasicMaterial>(null)

  useFrame(() => {
    const m = meshRef.current
    const mat = matRef.current
    if (!m || !mat) return
    const list = getShockwaves()
    const now = performance.now()
    let visible = false
    let radius = 0.1
    let opacity = 0
    let cx = 0
    let cz = 0
    for (const s of list) {
      const t = (now - s.born) / SHOCKWAVE_MS
      if (t >= 1) continue
      const k = ease.outQuad(t)
      radius = 0.1 + 1.6 * k
      opacity = (1 - k) * 0.85
      visible = true
      cx = s.x
      cz = s.z
      break
    }
    m.visible = visible
    if (visible) {
      m.position.x = cx
      m.position.z = cz
      m.scale.setScalar(radius)
      mat.opacity = opacity
    }
    for (let i = list.length - 1; i >= 0; i--) {
      if (now - list[i].born > SHOCKWAVE_MS) list.splice(i, 1)
    }
  })

  return (
    <mesh ref={meshRef} rotation-x={-Math.PI / 2} position={[0, 0.04, 0]} visible={false} raycast={() => null}>
      <ringGeometry args={[0.28, 0.36, 48]} />
      <meshBasicMaterial
        ref={matRef}
        color={0xffe27a}
        transparent
        opacity={0}
        depthWrite={false}
        side={2 as const}
      />
    </mesh>
  )
}

/** 叶子碎屑：左右溅射的绿色小方块（带旋转 + 重力落地） */
function LeafBurst() {
  const meshRef = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])

  useFrame((_, dt) => {
    const m = meshRef.current
    if (!m) return
    const list = getLeafs()
    const now = performance.now()
    const d = Math.min(dt, 0.05)
    for (let i = list.length - 1; i >= 0; i--) {
      const l = list[i]
      l.vy -= 6.5 * d
      l.x += l.vx * d
      l.y += l.vy * d
      l.z += l.vz * d
      l.vx *= 0.97
      l.vz *= 0.97
      l.rot += l.rotSpd * d
      if (l.y < 0.02) {
        l.y = 0.02
        l.vy *= -0.3
        l.vx *= 0.6
        l.vz *= 0.6
      }
      if (now - l.born > LEAF_MS) list.splice(i, 1)
    }
    const count = Math.min(list.length, 16)
    m.count = count
    for (let i = 0; i < count; i++) {
      const l = list[i]
      dummy.position.set(l.x, l.y, l.z)
      dummy.rotation.set(l.rot * 0.6, l.rot, l.rot * 0.3)
      const age = (now - l.born) / LEAF_MS
      const sc = age < 0.7 ? 1 : Math.max(0, 1 - (age - 0.7) / 0.3)
      dummy.scale.setScalar(0.07 * sc)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined!, undefined!, 16]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshLambertMaterial color={0x6ec24a} side={2 as const} />
    </instancedMesh>
  )
}

/** 金币粒子：固定 64 实例的 InstancedMesh 池，闲置实例缩放归零；存活 slow+fast，尾部 fast 档收缩 */
const COIN_TTL = DUR.slow + DUR.fast + 50
const COIN_FADE = DUR.base

function CoinParticles() {
  const ref = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])

  useFrame((_, dt) => {
    updateCoins(Math.min(dt, 0.05), COIN_TTL)
    const mesh = ref.current
    if (!mesh) return
    const list = getCoins()
    const now = performance.now()
    for (let i = 0; i < MAX_COINS; i++) {
      const c = list[i]
      if (c) {
        dummy.position.copy(c.pos)
        dummy.rotation.set(c.tilt, c.rot, 0)
        const age = now - c.born
        dummy.scale.setScalar(age > COIN_TTL - COIN_FADE ? Math.max(0, (COIN_TTL - age) / COIN_FADE) : 1)
      } else {
        dummy.scale.setScalar(0)
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined!, undefined!, MAX_COINS]} frustumCulled={false}>
      <cylinderGeometry args={[0.055, 0.055, 0.018, 14]} />
      <meshLambertMaterial color={0xffd24a} emissive={0x7a5200} />
    </instancedMesh>
  )
}

/** 浮动文字桥：3D 锚点投影到屏幕坐标，交给 DOM 层呈现 */
function FloaterBridge() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const v = useMemo(() => new Vector3(), [])

  useFrame(() => {
    for (const f of takeFloaters()) {
      v.set(f.x, f.y, f.z).project(camera)
      if (v.z < 1) {
        mountFloaterDom(
          (v.x * 0.5 + 0.5) * size.width,
          (-v.y * 0.5 + 0.5) * size.height,
          f.text,
          f.hero === true,
        )
      }
    }
  })

  return null
}

/** D6 事件驱动器：单例状态在 events.ts，墙钟差补结算由它自己记 lastTick */
function EventsTicker({ plots }: { plots: SaveData['plots'] }) {
  useFrame(() => tickEvents(plots))
  return null
}

// —— D7 withered 恢复计时浮字 + 状态推动 ——

/** D7：withered 地块头顶浮字 "🍂 荒废中… Xs"，节流 1s */
function WitheredRecoverHint({ plots }: { plots: SaveData['plots'] }) {
  const lastShownAtRef = useRef(0)

  useFrame(() => {
    const now = performance.now()
    if (now - lastShownAtRef.current < 1000) return
    // 寻找有 withered 状态的地块
    for (let i = 0; i < plots.length; i++) {
      const p = plots[i]
      if (p.state !== 'withered') continue
      const secs = getPlotStateRecoveryMs(i, Date.now(), plots)
      if (secs <= 0) continue
      const [px, pz] = plotPosition(i)
      lastShownAtRef.current = now
      queueFloater(px, 0.62, pz, `🍂 荒废中… ${secs}s`)
      break // 每帧最多一个，避免栈炸
    }
  })
  return null
}

/**
 * D7：withered 状态自动恢复推动器。
 * 节流到每帧检查一次是否需要更新 React state（通过 onTickPlots 回调）。
 * 策略：onTickPlots 返回新数组 → setData 驱动重渲染 → FarmScene 重新接收含新 state 的 plots。
 */
function PlotStateTicker({ plots, onTickPlots }: { plots: SaveData['plots']; onTickPlots: (p: SaveData['plots']) => void }) {
  const lastCheckRef = useRef(0)

  useFrame(() => {
    const now = performance.now()
    // 节流到 1s 检查一次（tickPlot 最小粒度 8s，1s 节流足够）
    if (now - lastCheckRef.current < 1000) return
    lastCheckRef.current = now
    const next = tickPlotStates(plots, Date.now())
    if (next) onTickPlots(next)
  })
  return null
}

// —— 静态环境（memo + 实例只建一次）——

const FenceRing = memo(function FenceRing() {
  const fenceGltf = useGLTF(ASSETS.fence)

  const segs = useMemo(() => {
    const make = () => normalized(fenceGltf.scene, { width: 0.95 })
    const hx = 2.35
    const hz = 1.7
    const list: { obj: Group; x: number; z: number; rotY: number }[] = []
    for (let i = 0; i < 5; i++) {
      const x = -hx + (2 * hx * (i + 0.5)) / 5
      list.push({ obj: make(), x, z: -hz, rotY: 0 }, { obj: make(), x, z: hz, rotY: 0 })
    }
    for (let i = 0; i < 4; i++) {
      // 左侧 i=1 段（z≈-0.43）跳过：留出菜园入口给石板路穿过，正对 cottage
      if (i === 1) continue
      const z = -hz + (2 * hz * (i + 0.5)) / 4
      list.push({ obj: make(), x: -hx, z, rotY: Math.PI / 2 }, { obj: make(), x: hx, z, rotY: Math.PI / 2 })
    }
    return list
  }, [fenceGltf])

  return (
    <>
      {segs.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]} rotation-y={s.rotY}>
          <primitive object={s.obj} />
        </group>
      ))}
    </>
  )
})

// trees.glb 是 5 棵树的合集，按节点名拆选单棵使用（ASSETS.md 有注）
// D12 audit fix：NormalTree_1 @ (-0.3, -3.6) 与搬过来的仓库 (-1.5, -2.5) 距离仅 1.3m
// 会穿模；挪到 (1.0, -3.6) 镜像到 +x 后方空地。
const TREES = [
  { name: 'NormalTree_1', height: 1.7, pos: [-3.4, -2.7], rotY: 0.3 },
  { name: 'NormalTree_3', height: 2.2, pos: [3.6, -3.0], rotY: -1.2 },
  { name: 'NormalTree_2', height: 1.9, pos: [4.4, 0.2], rotY: 2.1 },
  { name: 'NormalTree_4', height: 1.5, pos: [-4.3, 1.4], rotY: 1.1 },
  { name: 'NormalTree_1', height: 1.3, pos: [1.0, -3.6], rotY: 0.9 },
] as const

const Trees = memo(function Trees() {
  const treesGltf = useGLTF(ASSETS.trees)

  const models = useMemo(
    () =>
      TREES.map((t) => ({
        obj: normalized(treesGltf.scene.getObjectByName(t.name)!, { height: t.height }),
        pos: t.pos,
        rotY: t.rotY,
      })),
    [treesGltf],
  )

  return (
    <>
      {models.map((m, i) => (
        <group key={i} position={[m.pos[0], 0, m.pos[1]]} rotation-y={m.rotY}>
          <primitive object={m.obj} />
        </group>
      ))}
    </>
  )
})

export default function FarmScene({ data, onPlot, onPest, onTickPlots }: FarmSceneProps) {
  const dirtGltf = useGLTF(ASSETS.dirt)
  const carrotGltf = useGLTF(ASSETS.carrot)
  const cornGltf = useGLTF(ASSETS.corn)

  const make = useMemo<MakeMap>(
    () => ({
      dirt: () => normalized(dirtGltf.scene, { width: 1.02 }),
      carrot: () => normalized(carrotGltf.scene, { height: 0.46 }),
      corn: () => normalized(cornGltf.scene, { height: 0.78 }),
    }),
    [dirtGltf, carrotGltf, cornGltf],
  )

  return (
    <>
      <color attach="background" args={[0x87ceeb]} />
      <fog attach="fog" args={[0x87ceeb, 14, 34]} />
      <CameraRig />
      <Lights />
      <Suspense fallback={null}>
        <Ground />
        <Farm data={data} onPlot={onPlot} make={make} />
        <FenceRing />
        <Trees />
        <DecoLayer />
        <PestBug onPest={onPest} />
        <RainParticles />
        <PopLayer />
        <Shockwave />
        <LeafBurst />
        <CoinParticles />
        <FloaterBridge />
        <WeatherMood />
        <EventsTicker plots={data.plots} />
        <WitheredRecoverHint plots={data.plots} />
        <PlotStateTicker plots={data.plots} onTickPlots={onTickPlots} />
      </Suspense>
    </>
  )
}
