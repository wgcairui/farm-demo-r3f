// 石板路：从 cottage 正门延伸到栅栏缺口外。
// 参考 QQ 农场风格，boxGeometry（0.4×0.04×0.4）拼接，颜色 0xb8a888，微随机旋转 ±0.1 rad。
// 路径基于全局坐标系：cottage 门在 (-2.575, 0, 2.5)，朝 -z 走到栅栏缺口 (-2.35, 0, 0) 即止。
// D12 第五轮：MeshLambertMaterial → toon() + 描边。
import { useMemo } from 'react'
import { BoxGeometry, Mesh, Group } from 'three'
import { attachOutlineDeep, toon } from '../toon'

const STONE_COLOR = 0xb8a888

/**
 * 5 块石板（全局坐标），从 cottage 门口沿 -z 方向走到栅栏缺口外侧即止。
 *
 * D12 第二轮：旧版 8 块石板的最后 3 块（x=-2.2, -2.05, -1.95）从栅栏缺口进菜园，
 * 视觉上被 plot dirt 行"侵入"（dirt 模型垄半边 ~0.6 超出几何半边 0.51，
 * 行覆盖到 z=±0.6 附近把石板包住）。菜园内部本应留作可种植空间，
 * 石板从缺口外停下来更自然——保留「门口→缺口」直线段，省掉穿缺口的多余。
 *
 * 关键节点：
 *   - cottage 门口世界 (-2.575, 0, 2.5)
 *   - 栅栏缺口中心世界 (-2.35, 0, 0)
 *   - 末端石板 (-2.35, 0, 0.15)，缺口外侧 z=+0.15
 */
const STONES: { x: number; z: number; rotY: number }[] = [
  { x: -2.4, z: 2.3, rotY: 0.05 },    // 门口外
  { x: -2.45, z: 1.8, rotY: -0.08 },
  { x: -2.5, z: 1.2, rotY: 0.12 },    // 沿 -z 走
  { x: -2.45, z: 0.6, rotY: -0.05 },  // 接近缺口
  { x: -2.35, z: 0.15, rotY: 0.09 },  // 末端停在栅栏缺口外侧（z>0 是 garden 外）
]

function buildPath(): Group {
  const g = new Group()
  const geo = new BoxGeometry(0.4, 0.04, 0.4)
  const mat = toon({ color: STONE_COLOR })

  for (const s of STONES) {
    const stone = new Mesh(geo, mat)
    stone.position.set(s.x, 0.06, s.z)
    stone.rotation.y = s.rotY
    stone.castShadow = true
    stone.receiveShadow = true
    g.add(stone)
  }

  // inverted-hull 描边
  attachOutlineDeep(g)

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
