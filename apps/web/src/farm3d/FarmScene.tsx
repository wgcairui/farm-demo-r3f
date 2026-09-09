import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type {
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from 'three'
import { Color, Mesh, Object3D, PlaneGeometry, Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CROPS, progressOf, type CropId, type PlotState, type SaveData } from '@farm/game'
import { ASSETS } from './assets'
import { isClick, trackPointerDown } from './clickGuard'
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
import { getTodayForecast, type WeatherKind } from './forecast'
import { getNow } from './time'
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
import DecorationItem from './deco/Decorations'
import Tree from './deco/Tree'
import { getDecorations, subscribeDecorations, type Decoration } from './decorations'
import { mountFloaterDom, queueFloater, takeFloaters } from './floaters'
import { normalized, useGLTF } from './gltf'
import { PLOT_COLS, PLOT_ROWS, plotPosition } from './layout'
import { CAMERA, DAY_NIGHT, DUR, ease } from '@farm/game-ui'
import { readHarvestCamera, resetHarvestCamera, getCameraSequence } from './cameraMotion'
import { PLOT_STATE_TINT } from '@farm/game-ui'
import { toon, toonGradient } from './toon'
import { subscribeTutorial, type TutorialState } from './tutorial'
import TutorialArrow from './TutorialArrow'

export interface FarmSceneProps {
  data: SaveData
  onPlot: (i: number) => void
  onPest: () => void
  /** D7：withered 自动恢复推动，每次 tickPlotStates 产生新数组时回调 */
  onTickPlots: (plots: SaveData['plots']) => void
  /** P2-2：当前地块组索引，0=原 6 块，1=新 6 块 */
  currentGroupIdx?: number
}

// D3 环绕相机。边界 clamp：距离 3.2~14、极角 0.3~1.25 rad（不钻地、不翻顶）、禁平移。
// 在 useEffect 里创建（StrictMode 双挂载安全），damping 需要每帧 update。
function CameraRig() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const controlsRef = useRef<OrbitControls | null>(null)
  // P1-3 相机动效：保存初始视角（reset 的标准态）和当前运行中动画的快照
  const introStartRef = useRef<number | null>(null)
  const introFromRef = useRef<Vector3 | null>(null)
  const introToRef = useRef<Vector3 | null>(null)
  const harvestAnimRef = useRef<{
    fromPos: Vector3
    fromTarget: Vector3
    toTarget: Vector3
    /** 本轮会话首次进入收获动画时的「用户原始视角」快照，连续收获时保持不变 */
    restPos: Vector3
    restTarget: Vector3
    startAt: number
    duration: number
  } | null>(null)
  const lastHarvestSeqRef = useRef(0)
  const tmpVec = useMemo(() => new Vector3(), [])

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement)
    controls.target.set(0, 0.25, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.minDistance = 4.2
    controls.maxDistance = 12
    controls.minPolarAngle = 0.35
    controls.maxPolarAngle = 1.2
    // P1-3：保存 Canvas camera prop 注入的「默认机位」作为开场运镜的终点
    // 同时作为 R 键 reset 的标准态（用 controls.saveState 保存）。
    // 注意：camera.position 此时已经等于 props 中的默认值。
    // 严格模式双挂载下，第二次挂载会读到上一轮被改成 introFrom 的 camera.position，
    // 因此直接使用 userData._defaultPos 兜底：如果已经被记录过，就用之前的默认机位
    const prior = camera.userData._defaultPos as Vector3 | undefined
    const defaultPos = prior ? prior.clone() : camera.position.clone()
    camera.userData._defaultPos = defaultPos
    introToRef.current = defaultPos
    // 同步 sequence，避免重放过期事件（StrictMode unmount 会 reset）
    lastHarvestSeqRef.current = getCameraSequence()
    // P1-3 开场运镜：从更远更高的机位滑入默认视角
    // 移动优先（iPhone 15）：起点 *1.22 比桌面 *1.18 飞入感更强
    const introFrom = new Vector3(defaultPos.x * 1.22, defaultPos.y * 1.22, defaultPos.z * 1.22)
    camera.position.copy(introFrom)
    introFromRef.current = introFrom
    introStartRef.current = performance.now()
    // 开场期间禁止用户操作 OrbitControls，防止运镜途中被拖拽打断
    controls.enabled = false
    controlsRef.current = controls
    // D12 第三轮：监听 R 键 reset 到 saveState 记录的初始视角。
    // 之前拖动相机后没出口恢复，用户只能刷新页面——D12 后仓库挪到 (-1.5, -3.0)
    // 后默认视角被部分遮挡（用户反馈），提供 R 键重置是低成本修复。
    // P1-3：reset 同时取消当前收获聚焦动画与开场运镜，恢复用户对 OrbitControls 的控制权
    // 并通知 App 关闭右下角教程提示（用户已发现 R 键）
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        harvestAnimRef.current = null
        introStartRef.current = null
        introFromRef.current = null
        introToRef.current = null
        controls.reset()
        controls.enabled = true
        window.dispatchEvent(new CustomEvent('farm:hint-dismiss'))
      }
    }
    window.addEventListener('keydown', onKey)
    // clickGuard 锚点必须在 canvas DOM 元素上：PlotView onClick 给的 e.nativeEvent
    // 也是这个 DOM 上的 pointerup，clientX/clientY 同坐标空间。D12 回归 bug：
    // 之前挂在 Canvas props（外层 div）时 React onPointerDown 在 R3F 接管事件源后
    // 偶发未触发，downX/downY 留为 0，所有点击 distance>8px 误判为拖拽。
    gl.domElement.addEventListener('pointerdown', trackPointerDown)
    return () => {
      controls.dispose()
      controlsRef.current = null
      window.removeEventListener('keydown', onKey)
      gl.domElement.removeEventListener('pointerdown', trackPointerDown)
      // StrictMode 双挂载：把 camera 还原到默认机位，避免再次挂载时累乘 1.18
      // 同步清空事件单例，避免 stale 收获事件被下一轮 useFrame 重放
      const restore = camera.userData._defaultPos as Vector3 | undefined
      if (restore) camera.position.copy(restore)
      introStartRef.current = null
      introFromRef.current = null
      introToRef.current = null
      harvestAnimRef.current = null
      resetHarvestCamera()
    }
  }, [camera, gl])

  useFrame(() => {
    const controls = controlsRef.current
    if (!controls) return
    const now = performance.now()

    // 开场运镜：从 introFrom 沿轨道插值到默认位置，期间禁用 OrbitControls
    if (introStartRef.current !== null && introFromRef.current && introToRef.current) {
      const elapsed = now - introStartRef.current
      const t = ease.clamp01(elapsed / CAMERA.introMs)
      const k = ease.outCubic(t)
      camera.position.lerpVectors(introFromRef.current, introToRef.current, k)
      // 运镜期间 enabled=false，update 会无意义重算 spherical，留给结束后的 controls.update
      if (t >= 1) {
        introStartRef.current = null
        introFromRef.current = null
        introToRef.current = null
        controls.enabled = true
        controls.saveState() // 把默认机位记录为 R 键 reset 的标准态
        controls.update()
      }
      return
    }

    // 收获聚焦动画：推进已有动画，否则检查新事件
    const harvest = readHarvestCamera()
    if (harvest.event && harvest.sequence !== lastHarvestSeqRef.current) {
      lastHarvestSeqRef.current = harvest.sequence
      const ev = harvest.event
      // 连续收获时，restPos/restTarget 锁定到「本轮会话首次进入动画前的 user 视角」，
      // 否则第二段动画会从第一段中途的错位位置回位
      const existing = harvestAnimRef.current
      harvestAnimRef.current = {
        fromPos: camera.position.clone(),
        fromTarget: controls.target.clone(),
        toTarget: new Vector3(ev.x, 0.25, ev.z),
        restPos: existing ? existing.restPos : camera.position.clone(),
        restTarget: existing ? existing.restTarget : controls.target.clone(),
        startAt: now,
        duration: CAMERA.harvestMs,
      }
      controls.enabled = false
      // 通知 App 关闭教程提示：第一次收获发生时，用户已体验到镜头推近
      if (!existing) window.dispatchEvent(new CustomEvent('farm:hint-dismiss'))
    }

    const anim = harvestAnimRef.current
    if (anim) {
      const t = ease.clamp01((now - anim.startAt) / anim.duration)
      // 前半：推近到目标地块；后半：回位到 restPos/restTarget
      const half = ease.outCubic(t < 0.5 ? t * 2 : 1 - (t - 0.5) * 2)
      if (t < 0.5) {
        // 距离：当前 -> 缩短到 harvestZoom
        const fromDist = tmpVec.copy(anim.fromPos).sub(anim.fromTarget).length()
        const targetDist = fromDist * CAMERA.harvestZoom
        const dir = tmpVec.copy(anim.fromPos).sub(anim.fromTarget).normalize()
        camera.position.copy(anim.fromTarget).addScaledVector(dir, fromDist + (targetDist - fromDist) * half)
        // target：从 fromTarget 滑向 toTarget
        controls.target.lerpVectors(anim.fromTarget, anim.toTarget, half)
      } else {
        // 距离：从缩短态回位到 restPos
        const fromDist = tmpVec.copy(anim.fromPos).sub(anim.fromTarget).length()
        const targetDist = fromDist * CAMERA.harvestZoom
        const restDist = tmpVec.copy(anim.restPos).sub(anim.restTarget).length()
        const restDir = tmpVec.copy(anim.restPos).sub(anim.restTarget).normalize()
        const dist = targetDist + (restDist - targetDist) * half
        camera.position.copy(anim.restTarget).addScaledVector(restDir, dist)
        controls.target.lerpVectors(anim.toTarget, anim.restTarget, half)
      }
      if (t >= 1) {
        // 恢复用户控制
        controls.target.copy(anim.restTarget)
        controls.saveState()
        controls.enabled = true
        controls.update()
        harvestAnimRef.current = null
      }
      return
    }
    controls.update()
  })

  return null
}

// P1-6 昼夜氛围：光照色温与强度随真实时间缓慢过渡，雨/旱天气叠加在昼夜基准上（35% 权重）
// 用模块级 Color 复用（避免每帧 new Color 在 60fps 下产生 ~400 个临时对象/秒）
const _tmpDirColor = new Color()
const _tmpSkyColor = new Color()
const _tmpHemiGround = new Color()

/** 天气色偏与昼夜基准的混合权重：0=看不出天气、1=瞬间硬切。0.65 取中间偏强 */
const WEATHER_BLEND = 0.65
const getDayNightDirColor = (target: Color, hour: number): Color => {
  if (hour < 5) return target.set(0x6a8aa8) // 深夜
  if (hour < 8) {
    const t = (hour - 5) / 3
    return target.set(0x6a8aa8).lerp(_tmpSkyColor.set(0xffb070), t) // 黎明 5-8
  }
  if (hour < 18) return target.set(0xfff3dd) // 白天
  if (hour < 20) {
    const t = (hour - 18) / 2
    return target.set(0xfff3dd).lerp(_tmpSkyColor.set(0xffb070), t) // 黄昏 18-20
  }
  return target.set(0x6a8aa8) // 夜间
}

const getDayNightDirIntensity = (hour: number): number => {
  if (hour < 5) return 0.6 // 深夜（00-04 稳态低谷）
  if (hour < 8) return 1.8 // 黎明
  if (hour < 18) return 2.4 // 白天
  if (hour < 20) return 2.4 - (hour - 18) / 2 * 0.6 // 黄昏缓降
  return 0.6 // 夜间（20-24）
}

const getDayNightHemiIntensity = (hour: number): number => {
  if (hour < 5) return 0.25
  if (hour < 8) return 0.7
  if (hour < 18) return 1.1
  if (hour < 20) return 1.1 - (hour - 18) / 2 * 0.4
  return 0.25
}

const Lights = memo(function Lights() {
  const dir = useRef<DirectionalLight>(null)
  const hemi = useRef<HemisphereLight>(null)
  // P1-6 review 修复：模块级 Color 复用，避免每帧 new Color 产生 ~400 个临时对象/秒
  const finalDirColor = useMemo(() => new Color(), [])
  const dayHemiSky = useMemo(() => new Color(), [])

  useFrame((_, dt) => {
    const now = new Date()
    const hour = now.getHours() + now.getMinutes() / 60

    // 昼夜基准（in-place 写入复用 Color，不分配）
    // _tmpDirColor = dayColor
    getDayNightDirColor(_tmpDirColor, hour)
    const dayDirIntensity = getDayNightDirIntensity(hour)
    const dayHemiIntensity = getDayNightHemiIntensity(hour)

    // 天气叠加（65% 权重）：方向光颜色 / 半球光强度
    // 权重从 0.35 提到 0.65：之前"瞬间切但只切 35%"导致变天感弱，玩家看不出天气真的换了。
    // P2-6：方向光颜色按 forecast.kind 查表（不只是 rain/干旱二分）。
    const weatherDirI = weatherDirIntensity(dayDirIntensity)
    const weatherHemiI = weatherHemiIntensity(dayHemiIntensity)
    // weatherColor 派生：rain 按 kind（小雨浅、大雨深、雷雨灰蓝），drought 用暖橙
    currentWeatherOverlay(finalDirColor)
    // dayColor (in _tmpDirColor) lerp(weatherColor, WEATHER_BLEND) -> 结果写回 _tmpDirColor
    _tmpDirColor.lerp(finalDirColor, WEATHER_BLEND)

    const finalDirIntensity = dayDirIntensity + (weatherDirI - dayDirIntensity) * WEATHER_BLEND
    const finalHemiIntensity = dayHemiIntensity + (weatherHemiI - dayHemiIntensity) * WEATHER_BLEND

    const k = 1 - Math.exp(-DAY_NIGHT.k * Math.min(dt, 0.1))
    if (dir.current) {
      dir.current.color.lerp(finalDirColor, k)
      dir.current.intensity += (finalDirIntensity - dir.current.intensity) * k
    }
    if (hemi.current) {
      hemi.current.intensity += (finalHemiIntensity - hemi.current.intensity) * k
      // hemisphereLight 色温也跟昼夜走（skyColor + groundColor 双轴过渡）
      getDayNightHemiSkyColor(dayHemiSky, hour)
      hemi.current.color.lerp(dayHemiSky, k)
      // groundColor 保持稳定（地面反射色，不参与昼夜色温），避免亮度过低时草地变深
    }
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
      <ToonMat color={0x72b356} />
    </mesh>
  )
})

// D12 第五轮：toon material 桥组件。让 R3F JSX 写法可以直接用共享 toon gradient，
// 避免每个 meshLambertMaterial → meshToonMaterial 都得 useMemo 写三行。
// emissive 支持给金币粒子等需要"无视光照保持原色"的元素用。
function ToonMat({ color, emissive, emissiveIntensity }: { color: number; emissive?: number; emissiveIntensity?: number }) {
  return (
    <meshToonMaterial
      color={color}
      gradientMap={toonGradient()}
      emissive={emissive ?? 0x000000}
      emissiveIntensity={emissive ? (emissiveIntensity ?? 1) : 0}
    />
  )
}

// P1-6 昼夜氛围天空色：真实时间驱动，24h 分段插值（5am 黎明 / 8am 早晨 / 12pm 中午 / 6pm 黄昏 / 8pm 入夜 / 12am 深夜）
const _tmpSkyTarget = new Color()
const getDayNightSky = (target: Color, hour: number): Color => {
  if (hour < 5) return target.set(0x1a1f3a) // 深夜
  if (hour < 8) {
    const t = (hour - 5) / 3
    return target.set(0x1a1f3a).lerp(_tmpSkyTarget.set(0xffb8c0), t) // 黎明 5-8
  }
  if (hour < 18) {
    const t = (hour - 8) / 10
    return target.set(0xffb8c0).lerp(_tmpSkyTarget.set(0x87ceeb), t) // 早晨 8-18
  }
  if (hour < 20) {
    const t = (hour - 18) / 2
    return target.set(0x87ceeb).lerp(_tmpSkyTarget.set(0xf0a878), t) // 黄昏 18-20
  }
  return target.set(0x1a1f3a) // 夜间
}

// 半球光色温：天空色（hex）按昼夜过渡，与方向光色温保持一致
const getDayNightHemiSkyColor = (target: Color, hour: number): Color => {
  if (hour < 5) return target.set(0x4a5a78) // 深夜：冷蓝
  if (hour < 8) {
    const t = (hour - 5) / 3
    return target.set(0x4a5a78).lerp(_tmpHemiGround.set(0xbfe8ff), t) // 黎明：渐变到晨蓝
  }
  if (hour < 18) return target.set(0xbfe8ff) // 白天：明亮天蓝
  if (hour < 20) {
    const t = (hour - 18) / 2
    return target.set(0xbfe8ff).lerp(_tmpHemiGround.set(0xff9a6a), t) // 黄昏：金橙
  }
  return target.set(0x4a5a78) // 夜间：冷蓝
}

// P2-6 天气氛围：按 forecast.kind 查表，每种天气给一个 sky/light overlay
// 老的 SKY_RAIN_OVERLAY / SKY_DROUGHT_OVERLAY 由 forecast 表统一替代
const WEATHER_OVERLAYS: Record<WeatherKind, Color> = {
  sunny: new Color(0xfff0d0),     // 暖白
  cloudy: new Color(0xc8d0d8),    // 浅灰
  overcast: new Color(0x9ba8b8),  // 深灰
  lightRain: new Color(0x9fb4c4), // 浅蓝（兼容旧值）
  heavyRain: new Color(0x6a8aa8), // 深蓝
  thunder: new Color(0x5a6a88),   // 雷雨灰蓝
}
const DROUGHT_OVERLAY = new Color(0xe0c98d)

// 方向光强度按 isRain/isDrought 决定；非雨用 day 基准
function weatherDirIntensity(dayIntensity: number): number {
  if (isRain()) return 1.5
  if (isDrought()) return 2.7
  return dayIntensity
}

function weatherHemiIntensity(dayIntensity: number): number {
  if (isRain()) return 0.85
  if (isDrought()) return 1.25
  return dayIntensity
}

function currentWeatherOverlay(target: Color): void {
  if (isRain()) {
    const kind = getTodayForecast().kind
    target.copy(WEATHER_OVERLAYS[kind])
  } else if (isDrought()) {
    target.copy(DROUGHT_OVERLAY)
  } else {
    target.copy(WEATHER_OVERLAYS[getTodayForecast().kind])
  }
}

function WeatherMood() {
  const scene = useThree((s) => s.scene)
  // 复用 Color，避免每帧 clone() / new Color() 产生 ~200 个临时对象/秒
  const daySky = useMemo(() => new Color(), [])
  const target = useMemo(() => new Color(), [])

  useFrame((_, dt) => {
    const now = new Date()
    const hour = now.getHours() + now.getMinutes() / 60

    // daySky = 昼夜基准（in-place）
    getDayNightSky(daySky, hour)
    // weather overlay：按 forecast.kind / 干旱 派生
    currentWeatherOverlay(target)
    // daySky lerp(target, WEATHER_BLEND) -> 结果写回 daySky
    daySky.lerp(target, WEATHER_BLEND)

    const k = 1 - Math.exp(-DAY_NIGHT.k * Math.min(dt, 0.1))
    const bg = scene.background
    if (bg instanceof Color) bg.lerp(daySky, k)
    const fog = scene.fog as { color: Color } | null
    if (fog) fog.color.lerp(daySky, k)
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
  groupIdx: number
  crop: CropId | null
  plantedAt: number | null
  state: PlotState
  /** 空地提示环：仅当选中种子买得起且地块为空 */
  hint: boolean
  onPlot: (i: number) => void
  make: MakeMap
}

function PlotView({ index, groupIdx, crop, plantedAt, state, hint, onPlot, make }: PlotViewProps) {
  const [x, z] = plotPosition(index, groupIdx)
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

    // 空地提示呼吸（D5）：withered 不显示提示环；P2-1 补 emissive 微光
    if (hintRef.current) {
      const k = Math.sin((now / 1000) * Math.PI * 1.2)
      hintRef.current.scale.setScalar(1 + 0.06 * k)
      const ring = hintRef.current.children[0] as Mesh
      const mat = ring.material as MeshStandardMaterial
      mat.emissiveIntensity = 0.25 + 0.25 * k // 0..0.5 呼吸
      mat.opacity = 0.28 + 0.18 * k
    }

    // 生长连续插值：Date.now 对齐 plantedAt 的时间基（帧级平滑，不等重渲染）；
    // 进度含事件偏移（getBonus），与进度条/收获判定同源。
    // withered 状态 base 固定 0.85（略缩，凹下感），不用 progressOf。
    let base = 0.08
    if (state === 'withered') {
      base = 0.85
      wasMatureRef.current = false
    } else if (crop && plantedAt !== null) {
      // P2-7：用 getNow() 而非 Date.now()，让快进偏移立即影响生长进度
      const t = ease.clamp01(progressOf({ crop, plantedAt: plantedAt - getBonus(index), state, witheredAt: null }, getNow()))
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
          const mat = o.material as MeshBasicMaterial | import('three').MeshToonMaterial
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
            <meshStandardMaterial color={0xfff2b0} emissive={0xfff2b0} emissiveIntensity={0.35} transparent opacity={0.3} depthWrite={false} metalness={0} roughness={1} />
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
        <CountdownFloater index={index} groupIdx={groupIdx} crop={crop} plantedAt={plantedAt} />
      )}
      <StatusRing index={index} crop={crop} state={state} />
    </group>
  )
}

function Farm({
  data,
  onPlot,
  make,
  groupIdx,
}: Pick<FarmSceneProps, 'data' | 'onPlot'> & { make: MakeMap; groupIdx: number }) {
  const afford = data.coins >= CROPS[data.selected].seedPrice
  return (
    <>
      {data.plots.map((p, i) => (
        <PlotView
          key={i}
          index={i}
          groupIdx={groupIdx}
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
  groupIdx,
  crop,
  plantedAt,
}: {
  index: number
  groupIdx: number
  crop: CropId
  plantedAt: number
}) {
  const lastShownAtRef = useRef(0)
  const [x, z] = plotPosition(index, groupIdx)
  const y = crop === 'corn' ? 0.95 : 0.62

  useFrame(() => {
    const def = CROPS[crop]
    const total = def.stageMs[0] + def.stageMs[1]
    // P2-7：用 getNow() 让倒计时显示随快进跳跃
    const remain = Math.max(0, plantedAt + total - getNow() + getBonus(index))
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

function PestBug({ onPest, groupIdx }: { onPest: () => void; groupIdx: number }) {
  const grp = useRef<Group>(null)
  const ring = useRef<Mesh>(null)

  useFrame(() => {
    const g = grp.current
    if (!g) return
    const ev = getActive()
    const on = ev?.type === 'pest'
    g.visible = on
    if (!on || !ev) return
    const [px, pz] = plotPosition(ev.plot, groupIdx)
    const t = performance.now() / 1000
    g.position.set(
      px + Math.cos(t * 2.1) * 0.13,
      0.32 + Math.sin(t * 6) * 0.025,
      pz + Math.sin(t * 2.1) * 0.13,
    )
    // 与 events.ts 的 ev.endAt 同源（Date.now()）：之前用 performance.now() 读 endAt（毫秒级 epoch vs 帧时钟）
    // 会让 urgency ≈ 1.4×10⁸、sin 频率趋近 0，害虫红圈实际上不会越接近超时闪得越急。
    const urgency = 1 - Math.max(0, (ev.endAt - Date.now()) / PEST_TTL_MS)
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
        <meshToonMaterial color={0x3a2a20} />
      </mesh>
      <mesh position={[0, 0.012, 0.055]}>
        <sphereGeometry args={[0.032, 10, 8]} />
        <meshToonMaterial color={0x241812} />
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

// 风向：m/s 量级。0 = 垂直下落。负 x = 雨被吹向 -X 方向（粒子 x 递减）。
// 默认轻微斜风，让雨看起来"被吹"，不至于像被钉子钉着。
const RAIN_WIND_X = -1.2
const RAIN_WIND_Z = -0.6

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
      p.x += RAIN_WIND_X * d
      p.y -= p.v * d
      p.z += RAIN_WIND_Z * d
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
      <ToonMat color={0x6ec24a} />
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
      <ToonMat color={0xffd24a} emissive={0x7a5200} emissiveIntensity={1} />
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
          f.combo,
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
function WitheredRecoverHint({ plots, groupIdx }: { plots: SaveData['plots']; groupIdx: number }) {
  const lastShownAtRef = useRef(0)

  useFrame(() => {
    const now = performance.now()
    if (now - lastShownAtRef.current < 1000) return
    // 寻找有 withered 状态的地块
    for (let i = 0; i < plots.length; i++) {
      const p = plots[i]
      if (p.state !== 'withered') continue
      // P2-7：用 getNow() 让 withered 恢复倒计时随快进跳跃
      const secs = getPlotStateRecoveryMs(i, getNow(), plots)
      if (secs <= 0) continue
      const [px, pz] = plotPosition(i, groupIdx)
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
    // P2-7：用 getNow()（游戏时间）作为节流与推进的基准——快进后节流立即触发，
    // withered 状态机在游戏时间线上推进，与作物进度同步。
    const now = getNow()
    if (now - lastCheckRef.current < 1000) return
    lastCheckRef.current = now
    const next = tickPlotStates(plots, now)
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

export default function FarmScene({ data, onPlot, onPest, onTickPlots, currentGroupIdx = 0 }: FarmSceneProps) {
  const dirtGltf = useGLTF(ASSETS.dirt)
  const carrotGltf = useGLTF(ASSETS.carrot)
  const cornGltf = useGLTF(ASSETS.corn)

  // P2-1：订阅 tutorial 单例，在 Canvas 内渲染 3D 引导箭头
  const [tutorial, setTutorial] = useState<TutorialState | null>(null)
  useEffect(() => {
    return subscribeTutorial(setTutorial)
  }, [])

  const make = useMemo<MakeMap>(
    () => ({
      dirt: () => normalized(dirtGltf.scene, { width: 1.02 }),
      carrot: () => normalized(carrotGltf.scene, { height: 0.46 }),
      corn: () => normalized(cornGltf.scene, { height: 0.78 }),
    }),
    [dirtGltf, carrotGltf, cornGltf],
  )

  // P2-3：订阅 decorations 单例，渲染玩家放置的摆件
  const [decorations, setDecorations] = useState<Decoration[]>(getDecorations)
  useEffect(() => {
    return subscribeDecorations(setDecorations)
  }, [])

  return (
    <>
      <color attach="background" args={[0x87ceeb]} />
      <fog attach="fog" args={[0x87ceeb, 14, 34]} />
      <CameraRig />
      <Lights />
      <Suspense fallback={null}>
        <Ground />
        <Farm data={data} onPlot={onPlot} make={make} groupIdx={currentGroupIdx} />
        <FenceRing />
        <Tree kind="NormalTree_1" height={1.7} position={[-4.8, -3.0]} rotationY={0.3} />
        <Tree kind="NormalTree_3" height={2.2} position={[3.6, -3.0]} rotationY={-1.2} />
        <Tree kind="NormalTree_2" height={1.9} position={[4.4, 0.2]} rotationY={2.1} />
        <Tree kind="NormalTree_4" height={1.5} position={[-4.3, 1.4]} rotationY={1.1} />
        <Tree kind="NormalTree_1" height={1.3} position={[1.0, -3.6]} rotationY={0.9} />
        <DecoLayer />
        {decorations.map((d) => (
          <DecorationItem key={d.id} kind={d.kind} position={[d.x, d.z]} rotationY={d.rotY} />
        ))}
        <PestBug onPest={onPest} groupIdx={currentGroupIdx} />
        <RainParticles />
        <PopLayer />
        <Shockwave />
        <LeafBurst />
        <CoinParticles />
        <FloaterBridge />
        <WeatherMood />
        <EventsTicker plots={data.plots} />
        <WitheredRecoverHint plots={data.plots} groupIdx={currentGroupIdx} />
        <PlotStateTicker plots={data.plots} onTickPlots={onTickPlots} />
        {/* P2-1 新手引导 3D 箭头：step=2 指向 plot 0，step=3 指向目标地块 */}
        {tutorial?.step === 2 && tutorial.targetPlot !== null && (
          <TutorialArrow target="plot" plotIndex={tutorial.targetPlot} />
        )}
        {tutorial?.step === 3 && tutorial.targetPlot !== null && (
          <TutorialArrow target="plot-mature" plotIndex={tutorial.targetPlot} />
        )}
      </Suspense>
    </>
  )
}
