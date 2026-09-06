import { memo, Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { Group } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { progressOf, stageOf, type CropId, type SaveData, type Stage } from '@farm/game'
import { ASSETS } from './assets'
import { isClick } from './clickGuard'
import { normalized, useGLTF } from './gltf'
import { PLOT_COLS, PLOT_ROWS, plotPosition } from './layout'

export interface FarmSceneProps {
  data: SaveData
  now: number
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
  stage: Stage
  progress: number
  onPlot: (i: number) => void
  make: MakeMap
}

function PlotView({ index, crop, stage, progress, onPlot, make }: PlotViewProps) {
  const [x, z] = plotPosition(index)
  const dirt = useMemo(() => make.dirt(), [make])
  const plant = useMemo(() => (crop ? make[crop]() : null), [crop, make])
  // D3 生长连续插值：总进度 easeOutCubic 映射到 scale；刚种下就有一株可见小苗
  const scale = 0.08 + 0.92 * (1 - Math.pow(1 - progress, 3))

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
      {plant && stage !== 'empty' && (
        <group scale={scale}>
          <primitive object={plant} />
        </group>
      )}
    </group>
  )
}

function Farm({ data, now, onPlot, make }: FarmSceneProps & { make: MakeMap }) {
  return (
    <>
      {data.plots.map((p, i) => (
        <PlotView
          key={i}
          index={i}
          crop={p.crop}
          stage={stageOf(p, now)}
          progress={progressOf(p, now)}
          onPlot={onPlot}
          make={make}
        />
      ))}
    </>
  )
}

// 静态子树：实例只建一次（useMemo），组件 memo 掉心跳带来的无谓重渲染——
// 围栏 18 段若每 tick 克隆重挂，2 次/秒的场景图抖动是 review 揪出来的 P0。
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

export default function FarmScene({ data, now, onPlot }: FarmSceneProps) {
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
        <Farm data={data} now={now} onPlot={onPlot} make={make} />
        <FenceRing />
        <Trees />
      </Suspense>
    </>
  )
}
