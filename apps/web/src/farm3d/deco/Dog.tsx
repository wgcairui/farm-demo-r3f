// 田园巡逻犬：程序化低模几何体 + 沿椭圆路径巡逻动画。
// poly.pizza dog 模型页 404（ID 9y3D6EXdq9 已失效），使用程序化几何体替代。
// 巡逻路径见 deco/motion.ts DOG_PATH。
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Mesh, MeshLambertMaterial, BoxGeometry, SphereGeometry } from 'three'
import { DOG_PATH } from './motion'

function buildDog(): Group {
  const g = new Group()

  const bodyMat = new MeshLambertMaterial({ color: 0xc8824a }) // 棕色犬身
  const darkMat = new MeshLambertMaterial({ color: 0x7a4a2a }) // 深棕（耳朵/尾巴）
  const eyeMat = new MeshLambertMaterial({ color: 0x1a1a1a }) // 黑眼珠

  // 身体（扁椭圆 box）
  const body = new Mesh(new BoxGeometry(0.5, 0.28, 0.75), bodyMat)
  body.position.y = 0.18
  body.castShadow = true
  g.add(body)

  // 头部（略方）
  const head = new Mesh(new BoxGeometry(0.32, 0.28, 0.3), bodyMat)
  head.position.set(0, 0.32, 0.46)
  head.castShadow = true
  g.add(head)

  // 鼻子
  const nose = new Mesh(new SphereGeometry(0.04, 4, 4), new MeshLambertMaterial({ color: 0x2a1a0a }))
  nose.position.set(0, 0.28, 0.63)
  g.add(nose)

  // 左眼
  const eyeL = new Mesh(new SphereGeometry(0.04, 4, 4), eyeMat)
  eyeL.position.set(-0.1, 0.36, 0.6)
  g.add(eyeL)

  // 右眼
  const eyeR = new Mesh(new SphereGeometry(0.04, 4, 4), eyeMat)
  eyeR.position.set(0.1, 0.36, 0.6)
  g.add(eyeR)

  // 左耳（三角，方块旋转斜切）
  const earL = new Mesh(new BoxGeometry(0.1, 0.15, 0.05), darkMat)
  earL.position.set(-0.18, 0.48, 0.42)
  earL.rotation.z = -0.2
  g.add(earL)

  // 右耳
  const earR = new Mesh(new BoxGeometry(0.1, 0.15, 0.05), darkMat)
  earR.position.set(0.18, 0.48, 0.42)
  earR.rotation.z = 0.2
  g.add(earR)

  // 腿 ×4（前宽后窄，前腿略高）
  const legGeo = new BoxGeometry(0.1, 0.22, 0.1)
  const legPositions: [number, number, number][] = [
    [-0.18, 0.07, 0.25],
    [0.18, 0.07, 0.25],
    [-0.18, 0.07, -0.25],
    [0.18, 0.07, -0.25],
  ]
  for (const pos of legPositions) {
    const leg = new Mesh(legGeo, bodyMat)
    leg.position.set(...pos)
    leg.castShadow = true
    g.add(leg)
  }

  // 尾巴（后面翘起）
  const tail = new Mesh(new BoxGeometry(0.07, 0.18, 0.07), darkMat)
  tail.position.set(0, 0.28, -0.42)
  tail.rotation.x = -0.6
  g.add(tail)

  return g
}

/**
 * 巡逻犬：程序化几何体 + 沿 DOG_PATH 椭圆巡逻。
 * 头部朝向运动切线方向（faceTangent）。
 */
export default function Dog() {
  const groupRef = useRef<Group>(null)
  const dogGroup = useRef<Group>(null)

  // 一次性构建模型
  const dog = buildDog()

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    const angle = (t * (Math.PI * 2)) / DOG_PATH.periodS

    // 椭圆参数方程
    const x = DOG_PATH.centerX + DOG_PATH.radiusX * Math.cos(angle)
    const z = DOG_PATH.centerZ + DOG_PATH.radiusZ * Math.sin(angle)
    groupRef.current.position.set(x, 0, z)

    // 朝向切线方向（负梯度的角度 = 速度方向）
    if (DOG_PATH.faceTangent) {
      const tangentAngle = Math.atan2(
        -DOG_PATH.radiusX * Math.sin(angle),
        DOG_PATH.radiusZ * Math.cos(angle),
      )
      groupRef.current.rotation.y = tangentAngle
    }
  })

  return (
    <group ref={groupRef}>
      <primitive ref={dogGroup} object={dog} />
    </group>
  )
}
