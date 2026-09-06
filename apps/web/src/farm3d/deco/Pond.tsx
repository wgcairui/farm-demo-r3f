// 鱼塘：水圈 + 半透明水面 + instanced 鱼游动 + 涟漪扩散。
// 鱼沿 FISH 椭圆轨迹游动，朝向切线方向。
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CircleGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial, RingGeometry, Vector3 } from 'three'
import { FISH } from './motion'

/** 鱼塘位置 */
export const POND_POS: [number, number, number] = [FISH.centerX, 0, FISH.centerZ]

function buildPond(): Group {
  const g = new Group()

  // 水面基底（圆形，半透明蓝）
  const waterGeo = new CircleGeometry(FISH.radius + 0.05, 24)
  const waterMat = new MeshBasicMaterial({
    color: 0x6ab0d8,
    transparent: true,
    opacity: 0.6,
  })
  const water = new Mesh(waterGeo, waterMat)
  water.rotation.x = -Math.PI / 2
  water.position.y = 0.01
  g.add(water)

  // 岸边暗圈（略大半径，深色描边感）
  const bankGeo = new RingGeometry(FISH.radius, FISH.radius + 0.18, 24)
  const bankMat = new MeshBasicMaterial({ color: 0x7a5a3a, transparent: true, opacity: 0.5 })
  const bank = new Mesh(bankGeo, bankMat)
  bank.rotation.x = -Math.PI / 2
  bank.position.y = 0.005
  g.add(bank)

  return g
}

const FISH_COLOR = 0xe8a020

/**
 * 鱼塘装饰：水圈 + instanced 鱼沿椭圆游动 + 涟漪。
 * 鱼在 FISH 椭圆内游，朝向切线方向。
 */
export default function Pond() {
  const pondGroup = useMemo(() => buildPond(), [])

  // Instanced fish
  const fishMesh = useRef<InstancedMesh>(null)
  const fishDataRef = useRef<{ angle: number; radiusOffset: number }[]>([])

  // Initialize fish offsets (once)
  if (fishDataRef.current.length === 0) {
    for (let i = 0; i < FISH.count; i++) {
      fishDataRef.current.push({
        angle: (i / FISH.count) * Math.PI * 2,
        radiusOffset: (Math.random() - 0.5) * 0.2,
      })
    }
  }

  useFrame(() => {
    if (!fishMesh.current) return

    const count = fishDataRef.current.length
    for (let i = 0; i < count; i++) {
      const fd = fishDataRef.current[i]
      // 每条鱼速度略有不同（±10%）
      const speed = 1 + (i % 3) * 0.1
      fd.angle += ((Math.PI * 2) / FISH.periodS) * speed * (1 / 60) // ~60fps

      const r = FISH.radius + fd.radiusOffset
      const x = FISH.centerX + r * Math.cos(fd.angle)
      const z = FISH.centerZ + r * Math.sin(fd.angle)

      // 朝向切线方向
      const tangentAngle = fd.angle + Math.PI / 2

      const m = fishMesh.current.matrixWorld.clone()
      m.identity()
      m.setPosition(x, 0.06, z)
      m.elements[0] = Math.cos(tangentAngle)
      m.elements[2] = -Math.sin(tangentAngle)
      m.elements[8] = Math.sin(tangentAngle)
      m.elements[10] = Math.cos(tangentAngle)

      fishMesh.current.setMatrixAt(i, m)
    }
    fishMesh.current.instanceMatrix.needsUpdate = true
  })

  // Ripples animation
  const rippleRef = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    if (!rippleRef.current) return
    const t = clock.getElapsedTime()
    const cycle = t % 2
    const scale = 0.3 + (cycle / 2) * (FISH.radius * 2 - 0.3)
    const opacity = 1 - cycle / 2
    rippleRef.current.scale.setScalar(scale)
    ;(rippleRef.current.material as MeshBasicMaterial).opacity = opacity * 0.45
  })

  return (
    <group>
      <primitive object={pondGroup} />

      {/* Instanced fish (coneGeometry = fish shape) */}
      <instancedMesh ref={fishMesh} args={[undefined, undefined, FISH.count]}>
        <coneGeometry args={[0.055, 0.18, 4]} />
        <meshBasicMaterial color={FISH_COLOR} />
      </instancedMesh>

      {/* Ripple ring */}
      <mesh
        ref={rippleRef}
        position={[FISH.centerX, 0.02, FISH.centerZ]}
        rotation-x={-Math.PI / 2}
      >
        <ringGeometry args={[FISH.radius * 0.7, FISH.radius * 0.78, 24]} />
        <meshBasicMaterial color={0xffffff} transparent opacity={0.45} />
      </mesh>
    </group>
  )
}
