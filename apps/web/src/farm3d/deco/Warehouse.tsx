// 仓库：木墙 + 茅草顶 + 大双木门（贴 cottage 风格但更敦实）。
// D12 audit fix：原版位置 [-3.5, 0, -2.5] 与 cottage 同 x 线，被 cottage 挡住；
// 挪到 [-1.5, 0, -3.0]（向 +x 偏 2m，z 后移 0.5m 留出与背栏的缓冲）。
// NormalTree_1 已从 (-0.3, -3.6) 挪到 (1.0, -3.6) 避让。
// D12 second pass：warehouse footprint 2.6×2.2，z 中心 -3.0 → z∈[-4.1, -1.9]，
// 背栏 z=-1.7，仓库近墙 z=-1.9 距栏 0.2m，干净不穿模。
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

/** 仓库位置：cotage 偏 +x 后方（z=-3.0，留 0.3m 缓冲与背栏），整体旋转 +90° 让门朝 +x 朝 garden */
export const WAREHOUSE_POS: [number, number, number] = [-1.5, 0, -3.0]

function buildWarehouse(): Group {
  const g = new Group()

  // D12 audit fix：仓库视觉差异化
  //   - 墙体颜色加深（0xb8924a → 0x8a6a3a）凸显陈旧感
  //   - 山墙屋顶（双坡）取代 4 段锥，明显区别于 cottage 的金字塔顶
  //   - 横向通风缝取代窗（仓库通风而非采光）
  //   - 木板墙（外贴竖向板条）取代纯色 box
  //   - 门加铁铰链（4 个小黑盒）
  const wallMat = new MeshLambertMaterial({ color: 0x8a6a3a }) // 深陈旧木色（区别 cottage 0xd4a96a）
  const plankMat = new MeshLambertMaterial({ color: 0x6e4f2a }) // 竖向板条更深一档
  const roofMat = new MeshLambertMaterial({ color: 0x6b4a18 }) // 暗灰棕茅草（区别 cottage 0x8b6914）
  const doorMat = new MeshLambertMaterial({ color: 0x3d2008 }) // 更深大门
  const seamMat = new MeshLambertMaterial({ color: 0x1a0a00 }) // 门缝
  const signMat = new MeshLambertMaterial({ color: 0xe8c878 }) // 牌匾偏赭
  const baseMat = new MeshLambertMaterial({ color: 0x6a5238 }) // 底座更暗
  const ventMat = new MeshLambertMaterial({ color: 0x111111 }) // 通风缝几乎全黑
  const hingeMat = new MeshLambertMaterial({ color: 0x222222 }) // 铁铰链黑

  // 底座（2.6w × 0.08h × 2.2d）
  const base = new Mesh(new BoxGeometry(2.6, 0.08, 2.2), baseMat)
  base.position.y = 0.04
  base.castShadow = true
  base.receiveShadow = true
  g.add(base)

  // 主体墙（2.4w × 1.2h × 2.0d）
  const wall = new Mesh(new BoxGeometry(2.4, 1.2, 2.0), wallMat)
  wall.position.y = 0.68
  wall.castShadow = true
  wall.receiveShadow = true
  g.add(wall)

  // 竖向木板条（前墙 z=1.025，5 条均匀分布，模拟拼接墙）
  // 在主墙前面贴 6 条窄条（沿 x 方向 -1.1..1.1，间隔 0.44）
  const plankGeo = new BoxGeometry(0.06, 1.0, 0.02)
  for (let i = -2; i <= 2; i++) {
    // 跳过中间留门缝位置
    if (i === 0) continue
    const plank = new Mesh(plankGeo, plankMat)
    plank.position.set(i * 0.45, 0.6, 1.012)
    g.add(plank)
  }
  // 侧墙竖向板条（沿 z 方向）
  const sidePlankGeo = new BoxGeometry(0.02, 1.0, 0.06)
  for (let side = -1; side <= 1; side += 2) {
    for (let i = -2; i <= 2; i++) {
      const plank = new Mesh(sidePlankGeo, plankMat)
      plank.position.set(side * 1.212, 0.6, i * 0.4)
      g.add(plank)
    }
  }

  // 双木门（左扇 + 右扇，中间黑门缝）
  const doorL = new Mesh(new BoxGeometry(0.45, 0.85, 0.05), doorMat)
  doorL.position.set(-0.24, 0.485, 1.025)
  doorL.castShadow = true
  g.add(doorL)
  const doorR = new Mesh(new BoxGeometry(0.45, 0.85, 0.05), doorMat)
  doorR.position.set(0.24, 0.485, 1.025)
  doorR.castShadow = true
  g.add(doorR)
  // 门缝
  const seam = new Mesh(new BoxGeometry(0.04, 0.85, 0.06), seamMat)
  seam.position.set(0, 0.485, 1.025)
  g.add(seam)
  // 铁铰链（4 个：每个门上下各一）
  const hingeGeo = new BoxGeometry(0.08, 0.05, 0.04)
  for (const x of [-0.4, 0.4]) {
    for (const y of [0.2, 0.78]) {
      const h = new Mesh(hingeGeo, hingeMat)
      h.position.set(x, y, 1.04)
      g.add(h)
    }
  }
  // 门闩（中央黑色横条）
  const latch = new Mesh(new BoxGeometry(0.06, 0.5, 0.03), hingeMat)
  latch.position.set(0, 0.45, 1.055)
  g.add(latch)

  // 山墙屋顶（双坡）：两个斜置 box 拼成「人」字顶
  // 屋脊高度 1.55，屋檐高度 1.28，宽度 2.6
  const roofPanelGeo = new BoxGeometry(2.6, 0.04, 1.0)
  const roofL = new Mesh(roofPanelGeo, roofMat)
  roofL.position.set(0, 1.4, 0.55) // 前坡
  roofL.rotation.x = -Math.PI / 6
  roofL.castShadow = true
  g.add(roofL)
  const roofR = new Mesh(roofPanelGeo, roofMat)
  roofR.position.set(0, 1.4, -0.55) // 后坡
  roofR.rotation.x = Math.PI / 6
  roofR.castShadow = true
  g.add(roofR)
  // 山墙三角封板（两侧 x 平面，挡屋顶和墙之间的缝）
  const gableGeo = new BoxGeometry(0.02, 0.55, 1.1)
  for (const side of [-1, 1]) {
    const gable = new Mesh(gableGeo, wallMat)
    gable.position.set(side * 1.21, 1.42, 0)
    g.add(gable)
  }
  // 屋脊横木
  const ridge = new Mesh(new BoxGeometry(2.6, 0.05, 0.08), roofMat)
  ridge.position.set(0, 1.66, 0)
  g.add(ridge)

  // 牌匾（门上方，木色横匾，比 cottage 略宽）
  const sign = new Mesh(new BoxGeometry(0.7, 0.28, 0.05), signMat)
  sign.position.set(0, 1.05, 1.025)
  g.add(sign)
  // 牌匾边框（深色细线）
  const signBorder = new Mesh(new BoxGeometry(0.74, 0.32, 0.04), hingeMat)
  signBorder.position.set(0, 1.05, 1.018)
  g.add(signBorder)

  // 横向通风缝（前墙，左右各 2 条窄横缝，区别 cottage 的正方形窗）
  // 用 4 个细长 box 模拟百叶窗式通风口
  const ventHGeo = new BoxGeometry(0.5, 0.04, 0.02)
  for (const x of [-0.7, 0.7]) {
    for (const y of [0.85, 0.95]) {
      const v = new Mesh(ventHGeo, ventMat)
      v.position.set(x, y, 1.025)
      g.add(v)
    }
  }
  // 侧墙通风缝（左右各 2 条）
  const ventVGeo = new BoxGeometry(0.02, 0.04, 0.5)
  for (const side of [-1, 1]) {
    for (const y of [0.85, 0.95]) {
      const v = new Mesh(ventVGeo, ventMat)
      v.position.set(side * 1.22, y, 0)
      g.add(v)
    }
  }

  // 木桩支撑（前墙两侧 4 根粗柱，加强「仓库敦实」感）
  const postGeo = new BoxGeometry(0.12, 1.4, 0.12)
  const postMat = new MeshLambertMaterial({ color: 0x4a2c10 })
  for (const x of [-1.15, 1.15]) {
    for (const z of [-1.05, 1.05]) {
      const post = new Mesh(postGeo, postMat)
      post.position.set(x, 0.78, z)
      post.castShadow = true
      g.add(post)
    }
  }

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
