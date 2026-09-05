import { Suspense, useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { ASSETS } from './assets'
import { normalized, useGLTF } from './gltf'
import { PLOT_COLS, PLOT_ROWS, plotPosition } from './layout'

// D1 固定机位；D3 换环绕相机（OrbitControls + 边界 clamp）
function CameraSetup() {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    camera.lookAt(0, 0.25, 0)
  }, [camera])
  return null
}

function Lights() {
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
}

function Ground() {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <meshLambertMaterial color={0x72b356} />
    </mesh>
  )
}

// D1 静态预览：摆一组不同"阶段比例"的作物，验证资产与比例关系；D2 换成 packages/game 状态驱动
const PREVIEW: ({ crop: 'carrot' | 'corn'; stageScale: number } | null)[] = [
  { crop: 'carrot', stageScale: 1 },
  { crop: 'carrot', stageScale: 0.55 },
  { crop: 'carrot', stageScale: 0.25 },
  { crop: 'corn', stageScale: 1 },
  { crop: 'corn', stageScale: 0.55 },
  null,
]

function Farm() {
  const dirtGltf = useGLTF(ASSETS.dirt)
  const carrotGltf = useGLTF(ASSETS.carrot)
  const cornGltf = useGLTF(ASSETS.corn)

  const make = useMemo(
    () => ({
      dirt: () => normalized(dirtGltf.scene, { width: 1.02 }),
      carrot: () => normalized(carrotGltf.scene, { height: 0.46 }),
      corn: () => normalized(cornGltf.scene, { height: 0.78 }),
    }),
    [dirtGltf, carrotGltf, cornGltf],
  )

  return (
    <>
      {Array.from({ length: PLOT_ROWS * PLOT_COLS }, (_, i) => {
        const [x, z] = plotPosition(i)
        const preview = PREVIEW[i]
        return (
          <group key={i} position={[x, 0.02, z]}>
            <primitive object={make.dirt()} />
            {preview && (
              <group scale={preview.stageScale}>
                <primitive object={preview.crop === 'carrot' ? make.carrot() : make.corn()} />
              </group>
            )}
          </group>
        )
      })}
    </>
  )
}

function FenceRing() {
  const fenceGltf = useGLTF(ASSETS.fence)

  const make = useMemo(() => () => normalized(fenceGltf.scene, { width: 0.95 }), [fenceGltf])

  const segs = useMemo(() => {
    const hx = 2.35
    const hz = 1.7
    const list: { x: number; z: number; rotY: number }[] = []
    for (let i = 0; i < 5; i++) {
      const x = -hx + (2 * hx * (i + 0.5)) / 5
      list.push({ x, z: -hz, rotY: 0 }, { x, z: hz, rotY: 0 })
    }
    for (let i = 0; i < 4; i++) {
      const z = -hz + (2 * hz * (i + 0.5)) / 4
      list.push({ x: -hx, z, rotY: Math.PI / 2 }, { x: hx, z, rotY: Math.PI / 2 })
    }
    return list
  }, [])

  return (
    <>
      {segs.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]} rotation-y={s.rotY}>
          <primitive object={make()} />
        </group>
      ))}
    </>
  )
}

// trees.glb 是 5 棵树的合集，按节点名拆选单棵使用（ASSETS.md 有注）
const TREES = [
  { name: 'NormalTree_1', height: 1.7, pos: [-3.4, -2.7], rotY: 0.3 },
  { name: 'NormalTree_3', height: 2.2, pos: [3.6, -3.0], rotY: -1.2 },
  { name: 'NormalTree_2', height: 1.9, pos: [4.4, 0.2], rotY: 2.1 },
  { name: 'NormalTree_4', height: 1.5, pos: [-4.3, 1.4], rotY: 1.1 },
  { name: 'NormalTree_1', height: 1.3, pos: [-0.3, -3.6], rotY: 0.9 },
] as const

function Trees() {
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
}

export default function FarmScene() {
  return (
    <>
      <color attach="background" args={[0x87ceeb]} />
      <fog attach="fog" args={[0x87ceeb, 14, 34]} />
      <CameraSetup />
      <Lights />
      <Suspense fallback={null}>
        <Ground />
        <Farm />
        <FenceRing />
        <Trees />
      </Suspense>
    </>
  )
}
