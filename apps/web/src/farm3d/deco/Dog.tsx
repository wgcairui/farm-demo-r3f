// 田园小狗：蹲姿柯基 + 静态放在狗屋旁 + 摇尾动画。
// 头大身小萌系，橘白配色；不再巡逻。
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  ConeGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  SphereGeometry,
} from 'three'
import { DOG_POS } from './Doghouse'

function buildDog(): Group {
  const g = new Group()

  const orangeMat = new MeshLambertMaterial({ color: 0xe8853a }) // 橘色（背/耳/后腿/尾巴）
  const whiteMat = new MeshLambertMaterial({ color: 0xf5ead0 }) // 白色（脸/胸/前腿）
  const darkMat = new MeshLambertMaterial({ color: 0x2a1a0a }) // 黑（鼻/眼瞳）
  const pinkMat = new MeshLambertMaterial({ color: 0xff9999 }) // 粉（舌头）

  // 后躯（坐姿：扁而宽）
  const hind = new Mesh(new BoxGeometry(0.35, 0.25, 0.45), orangeMat)
  hind.position.set(0, 0.22, -0.1)
  hind.castShadow = true
  g.add(hind)

  // 前胸（白色，从肚子延伸到胸口）
  const chest = new Mesh(new BoxGeometry(0.32, 0.28, 0.3), whiteMat)
  chest.position.set(0, 0.24, 0.15)
  chest.castShadow = true
  g.add(chest)

  // 头（大，圆润）—— 头是身宽的 ~1.2 倍以营造萌系
  const head = new Mesh(new BoxGeometry(0.4, 0.36, 0.38), orangeMat)
  head.position.set(0, 0.5, 0.32)
  head.castShadow = true
  g.add(head)

  // 脸下半部分（白色「脸罩」）
  const muzzle = new Mesh(new BoxGeometry(0.28, 0.18, 0.18), whiteMat)
  muzzle.position.set(0, 0.4, 0.5)
  g.add(muzzle)

  // 鼻子（黑色圆球）
  const nose = new Mesh(new SphereGeometry(0.04, 6, 6), darkMat)
  nose.position.set(0, 0.42, 0.6)
  g.add(nose)

  // 舌头（粉色小三角，从嘴下伸出）
  const tongue = new Mesh(new BoxGeometry(0.06, 0.04, 0.05), pinkMat)
  tongue.position.set(0, 0.34, 0.6)
  g.add(tongue)

  // 大眼睛（白色 + 黑瞳双层）
  const eyeWhiteL = new Mesh(new SphereGeometry(0.05, 6, 6), whiteMat)
  eyeWhiteL.position.set(-0.1, 0.55, 0.5)
  g.add(eyeWhiteL)
  const eyeWhiteR = new Mesh(new SphereGeometry(0.05, 6, 6), whiteMat)
  eyeWhiteR.position.set(0.1, 0.55, 0.5)
  g.add(eyeWhiteR)
  const pupilL = new Mesh(new SphereGeometry(0.025, 6, 6), darkMat)
  pupilL.position.set(-0.1, 0.55, 0.535)
  g.add(pupilL)
  const pupilR = new Mesh(new SphereGeometry(0.025, 6, 6), darkMat)
  pupilR.position.set(0.1, 0.55, 0.535)
  g.add(pupilR)

  // 耳朵（橘色三角，竖立略外倾）
  const earL = new Mesh(new ConeGeometry(0.06, 0.18, 4), orangeMat)
  earL.position.set(-0.15, 0.7, 0.28)
  earL.rotation.z = 0.25
  g.add(earL)
  const earR = new Mesh(new ConeGeometry(0.06, 0.18, 4), orangeMat)
  earR.position.set(0.15, 0.7, 0.28)
  earR.rotation.z = -0.25
  g.add(earR)

  // 前腿（白色，直立，蹲姿关键）
  const legGeo = new BoxGeometry(0.1, 0.22, 0.1)
  const frontLegL = new Mesh(legGeo, whiteMat)
  frontLegL.position.set(-0.13, 0.11, 0.25)
  frontLegL.castShadow = true
  g.add(frontLegL)
  const frontLegR = new Mesh(legGeo, whiteMat)
  frontLegR.position.set(0.13, 0.11, 0.25)
  frontLegR.castShadow = true
  g.add(frontLegR)

  // 后腿（折叠贴在身体两侧）
  const hindLegL = new Mesh(new BoxGeometry(0.1, 0.14, 0.18), orangeMat)
  hindLegL.position.set(-0.13, 0.07, -0.05)
  g.add(hindLegL)
  const hindLegR = new Mesh(new BoxGeometry(0.1, 0.14, 0.18), orangeMat)
  hindLegR.position.set(0.13, 0.07, -0.05)
  g.add(hindLegR)

  // 尾巴（小橘球，后翘）—— 标记 name='tail' 便于动画 ref 找到
  const tail = new Mesh(new SphereGeometry(0.07, 6, 6), orangeMat)
  tail.name = 'tail'
  tail.position.set(0, 0.32, -0.35)
  g.add(tail)

  return g
}

/**
 * 蹲姿柯基：静态蹲在狗屋旁，摇尾动画。
 * 位置由 DOG_POS 锚定（来自 Doghouse 模块）。
 */
export default function Dog() {
  const dog = useMemo(() => buildDog(), [])

  useFrame(({ clock }) => {
    // 摇尾：绕 y 轴小幅度摆动
    const t = clock.getElapsedTime()
    dog.traverse((obj) => {
      if (obj instanceof Mesh && obj.name === 'tail') {
        obj.rotation.y = Math.sin(t * 6) * 0.5
      }
    })
  })

  return (
    <group position={DOG_POS} scale={0.7} rotation={[0, Math.PI, 0]}>
      <primitive object={dog} />
    </group>
  )
}
