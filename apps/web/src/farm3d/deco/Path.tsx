// 石板路：从 cottage 门口到地块中央区域。
// 8 块 boxGeometry（0.4×0.04×0.4）拼接，颜色 0xb8a888，微随机旋转 ±0.1 rad。
import { useMemo } from 'react'
import { BoxGeometry, Mesh, MeshLambertMaterial, Group } from 'three'
import { COTTAGE_POS } from './Cottage'

const STONE_COLOR = 0xb8a888

/** 8 块石板的路径点（从 cottage 门口朝场内） */
const STONES: { dx: number; dz: number; rotY: number }[] = [
  { dx: 0.4, dz: 0.8, rotY: 0.05 },
  { dx: 0.8, dz: 1.1, rotY: -0.08 },
  { dx: 1.3, dz: 1.3, rotY: 0.12 },
  { dx: 1.9, dz: 1.4, rotY: -0.05 },
  { dx: 2.4, dz: 1.3, rotY: 0.09 },
  { dx: 2.8, dz: 1.0, rotY: -0.11 },
  { dx: 3.1, dz: 0.6, rotY: 0.04 },
  { dx: 3.4, dz: 0.2, rotY: -0.07 },
]

function buildPath(): Group {
  const g = new Group()
  const geo = new BoxGeometry(0.4, 0.04, 0.4)
  const mat = new MeshLambertMaterial({ color: STONE_COLOR })

  for (const s of STONES) {
    const stone = new Mesh(geo, mat)
    stone.position.set(COTTAGE_POS[0] + s.dx, 0.02, COTTAGE_POS[2] + s.dz)
    stone.rotation.y = s.rotY
    stone.castShadow = true
    stone.receiveShadow = true
    g.add(stone)
  }

  return g
}

/**
 * 程序化石板路：从 cottage 门口延伸到地块中央。
 */
export default function Path() {
  const group = useMemo(() => buildPath(), [])

  return <primitive object={group} />
}
