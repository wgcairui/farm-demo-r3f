import { memo, Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { Group, InstancedMesh } from 'three'
import { Object3D, Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CROPS, type CropId, type SaveData } from '@farm/game'
import { ASSETS } from './assets'
import { isClick } from './clickGuard'
import {
  getPops,
  getCoins,
  MAX_COINS,
  removePop,
  spawnHarvestPop,
  updateCoins,
} from './effects'
import { mountFloaterDom, takeFloaters } from './floaters'
import { normalized, useGLTF } from './gltf'
import { PLOT_COLS, PLOT_ROWS, plotPosition } from './layout'

export interface FarmSceneProps {
  data: SaveData
  onPlot: (i: number) => void
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

const Lights = memo(function Lights() {
  return (
    <>
      <hemisphereLight args={[0xbfe8ff, 0x9c7a4f, 1.1]} />
      <directionalLight
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

interface MakeMap {
  dirt: () => Group
  carrot: () => Group
  corn: () => Group
}

interface PlotViewProps {
  index: number
  crop: CropId | null
  plantedAt: number | null
  onPlot: (i: number) => void
  make: MakeMap
}

function PlotView({ index, crop, plantedAt, onPlot, make }: PlotViewProps) {
  const [x, z] = plotPosition(index)
  const dirt = useMemo(() => make.dirt(), [make])
  const plant = useMemo(() => (crop ? make[crop]() : null), [crop, make])

  const scaleGroupRef = useRef<Group>(null)
  const squashAtRef = useRef<number | null>(null)
  const stateRef = useRef<{ crop: CropId | null; plant: Group | null }>({ crop, plant })

  // 播种/收获的边界检测：播种 → 压弹；收获 → 把旧模型交给 PopLayer 起跳消失
  useEffect(() => {
    const prev = stateRef.current
    if (prev.crop && !crop && prev.plant) spawnHarvestPop(prev.plant, x, z)
    if (!prev.crop && crop) squashAtRef.current = performance.now()
    stateRef.current = { crop, plant }
  }, [crop, plant, x])

  useFrame(() => {
    const g = scaleGroupRef.current
    if (!g) return

    // 生长连续插值：Date.now 对齐 plantedAt 的时间基（帧级平滑，不等 500ms 心跳）
    let base = 0.08
    if (crop && plantedAt) {
      const def = CROPS[crop]
      const t = Math.min(1, Math.max(0, (Date.now() - plantedAt) / (def.stageMs[0] + def.stageMs[1])))
      base = 0.08 + 0.92 * (1 - Math.pow(1 - t, 3))
    }

    // 播种压弹：300ms 内先压到 ~0.55× 再弹回
    let squash = 1
    if (squashAtRef.current !== null) {
      const t = (performance.now() - squashAtRef.current) / 300
      if (t >= 1) squashAtRef.current = null
      else squash = 1 - 0.45 * Math.sin(t * Math.PI)
    }

    g.scale.setScalar(base * squash)
  })

  return (
    <group
      position={[x, 0.02, z]}
      onClick={(e) => {
        e.stopPropagation()
        if (isClick(e.nativeEvent)) onPlot(index)
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      <primitive object={dirt} />
      {plant && (
        <group ref={scaleGroupRef}>
          <primitive object={plant} />
        </group>
      )}
    </group>
  )
}

function Farm({ data, onPlot, make }: FarmSceneProps & { make: MakeMap }) {
  return (
    <>
      {data.plots.map((p, i) => (
        <PlotView
          key={i}
          index={i}
          crop={p.crop}
          plantedAt={p.plantedAt}
          onPlot={onPlot}
          make={make}
        />
      ))}
    </>
  )
}

// —— D4 特效层 ——

/** 收获弹出：作物起跳 + 先胀后缩 + 自旋，600ms 后移除 */
function PopLayer() {
  const groupRef = useRef<Group>(null)

  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    const now = performance.now()
    for (const p of [...getPops()]) {
      const t = (now - p.born) / 600
      if (t >= 1) {
        g.remove(p.obj)
        removePop(p)
        continue
      }
      if (!p.obj.parent) {
        p.obj.position.set(p.x, 0, p.z)
        g.add(p.obj)
      }
      const k = 1 - Math.pow(1 - t, 2)
      p.obj.position.y = 0.55 * k
      const s = t < 0.3 ? 1 + 0.5 * (t / 0.3) : 1.5 - 0.9 * ((t - 0.3) / 0.7)
      p.obj.scale.setScalar(Math.max(0.001, s))
      p.obj.rotation.y += 0.06
    }
  })

  return <group ref={groupRef} />
}

/** 金币粒子：固定 64 实例的 InstancedMesh 池，闲置实例缩放归零 */
function CoinParticles() {
  const ref = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])

  useFrame((_, dt) => {
    updateCoins(Math.min(dt, 0.05))
    const mesh = ref.current
    if (!mesh) return
    const list = getCoins()
    for (let i = 0; i < MAX_COINS; i++) {
      const c = list[i]
      if (c) {
        dummy.position.copy(c.pos)
        dummy.rotation.set(c.tilt, c.rot, 0)
        dummy.scale.setScalar(1)
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
        )
      }
    }
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
const TREES = [
  { name: 'NormalTree_1', height: 1.7, pos: [-3.4, -2.7], rotY: 0.3 },
  { name: 'NormalTree_3', height: 2.2, pos: [3.6, -3.0], rotY: -1.2 },
  { name: 'NormalTree_2', height: 1.9, pos: [4.4, 0.2], rotY: 2.1 },
  { name: 'NormalTree_4', height: 1.5, pos: [-4.3, 1.4], rotY: 1.1 },
  { name: 'NormalTree_1', height: 1.3, pos: [-0.3, -3.6], rotY: 0.9 },
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

export default function FarmScene({ data, onPlot }: FarmSceneProps) {
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
        <PopLayer />
        <CoinParticles />
        <FloaterBridge />
      </Suspense>
    </>
  )
}
