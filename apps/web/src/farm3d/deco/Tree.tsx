// 程序化低模树：圆柱树干 + 球形/椭圆树冠，toon 卡通材质。
// 替代 3.4MB trees.glb（5 棵节点合集），彻底消除网络加载。
// 5 种树形对应原 TREES 配置：
//   NormalTree_1：粗干 + 大圆冠
//   NormalTree_2：粗干 + 双层错位圆冠
//   NormalTree_3：高瘦型（细长干 + 椭圆冠）
//   NormalTree_4：矮小树苗型
import { useMemo } from 'react'
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  SphereGeometry,
} from 'three'
import { attachOutlineDeep, toon } from '../toon'

/** 树干棕色 */
const TRUNK_MAT = toon({ color: 0x5a3a20 })
/** 树冠深绿 */
const CROWN_DARK_MAT = toon({ color: 0x3a7a2a })
/** 树冠亮绿（NormalTree_2 双层上层的轻量感） */
const CROWN_LIGHT_MAT = toon({ color: 0x4a9a3a })

// 预设树形 builders
function buildNormalTree1(height: number): Group {
  const g = new Group()
  const scale = height / 1.7 // 基准 1.7m

  // 树干（圆柱）
  const trunk = new Mesh(
    new CylinderGeometry(0.12 * scale, 0.18 * scale, height * 0.45, 6),
    TRUNK_MAT,
  )
  trunk.position.y = height * 0.225
  trunk.castShadow = true
  g.add(trunk)

  // 树冠（大球）
  const crown = new Mesh(
    new SphereGeometry(0.55 * scale, 7, 5),
    CROWN_DARK_MAT,
  )
  crown.position.y = height * 0.7
  crown.castShadow = true
  g.add(crown)

  attachOutlineDeep(g)
  return g
}

function buildNormalTree2(height: number): Group {
  const g = new Group()
  const scale = height / 1.9

  // 树干（稍细）
  const trunk = new Mesh(
    new CylinderGeometry(0.1 * scale, 0.15 * scale, height * 0.4, 6),
    TRUNK_MAT,
  )
  trunk.position.y = height * 0.2
  trunk.castShadow = true
  g.add(trunk)

  // 下层树冠
  const crown1 = new Mesh(
    new SphereGeometry(0.5 * scale, 7, 5),
    CROWN_DARK_MAT,
  )
  crown1.position.y = height * 0.6
  crown1.scale.set(1, 0.85, 1)
  crown1.castShadow = true
  g.add(crown1)

  // 上层小树冠（错位亮绿色）
  const crown2 = new Mesh(
    new SphereGeometry(0.35 * scale, 7, 5),
    CROWN_LIGHT_MAT,
  )
  crown2.position.set(0.1 * scale, height * 0.88, -0.05 * scale)
  crown2.castShadow = true
  g.add(crown2)

  attachOutlineDeep(g)
  return g
}

function buildNormalTree3(height: number): Group {
  const g = new Group()
  const scale = height / 2.2

  // 高瘦树干
  const trunk = new Mesh(
    new CylinderGeometry(0.08 * scale, 0.12 * scale, height * 0.5, 6),
    TRUNK_MAT,
  )
  trunk.position.y = height * 0.25
  trunk.castShadow = true
  g.add(trunk)

  // 椭圆树冠（竖长）
  const crown = new Mesh(
    new SphereGeometry(0.5 * scale, 7, 5),
    CROWN_DARK_MAT,
  )
  crown.position.y = height * 0.75
  crown.scale.set(0.85, 1.2, 0.85)
  crown.castShadow = true
  g.add(crown)

  attachOutlineDeep(g)
  return g
}

function buildNormalTree4(height: number): Group {
  const g = new Group()
  // 矮小树苗
  const scale = height / 1.5

  // 细矮干
  const trunk = new Mesh(
    new CylinderGeometry(0.07 * scale, 0.1 * scale, height * 0.55, 5),
    TRUNK_MAT,
  )
  trunk.position.y = height * 0.275
  trunk.castShadow = true
  g.add(trunk)

  // 小圆冠
  const crown = new Mesh(
    new SphereGeometry(0.4 * scale, 6, 4),
    CROWN_DARK_MAT,
  )
  crown.position.y = height * 0.78
  crown.castShadow = true
  g.add(crown)

  attachOutlineDeep(g)
  return g
}

type TreeKind = 'NormalTree_1' | 'NormalTree_2' | 'NormalTree_3' | 'NormalTree_4'

const BUILDERS: Record<TreeKind, (h: number) => Group> = {
  NormalTree_1: buildNormalTree1,
  NormalTree_2: buildNormalTree2,
  NormalTree_3: buildNormalTree3,
  NormalTree_4: buildNormalTree4,
}

/**
 * 程序化低模树。
 * kind 决定树形；height 统一缩放；position 是地块坐标 [x, z]。
 * rotationY 绕 Y 轴旋转（弧度值）。
 */
export default function Tree({
  kind,
  height,
  position,
  rotationY,
}: {
  kind: TreeKind
  height: number
  position: [number, number]
  rotationY: number
}) {
  const group = useMemo(() => BUILDERS[kind](height), [kind, height])

  return (
    <group
      position={[position[0], 0, position[1]]}
      rotation-y={rotationY}
    >
      <primitive object={group} />
    </group>
  )
}
