// 仓库：木墙 + 茅草顶 + 大双木门（贴 cottage 风格但更敦实）。
// 位置：[-3.5, 0, -2.5]，cottage 正后方，与 cottage 形成对景。
// 程序化几何体（参考 Cottage.tsx 模式），无 GLB 依赖。
import { useMemo } from 'react'
import {
  BoxGeometry,
  ConeGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  SphereGeometry,
} from 'three'

/** 仓库位置：cotage 正后方（z=-2.5），整体旋转 +90° 让门朝 +x 朝 cottage */
export const WAREHOUSE_POS: [number, number, number] = [-3.5, 0, -2.5]

function buildWarehouse(): Group {
  const g = new Group()

  // 材质（比 cottage 略深的木墙色，凸显仓库敦实感）
  const wallMat = new MeshLambertMaterial({ color: 0xb8924a }) // 暗木色
  const roofMat = new MeshLambertMaterial({ color: 0x8b6914 }) // 茅草顶（同 cottage）
  const doorMat = new MeshLambertMaterial({ color: 0x4a2c10 }) // 深棕大门
  const seamMat = new MeshLambertMaterial({ color: 0x1a0a00 }) // 门缝黑线
  const signMat = new MeshLambertMaterial({ color: 0xf5e6a8 }) // 浅黄牌匾
  const baseMat = new MeshLambertMaterial({ color: 0x8a6a4a }) // 底座深石色
  const windowMat = new MeshLambertMaterial({
    color: 0xaad4ff,
    transparent: true,
    opacity: 0.6,
  }) // 天光蓝半透明

  // 底座（2.6w × 0.08h × 2.2d，比 cottage 大）
  const base = new Mesh(new BoxGeometry(2.6, 0.08, 2.2), baseMat)
  base.position.y = 0.04
  base.castShadow = true
  base.receiveShadow = true
  g.add(base)

  // 主体墙（2.4w × 1.2h × 2.0d，矮宽敦实）
  const wall = new Mesh(new BoxGeometry(2.4, 1.2, 2.0), wallMat)
  wall.position.y = 0.68 // 底座 0.08 + 半高 0.6
  wall.castShadow = true
  wall.receiveShadow = true
  g.add(wall)

  // 双木门（左扇 + 右扇，中间黑门缝）
  const doorL = new Mesh(new BoxGeometry(0.48, 0.85, 0.05), doorMat)
  doorL.position.set(-0.25, 0.485, 1.025)
  doorL.castShadow = true
  g.add(doorL)
  const doorR = new Mesh(new BoxGeometry(0.48, 0.85, 0.05), doorMat)
  doorR.position.set(0.25, 0.485, 1.025)
  doorR.castShadow = true
  g.add(doorR)
  // 门缝（细黑条）
  const seam = new Mesh(new BoxGeometry(0.04, 0.85, 0.06), seamMat)
  seam.position.set(0, 0.485, 1.025)
  g.add(seam)
  // 门把手（两个浅色圆球）
  const knobL = new Mesh(new SphereGeometry(0.04, 6, 6), signMat)
  knobL.position.set(-0.1, 0.5, 1.06)
  g.add(knobL)
  const knobR = new Mesh(new SphereGeometry(0.04, 6, 6), signMat)
  knobR.position.set(0.1, 0.5, 1.06)
  g.add(knobR)

  // 三角屋顶（4 段锥，比 cottage 矮）
  const roof = new Mesh(new ConeGeometry(1.8, 0.7, 4), roofMat)
  roof.position.y = 1.6
  roof.rotation.y = Math.PI / 4
  roof.castShadow = true
  g.add(roof)

  // 牌匾（门上方，浅黄板）
  const sign = new Mesh(new BoxGeometry(0.5, 0.3, 0.05), signMat)
  sign.position.set(0, 1.0, 1.025)
  g.add(sign)

  // 通风窗（左右各一）
  const winL = new Mesh(new BoxGeometry(0.3, 0.3, 0.05), windowMat)
  winL.position.set(-0.85, 0.9, 1.025)
  g.add(winL)
  const winR = new Mesh(new BoxGeometry(0.3, 0.3, 0.05), windowMat)
  winR.position.set(0.85, 0.9, 1.025)
  g.add(winR)

  return g
}

/**
 * 程序化仓库。
 * 全部 metalness=0，flat tone mapping 已由 Canvas 统一处理。
 * 整体绕 y 轴旋转 +90°，让门朝 +x（朝 cottage / 菜园方向）。
 */
export default function Warehouse() {
  const group = useMemo(() => buildWarehouse(), [])

  return (
    <group position={WAREHOUSE_POS} rotation={[0, Math.PI / 2, 0]}>
      <primitive object={group} />
    </group>
  )
}
