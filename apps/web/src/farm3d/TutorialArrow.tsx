// P2-1 3D 箭头组件：在 Canvas 内渲染一个浮动 + 旋转的箭头，指向目标地块。
// target='plot' 时在 plotIndex 位置显示脉冲圆环 + 向下指箭头。
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Mesh } from 'three'
import { plotPosition } from './layout'

interface TutorialArrowProps {
  /** 引导目标类型 */
  target: 'seed' | 'plot' | 'plot-mature'
  /** 当 target='plot'|'plot-mature' 时，指向的地块下标 */
  plotIndex?: number
}

export default function TutorialArrow({ target, plotIndex = 0 }: TutorialArrowProps) {
  const groupRef = useRef<Group>(null)
  const ringRef = useRef<Mesh>(null)
  const t0 = useRef(performance.now())

  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    const now = performance.now()
    const elapsed = (now - t0.current) / 1000

    if (target === 'plot' || target === 'plot-mature') {
      const [px, pz] = plotPosition(plotIndex)
      // 上下浮动
      g.position.set(px, 0.9 + 0.18 * Math.sin(elapsed * Math.PI * 1.6), pz)
      // 绕 Y 轴旋转
      g.rotation.y = elapsed * 0.9

      // 脉冲圆环
      if (ringRef.current) {
        const ring = ringRef.current
        const k = (Math.sin(elapsed * Math.PI * 2.2) + 1) / 2 // 0..1
        ring.scale.setScalar(1 + 0.12 * k)
        const mat = ring.material as import('three').MeshBasicMaterial
        mat.opacity = 0.55 + 0.35 * k
      }
    }
  })

  if (target === 'plot' || target === 'plot-mature') {
    const [px, pz] = plotPosition(plotIndex)
    return (
      <group ref={groupRef} position={[px, 0.9, pz]}>
        {/* 脉冲圆环：位于 y=0.04（略高于地面）。
            raycast={null} 让 pointer event 穿透到下层地块，避免引导期间点不到 plot 卡死 step 2/3。
            参考 FarmScene.tsx StatusRing/Shockwave 的成熟做法。 */}
        <mesh ref={ringRef} rotation-x={-Math.PI / 2} position={[0, 0.04, 0]} raycast={() => null}>
          <ringGeometry args={[0.38, 0.52, 36]} />
          <meshBasicMaterial
            color={target === 'plot-mature' ? 0xffd24a : 0xfff2b0}
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </mesh>

        {/* 向下指的箭头：圆锥 + 圆柱杆，纯装饰不拦截 pointer */}
        <mesh position={[0, -0.42, 0]} raycast={() => null}>
          <coneGeometry args={[0.12, 0.28, 12]} />
          <meshBasicMaterial color={target === 'plot-mature' ? 0xffd24a : 0xfff2b0} />
        </mesh>
        <mesh position={[0, -0.1, 0]} raycast={() => null}>
          <cylinderGeometry args={[0.035, 0.035, 0.45, 10]} />
          <meshBasicMaterial color={target === 'plot-mature' ? 0xffd24a : 0xfff2b0} />
        </mesh>
      </group>
    )
  }

  return null
}
