// 石板路：从 cottage 正门延伸到地块中央。
// 参考 QQ 农场风格，8 块 boxGeometry（0.4×0.04×0.4）拼接，颜色 0xb8a888，微随机旋转 ±0.1 rad。
// 路径基于全局坐标系：cotage 门在 (cottage.x, 0, cottage.z + 0.9)，朝 +x 方向延伸到地块 (0, 0, 0) 附近。
import { useMemo } from 'react'
import { BoxGeometry, Mesh, MeshLambertMaterial, Group } from 'three'

const STONE_COLOR = 0xb8a888

/**
 * 8 块石板（全局坐标），从 cottage 门口沿 -z 方向走到栅栏缺口（z≈0），
 * 然后穿过缺口沿 +x 方向进入 garden 边缘即止（不再延伸进地块）。
 *
 * D12 audit fix：原版最后 3 块石板与 plot 0 / plot 3 重叠（plot 0 中心 (-1.2, -0.6)，
 * plot 3 中心 (-1.2, 0.6)，半边距 0.51；旧版最后石板 x=-1.1 已深入 plot 3）。
 * 现在第 7/8 块停在 x=-2.05/-1.95（仍穿过缺口进 garden 0.4m），保留
 * 「L 形」自然走向但留出可种植空间。
 *
 * 关键节点：
 *   - cottage 门口世界 (-2.575, 0.06, 2.5)
 *   - 栅栏缺口中心世界 (-2.35, 0.06, 0)
 *   - 菜园入口内部 (-2.0, 0.06, 0)
 *   - 路径末端 (-1.95, 0.06, 0.05)（距 plot 0/3 边界 ≥0.24m 安全）
 */
const STONES: { x: number; z: number; rotY: number }[] = [
  { x: -2.4, z: 2.3, rotY: 0.05 },    // 门口外
  { x: -2.45, z: 1.8, rotY: -0.08 },
  { x: -2.5, z: 1.2, rotY: 0.12 },    // 沿 -z 走
  { x: -2.45, z: 0.6, rotY: -0.05 },  // 接近缺口
  { x: -2.35, z: 0.15, rotY: 0.09 },  // 缺口处（穿过栅栏）
  { x: -2.2, z: 0.0, rotY: -0.11 },   // 进入菜园，转 +x 方向
  { x: -2.05, z: 0.0, rotY: 0.04 },
  { x: -1.95, z: 0.05, rotY: -0.07 }, // 末端，距 plot 边界 ≥0.24m
]

function buildPath(): Group {
  const g = new Group()
  const geo = new BoxGeometry(0.4, 0.04, 0.4)
  const mat = new MeshLambertMaterial({ color: STONE_COLOR })

  for (const s of STONES) {
    const stone = new Mesh(geo, mat)
    stone.position.set(s.x, 0.06, s.z)
    stone.rotation.y = s.rotY
    stone.castShadow = true
    stone.receiveShadow = true
    g.add(stone)
  }

  return g
}

/**
 * 程序化石板路：从 cottage 门口延伸到地块中央。
 * 内部石头用全局坐标（已避开 cottage 主体和狗屋），组件根 group 在原点。
 */
export default function Path() {
  const group = useMemo(() => buildPath(), [])

  return <primitive object={group} />
}
