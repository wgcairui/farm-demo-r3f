// 田园小狗：蹲姿柯基 + 门口定点踱步 + 摇尾 + 四腿错相步态 + 躯干微浮。
// 头大身小萌系，橘白配色；位置在 DOG_POS 附近 ±ampX 范围内 6s 一个来回。
// 朝向用 cos 微摆叠加在 Math.PI/2 基础朝向上，避免硬翻。
// D12 第五轮：MeshLambertMaterial → toon() + 描边。
// P2-x 升级：定点踱步（腿步态 + 摆头 + 躯干微浮）。
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  ConeGeometry,
  Group,
  Mesh,
  SphereGeometry,
} from 'three'
import { attachOutlineDeep, toon } from '../toon'
import { DOG_POS } from './Doghouse'
import { DOG_WALK } from './motion'

function buildDog(): Group {
  const g = new Group()

  const orangeMat = toon({ color: 0xe8853a }) // 橘色（背/耳/后腿/尾巴）
  const whiteMat = toon({ color: 0xf5ead0 }) // 白色（脸/胸/前腿）
  const darkMat = toon({ color: 0x2a1a0a }) // 黑（鼻/眼瞳）
  const pinkMat = toon({ color: 0xff9999 }) // 粉（舌头）

  // 后躯（坐姿：扁而宽）—— 标 name='torso' 参与躯干微浮
  const hind = new Mesh(new BoxGeometry(0.35, 0.25, 0.45), orangeMat)
  hind.name = 'torso'
  hind.position.set(0, 0.22, -0.1)
  hind.castShadow = true
  g.add(hind)

  // 前胸（白色，从肚子延伸到胸口）—— 标 name='torso' 参与躯干微浮
  const chest = new Mesh(new BoxGeometry(0.32, 0.28, 0.3), whiteMat)
  chest.name = 'torso'
  chest.position.set(0, 0.24, 0.15)
  chest.castShadow = true
  g.add(chest)

  // 头（大，圆润）—— 标 name='torso' 参与躯干微浮（头是身宽的 ~1.2 倍以营造萌系）
  const head = new Mesh(new BoxGeometry(0.4, 0.36, 0.38), orangeMat)
  head.name = 'torso'
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

  // 前腿（白色，直立，蹲姿关键）—— 标记 name 便于 useFrame 找
  const legGeo = new BoxGeometry(0.1, 0.22, 0.1)
  const frontLegL = new Mesh(legGeo, whiteMat)
  frontLegL.name = 'legFL'
  frontLegL.position.set(-0.13, 0.11, 0.25)
  frontLegL.castShadow = true
  g.add(frontLegL)
  const frontLegR = new Mesh(legGeo, whiteMat)
  frontLegR.name = 'legFR'
  frontLegR.position.set(0.13, 0.11, 0.25)
  frontLegR.castShadow = true
  g.add(frontLegR)

  // 后腿（折叠贴在身体两侧）—— 标记 name 便于 useFrame 找
  const hindLegL = new Mesh(new BoxGeometry(0.1, 0.14, 0.18), orangeMat)
  hindLegL.name = 'legHL'
  hindLegL.position.set(-0.13, 0.07, -0.05)
  g.add(hindLegL)
  const hindLegR = new Mesh(new BoxGeometry(0.1, 0.14, 0.18), orangeMat)
  hindLegR.name = 'legHR'
  hindLegR.position.set(0.13, 0.07, -0.05)
  g.add(hindLegR)

  // 尾巴（小橘球，后翘）—— 标记 name='tail' 便于动画 ref 找到
  const tail = new Mesh(new SphereGeometry(0.07, 6, 6), orangeMat)
  tail.name = 'tail'
  tail.position.set(0, 0.32, -0.35)
  g.add(tail)

  // inverted-hull 描边（在子 mesh 都加完后一次性 traverse）
  attachOutlineDeep(g)

  return g
}

/**
 * 蹲姿柯基：在门口 DOG_POS 附近定点踱步 + 摇尾 + 四腿错相步态。
 * 位置/朝向由 useFrame 驱动（参考 Pond.tsx 鱼游动的 mutate 模式，无 React rerender）。
 *
 * 坐标约定：最外层 group 锚定 DOG_POS，并保持 Math.PI/2 基础朝向（让狗头朝世界 +x）。
 * 走动偏移 + 摆头叠加在 group 上；腿/躯干/尾的微动发生在 primitive 内（局部坐标）。
 *
 * 防漂设计（P2-6 prod 反馈）：ampX 与 bodyYaw 必须都很小。
 * 狗屋本体在世界 [(-1.975, 3.3)]，狗从 [-1.4, 3.2] 往 +x 走 ampX + 摆头，会塞进 doghouse 圆拱门洞。
 * 缩 ampX + 缩 bodyYaw 后，狗始终在原地 0.18 半径内踱，且 cos 微转不超过 0.15 rad（≈8.6°），
 * 配合 leg step + body bob + tail wag 仍生动，但不再有「转脸」动作引发的漂移。
 */
export default function Dog() {
  const dog = useMemo(() => buildDog(), [])
  const groupRef = useRef<Group>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    // 6s 周期：sin 位置 + cos 微转，方向变化连续无硬翻
    const phase = (Math.PI * 2 * t) / DOG_WALK.periodS
    const offsetX = DOG_WALK.ampX * Math.sin(phase)
    const dynamicYaw = Math.cos(phase) * DOG_WALK.bodyYaw

    // 外层 group：位移 + 摆头（mutate，不触发 rerender）
    if (groupRef.current) {
      groupRef.current.position.x = DOG_POS[0] + offsetX
      groupRef.current.rotation.y = Math.PI / 2 + dynamicYaw
    }

    // 躯干微浮：步频 2×（每步身体上下一次），用 ref 列表的 hind/chest/head 三个 mesh
    const bob = Math.sin(phase * 2) * DOG_WALK.bodyBobY
    const legSwing = Math.sin(phase * 2) * DOG_WALK.legSwingY

    // 拆两次 traverse：腿（含躯干 bodyBob）/ 尾，避免状态耦合
    dog.traverse((obj) => {
      if (!(obj instanceof Mesh)) return

      // 腿：FL/FR 同相、HL/HR 错相 π（标准四足 walk：前腿抬时后腿落）
      if (obj.name === 'legFL' || obj.name === 'legFR') {
        obj.position.y = obj.userData.baseY + legSwing
      } else if (obj.name === 'legHL' || obj.name === 'legHR') {
        obj.position.y =
          obj.userData.baseY + Math.sin(phase * 2 + DOG_WALK.legPhaseOffset) * DOG_WALK.legSwingY
      }

      // 躯干：hind / chest / head 三块一起微浮
      if (obj.name === 'torso') {
        obj.position.y = obj.userData.baseY + bob
      }
    })

    // 摇尾：参数化原 Math.sin(t*6) 的频率
    dog.traverse((obj) => {
      if (obj instanceof Mesh && obj.name === 'tail') {
        obj.rotation.y = Math.sin(t * DOG_WALK.tailHz) * 0.5
      }
    })
  })

  // 在 buildDog 完成后给要动的部件打 baseY（避免硬编码 y 值散落）
  // —— 这一步用 useMemo 后置一次性遍历，不参与每帧渲染
  useMemo(() => {
    dog.traverse((obj) => {
      if (!(obj instanceof Mesh)) return
      if (
        obj.name === 'legFL' ||
        obj.name === 'legFR' ||
        obj.name === 'legHL' ||
        obj.name === 'legHR' ||
        obj.name === 'torso'
      ) {
        obj.userData.baseY = obj.position.y
      }
    })
  }, [dog])

  return (
    <group ref={groupRef} position={DOG_POS} scale={0.7}>
      <primitive object={dog} />
    </group>
  )
}
