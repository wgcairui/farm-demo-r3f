// 石板路：从 cottage 正门延伸到地块中央。
// 参考 QQ 农场风格，8 块 boxGeometry（0.4×0.04×0.4）拼接，颜色 0xb8a888，微随机旋转 ±0.1 rad。
// 路径基于全局坐标系：cotage 门在 (cottage.x, 0, cottage.z + 0.9)，朝 +x 方向延伸到地块 (0, 0, 0) 附近。
import { useMemo } from 'react'
import { BoxGeometry, Mesh, MeshLambertMaterial, Group } from 'three'

const STONE_COLOR = 0xb8a888

/**
 * 9 块石板（全局坐标），从 cottage 门口沿 -z 方向走到栅栏缺口（z≈0），
 * 然后穿过缺口沿 +x 方向进入菜园。
 *
 * 关键节点：
 *   - cottage 门口世界 (-2.575, 0.06, 2.5)
 *   - 栅栏缺口中心世界 (-2.35, 0.06, 0)（左侧 x=-2.35，i=1 段已去掉）
 *   - 菜园入口内部 (-1.5, 0.06, 0.05)
 *   - 终止于菜园地块中央侧 (-1.05, 0.06, 0.4)
 *
 * 路径呈「L 形」自然走向：门口沿 -z 走到栅栏 → 穿过缺口 → +x 进入菜园。
 * 中段绕开 dog（DOG_POS 在 -1.4, 3.2）和 doghouse（DOGHOUSE_POS 在 -0.3, 3.8）。
 */
const STONES: { x: number; z: number; rotY: number }[] = [
  { x: -2.4, z: 2.3, rotY: 0.05 },   // 门口外
  { x: -2.45, z: 1.8, rotY: -0.08 },
  { x: -2.5, z: 1.2, rotY: 0.12 },   // 沿 -z 走
  { x: -2.45, z: 0.6, rotY: -0.05 }, // 接近缺口
  { x: -2.35, z: 0.15, rotY: 0.09 }, // 缺口处（穿过栅栏）
  { x: -2.0, z: 0.05, rotY: -0.11 }, // 进入菜园，转 +x 方向
  { x: -1.7, z: 0.05, rotY: 0.04 },
  { x: -1.4, z: 0.15, rotY: -0.07 },
  { x: -1.1, z: 0.35, rotY: 0.05 },  // 菜园地块中央侧
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
