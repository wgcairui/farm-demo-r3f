// 石板路：从 cottage 正门延伸到地块中央。
// 参考 QQ 农场风格，8 块 boxGeometry（0.4×0.04×0.4）拼接，颜色 0xb8a888，微随机旋转 ±0.1 rad。
// 路径基于全局坐标系：cotage 门在 (cottage.x, 0, cottage.z + 0.9)，朝 +x 方向延伸到地块 (0, 0, 0) 附近。
import { useMemo } from 'react'
import { BoxGeometry, Mesh, MeshLambertMaterial, Group } from 'three'

const STONE_COLOR = 0xb8a888

/**
 * 8 块石板的路径点（全局坐标）。
 * cottage 门朝 +x 方向（cottage 旋转 -90° 后），门在世界 (-2.575, 0, 2.5)。
 * 石板从门口沿 +x 方向延伸到地块 (-1.0, 0, 0.2)。
 * 中段绕开 dog（DOG_POS 在 -1.0, 2.5）和 doghouse（DOGHOUSE_POS 在 -0.3, 3.3）。
 */
const STONES: { x: number; z: number; rotY: number }[] = [
  { x: -2.3, z: 2.5, rotY: 0.05 },
  { x: -2.0, z: 2.4, rotY: -0.08 },
  { x: -1.7, z: 2.2, rotY: 0.12 },
  { x: -1.5, z: 1.9, rotY: -0.05 },
  { x: -1.3, z: 1.5, rotY: 0.09 },
  { x: -1.2, z: 1.1, rotY: -0.11 },
  { x: -1.1, z: 0.7, rotY: 0.04 },
  { x: -1.0, z: 0.3, rotY: -0.07 },
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
