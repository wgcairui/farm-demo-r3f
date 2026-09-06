// 狗屋：小尺寸茅草顶 + 圆拱门洞 + 门口骨头 + 餐盆。
// 参考 QQ 农场风格，定位在 cottage 旁边；狗蹲在 DOG_POS（门口）。
import { useMemo } from 'react'
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  SphereGeometry,
} from 'three'

/** 狗屋位置：cottage 右侧前方，朝地块方向 */
export const DOGHOUSE_POS: [number, number, number] = [-2.4, 0, 2.3]
/** 狗位置：紧邻狗屋门口（朝外，远离 cottage 墙） */
export const DOG_POS: [number, number, number] = [-2.4, 0, 2.8]

function buildDoghouse(): Group {
  const g = new Group()
  const wallMat = new MeshLambertMaterial({ color: 0xd4a96a }) // 木墙（同 cottage）
  const roofMat = new MeshLambertMaterial({ color: 0x8b6914 }) // 茅草顶（同 cottage）
  const doorMat = new MeshLambertMaterial({ color: 0x2a1a0a }) // 黑洞

  // 底座（矮，0.04 高）
  const base = new Mesh(new BoxGeometry(0.75, 0.04, 0.7), wallMat)
  base.position.y = 0.02
  base.castShadow = true
  base.receiveShadow = true
  g.add(base)

  // 主体墙（0.7 × 0.5 × 0.65，比 cottage 小一半多）
  const wall = new Mesh(new BoxGeometry(0.7, 0.5, 0.65), wallMat)
  wall.position.y = 0.29
  wall.castShadow = true
  wall.receiveShadow = true
  g.add(wall)

  // 圆拱门洞（前面中间，深色）
  const door = new Mesh(new BoxGeometry(0.25, 0.32, 0.05), doorMat)
  door.position.set(0, 0.18, 0.35)
  g.add(door)

  // 三角屋顶（4 段锥，比 cottage 矮胖）
  const roof = new Mesh(new ConeGeometry(0.55, 0.4, 4), roofMat)
  roof.position.y = 0.74
  roof.rotation.y = Math.PI / 4
  roof.castShadow = true
  g.add(roof)

  return g
}

function buildBone(): Group {
  const g = new Group()
  const mat = new MeshLambertMaterial({ color: 0xf8f0d8 }) // 骨白
  const center = new Mesh(new BoxGeometry(0.18, 0.04, 0.04), mat)
  center.castShadow = true
  g.add(center)
  const endL = new Mesh(new SphereGeometry(0.04, 6, 6), mat)
  endL.position.set(-0.11, 0, 0)
  g.add(endL)
  const endR = new Mesh(new SphereGeometry(0.04, 6, 6), mat)
  endR.position.set(0.11, 0, 0)
  g.add(endR)
  return g
}

function buildBowl(): Group {
  const g = new Group()
  const mat = new MeshLambertMaterial({ color: 0xc89060 }) // 陶土色
  const bowl = new Mesh(new CylinderGeometry(0.12, 0.1, 0.05, 12), mat)
  bowl.position.y = 0.025
  bowl.castShadow = true
  g.add(bowl)
  // 「狗粮」深色小山
  const food = new Mesh(
    new SphereGeometry(0.09, 8, 6),
    new MeshLambertMaterial({ color: 0x6a4a2a }),
  )
  food.position.y = 0.06
  food.scale.set(1, 0.4, 1)
  g.add(food)
  return g
}

/**
 * 狗屋 + 骨头 + 餐盆组合。
 * 全部 metalness=0，flat tone mapping 由 Canvas 统一处理。
 */
export default function Doghouse() {
  const group = useMemo(() => {
    const g = new Group()
    g.add(buildDoghouse())
    // 骨头在门口右侧（相对狗屋本地坐标 +x 是朝地块方向）
    const bone = buildBone()
    bone.position.set(0.45, 0.04, 0.5)
    bone.rotation.y = 0.4
    g.add(bone)
    // 餐盆在门口左侧
    const bowl = buildBowl()
    bowl.position.set(-0.45, 0, 0.5)
    g.add(bowl)
    return g
  }, [])

  return (
    <group position={DOGHOUSE_POS}>
      <primitive object={group} />
    </group>
  )
}
