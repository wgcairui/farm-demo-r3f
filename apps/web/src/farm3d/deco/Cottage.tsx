// 茅草屋：程序化低模几何体（box + cone 三角屋顶）。
// 位置：[-3.5, 0, 2.5]，width ~2.2，与 DOG_PATH.center 重合。
// poly.pizza cottage 模型页 404（ID e0OaPDnTc9 已失效），使用程序化几何体替代。
import { useMemo } from 'react'
import { Group, BoxGeometry, ConeGeometry, Mesh, MeshLambertMaterial } from 'three'

/** cottage 主体位置（与 DOG_PATH.center 一致） */
export const COTTAGE_POS: [number, number, number] = [-3.5, 0, 2.5]

function buildCottage(): Group {
  const g = new Group()

  // 材质
  const wallMat = new MeshLambertMaterial({ color: 0xd4a96a }) // 木墙色
  const roofMat = new MeshLambertMaterial({ color: 0x8b6914 }) // 暗金棕茅草色
  const doorMat = new MeshLambertMaterial({ color: 0x5c3d1a }) // 深棕门色
  const baseMat = new MeshLambertMaterial({ color: 0x9a7a5a }) // 底座石色

  // 底座石台（0.05 高）
  const base = new Mesh(new BoxGeometry(2.4, 0.08, 2.0), baseMat)
  base.position.y = 0.04
  base.castShadow = true
  base.receiveShadow = true
  g.add(base)

  // 主体墙（2.2w x 1.4h x 1.8d）
  const wall = new Mesh(new BoxGeometry(2.2, 1.4, 1.8), wallMat)
  wall.position.y = 0.78 // 底座 0.08 + 半高 0.7
  wall.castShadow = true
  wall.receiveShadow = true
  g.add(wall)

  // 门洞（前面中间，深色）
  const door = new Mesh(new BoxGeometry(0.45, 0.75, 0.05), doorMat)
  door.position.set(0, 0.445, 0.925)
  door.castShadow = true
  g.add(door)

  // 左侧小窗（天光蓝半透明）
  const windowMat = new MeshLambertMaterial({ color: 0xaad4ff, transparent: true, opacity: 0.6 })
  const windowL = new Mesh(new BoxGeometry(0.3, 0.3, 0.05), windowMat)
  windowL.position.set(-0.7, 1.0, 0.925)
  g.add(windowL)

  // 右侧小窗
  const windowR = new Mesh(new BoxGeometry(0.3, 0.3, 0.05), windowMat)
  windowR.position.set(0.7, 1.0, 0.925)
  g.add(windowR)

  // 三角屋顶（4段锥体，底面朝侧面）
  const roof = new Mesh(new ConeGeometry(1.65, 1.0, 4), roofMat)
  roof.position.y = 2.0
  roof.rotation.y = Math.PI / 4
  roof.castShadow = true
  g.add(roof)

  // 烟囱（后面）
  const chimney = new Mesh(
    new BoxGeometry(0.3, 0.5, 0.3),
    new MeshLambertMaterial({ color: 0xaa7733 }),
  )
  chimney.position.set(0.6, 2.15, -0.4)
  chimney.castShadow = true
  g.add(chimney)

  return g
}

/**
 * 程序化茅草屋。
 * 全部 metalness=0，flat tone mapping 已由 Canvas 统一处理。
 */
export default function Cottage() {
  const group = useMemo(() => buildCottage(), [])

  return (
    <group position={COTTAGE_POS}>
      <primitive object={group} />
    </group>
  )
}
