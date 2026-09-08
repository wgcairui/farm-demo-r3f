// 石板路：从 cottage 正门延伸到栅栏缺口外。
// 参考 QQ 农场风格，boxGeometry（0.4×0.04×0.4）拼接，颜色 0xb8a888，微随机旋转 ±0.1 rad。
// 移动优先重做：cottage 搬到 (-4.5, 0, -6) 后，路径从 cottage 门口沿 +z 方向
// 斜走到栅栏缺口 (-2.35, 0, 0)。
// D12 第五轮：MeshLambertMaterial → toon() + 描边。
import { useMemo } from 'react'
import { BoxGeometry, Mesh, Group } from 'three'
import { attachOutlineDeep, toon } from '../toon'

const STONE_COLOR = 0xb8a888

/**
 * 6 块石板（全局坐标），从 cottage 门口 (-3.575, 0, -6) 沿 +z 斜走到栅栏缺口 (-2.35, 0, 0) 即止。
 *
 * 关键节点：
 *   - cottage 门口世界 (-3.575, 0, -6)
 *   - 栅栏缺口中心世界 (-2.35, 0, 0)
 *   - 末端石板 (-2.35, 0, -0.15)，缺口外侧（z<0 是 garden 外）
 */
const STONES: { x: number; z: number; rotY: number }[] = [
  { x: -3.55, z: -5.3, rotY: 0.05 },    // 门口外
  { x: -3.35, z: -4.2, rotY: -0.08 },
  { x: -3.05, z: -3.0, rotY: 0.12 },    // 沿 +z 走
  { x: -2.75, z: -1.8, rotY: -0.05 },
  { x: -2.55, z: -0.9, rotY: 0.09 },
  { x: -2.4, z: -0.15, rotY: -0.04 },  // 末端停在栅栏缺口外侧
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
