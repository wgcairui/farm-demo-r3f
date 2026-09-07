// P2-3 程序化装饰摆件：风车 / 稻草人 / 木桶 / 木栅栏。
// 完全程序化几何体（无 GLB），toon 卡通材质 + inverted-hull outline。
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  SphereGeometry,
} from 'three'
import { attachOutlineDeep, toon, toonGradient } from '../toon'
import type { DecorationKind } from '../decorations'

// —— 材质单例（模块级复用，避免每帧 new）——

const WOOD_MAT = toon({ color: 0x8b6914 })
const WOOD_DARK_MAT = toon({ color: 0x5a3a10 })
const STRAW_MAT = toon({ color: 0xd4a017 })
const PUMPKIN_MAT = toon({ color: 0xe07820 })
const PUMPKIN_DARK_MAT = toon({ color: 0xb85c10 })
const BARREL_MAT = toon({ color: 0x9b6b2a })
const BAND_MAT = toon({ color: 0x4a3010 })
const FENCE_MAT = toon({ color: 0xa07840 })

// —— 风车 ——

/** 旋转叶片组件（接受外部 group ref，叶片绕 Z 轴旋转） */
function WindmillBlades({ blades }: { blades: Group }) {
  useFrame((_, dt) => {
    blades.rotation.z += (Math.PI * 2 / 1.5) * dt // 1.5s/圈
  })
  return null
}

function buildWindmill(): Group {
  const root = new Group()

  // 圆柱杆
  const pole = new Mesh(new CylinderGeometry(0.06, 0.1, 1.4, 8), WOOD_MAT.clone())
  pole.position.y = 0.7
  pole.castShadow = true
  root.add(pole)

  // 叶片hub（中心小圆柱）
  const hub = new Mesh(new CylinderGeometry(0.07, 0.07, 0.06, 8), WOOD_DARK_MAT.clone())
  hub.position.y = 1.45
  hub.castShadow = true
  root.add(hub)

  // 4 片叶片
  const blades = new Group()
  blades.position.y = 1.45
  for (let i = 0; i < 4; i++) {
    const blade = new Mesh(new BoxGeometry(0.12, 0.7, 0.04), STRAW_MAT.clone())
    blade.position.y = 0.35
    blade.rotation.z = (i * Math.PI) / 2
    blade.castShadow = true
    blades.add(blade)
  }
  root.add(blades)

  attachOutlineDeep(root)
  return root
}

function WindmillDecoration({ position, rotationY }: { position: [number, number]; rotationY: number }) {
  const group = useMemo(() => buildWindmill(), [])
  // 叶片子 group 需要持续旋转，单独建 ref
  const bladesRef = useRef<Group>(null)
  const bladesGroup = useMemo(() => {
    // 从 group 中找叶片（blades 是 root 的子 group，index 2）
    const blades = group.children[2] as Group
    return blades
  }, [group])

  useFrame((_, dt) => {
    if (bladesGroup) bladesGroup.rotation.z += (Math.PI * 2 / 1.5) * dt
  })

  return (
    <group position={[position[0], 0.02, position[1]]} rotation-y={rotationY}>
      <primitive object={group} />
    </group>
  )
}

// —— 稻草人 ——

function buildScarecrow(): Group {
  const root = new Group()

  // 竖杆
  const vPole = new Mesh(new CylinderGeometry(0.045, 0.065, 1.6, 6), WOOD_MAT.clone())
  vPole.position.y = 0.8
  vPole.castShadow = true
  root.add(vPole)

  // 横杆（双臂）
  const hPole = new Mesh(new CylinderGeometry(0.035, 0.035, 1.0, 6), WOOD_MAT.clone())
  hPole.position.y = 1.15
  hPole.rotation.z = Math.PI / 2
  hPole.castShadow = true
  root.add(hPole)

  // 南瓜头
  const head = new Mesh(new SphereGeometry(0.18, 8, 6), PUMPKIN_MAT.clone())
  head.position.y = 1.7
  head.castShadow = true
  root.add(head)

  // 南瓜脸上的深色斑块（左/右/下三块）
  const eye1 = new Mesh(new SphereGeometry(0.05, 6, 4), PUMPKIN_DARK_MAT.clone())
  eye1.position.set(-0.07, 1.73, 0.15)
  root.add(eye1)
  const eye2 = new Mesh(new SphereGeometry(0.05, 6, 4), PUMPKIN_DARK_MAT.clone())
  eye2.position.set(0.07, 1.73, 0.15)
  root.add(eye2)
  const mouth = new Mesh(new SphereGeometry(0.07, 6, 4), PUMPKIN_DARK_MAT.clone())
  mouth.position.set(0, 1.62, 0.15)
  mouth.scale.set(1.2, 0.6, 0.8)
  root.add(mouth)

  // 小帽子（截头圆锥 + 帽檐）
  const hat = new Mesh(new CylinderGeometry(0.12, 0.14, 0.22, 8), WOOD_DARK_MAT.clone())
  hat.position.y = 1.92
  hat.castShadow = true
  root.add(hat)
  const brim = new Mesh(new CylinderGeometry(0.2, 0.2, 0.04, 8), WOOD_DARK_MAT.clone())
  brim.position.y = 1.83
  brim.castShadow = true
  root.add(brim)

  // 草帽顶（麦秆色帽冠，略倾斜）
  const strawHat = new Mesh(new CylinderGeometry(0.16, 0.19, 0.1, 8), STRAW_MAT.clone())
  strawHat.position.y = 2.03
  strawHat.rotation.z = 0.1
  strawHat.castShadow = true
  root.add(strawHat)

  attachOutlineDeep(root)
  return root
}

function ScarecrowDecoration({ position, rotationY }: { position: [number, number]; rotationY: number }) {
  const group = useMemo(() => buildScarecrow(), [])
  return (
    <group position={[position[0], 0.02, position[1]]} rotation-y={rotationY}>
      <primitive object={group} />
    </group>
  )
}

// —— 木桶 ——

function buildBarrel(): Group {
  const root = new Group()

  // 桶身（圆柱）
  const body = new Mesh(new CylinderGeometry(0.26, 0.22, 0.55, 12), BARREL_MAT.clone())
  body.position.y = 0.275
  body.castShadow = true
  root.add(body)

  // 顶部椭圆盖
  const top = new Mesh(new CylinderGeometry(0.26, 0.26, 0.04, 12), WOOD_DARK_MAT.clone())
  top.position.y = 0.56
  top.castShadow = true
  root.add(top)

  // 底部
  const bottom = new Mesh(new CylinderGeometry(0.22, 0.22, 0.04, 12), WOOD_DARK_MAT.clone())
  bottom.position.y = 0.02
  root.add(bottom)

  // 2 道铁箍
  for (let i = 0; i < 2; i++) {
    const band = new Mesh(new CylinderGeometry(0.275, 0.275, 0.05, 12), BAND_MAT.clone())
    band.position.y = 0.2 + i * 0.25
    band.castShadow = true
    root.add(band)
  }

  attachOutlineDeep(root)
  return root
}

function BarrelDecoration({ position, rotationY }: { position: [number, number]; rotationY: number }) {
  const group = useMemo(() => buildBarrel(), [])
  return (
    <group position={[position[0], 0.02, position[1]]} rotation-y={rotationY}>
      <primitive object={group} />
    </group>
  )
}

// —— 木栅栏（程序化：横木 + 2 立柱）——

function buildFence(): Group {
  const root = new Group()

  // 左侧立柱
  const post1 = new Mesh(new BoxGeometry(0.08, 0.9, 0.08), FENCE_MAT.clone())
  post1.position.set(-0.5, 0.45, 0)
  post1.castShadow = true
  root.add(post1)

  // 右侧立柱
  const post2 = new Mesh(new BoxGeometry(0.08, 0.9, 0.08), FENCE_MAT.clone())
  post2.position.set(0.5, 0.45, 0)
  post2.castShadow = true
  root.add(post2)

  // 上横木
  const topBeam = new Mesh(new BoxGeometry(1.16, 0.1, 0.07), WOOD_MAT.clone())
  topBeam.position.y = 0.72
  topBeam.castShadow = true
  root.add(topBeam)

  // 下横木
  const botBeam = new Mesh(new BoxGeometry(1.16, 0.1, 0.07), WOOD_MAT.clone())
  botBeam.position.y = 0.32
  botBeam.castShadow = true
  root.add(botBeam)

  // 中间小斜撑（装饰）
  const brace = new Mesh(new BoxGeometry(0.07, 0.35, 0.06), WOOD_DARK_MAT.clone())
  brace.position.set(0, 0.52, 0)
  brace.rotation.z = 0.3
  brace.castShadow = true
  root.add(brace)

  attachOutlineDeep(root)
  return root
}

function FenceDecoration({ position, rotationY }: { position: [number, number]; rotationY: number }) {
  const group = useMemo(() => buildFence(), [])
  return (
    <group position={[position[0], 0.02, position[1]]} rotation-y={rotationY}>
      <primitive object={group} />
    </group>
  )
}

// —— 单个摆件渲染器 ——

function DecorationItem({
  kind,
  position,
  rotationY,
}: {
  kind: DecorationKind
  position: [number, number]
  rotationY: number
}) {
  switch (kind) {
    case 'windmill':
      return <WindmillDecoration position={position} rotationY={rotationY} />
    case 'scarecrow':
      return <ScarecrowDecoration position={position} rotationY={rotationY} />
    case 'barrel':
      return <BarrelDecoration position={position} rotationY={rotationY} />
    case 'fence':
      return <FenceDecoration position={position} rotationY={rotationY} />
    default:
      return null
  }
}

export default DecorationItem
