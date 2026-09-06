// 一次性瞬态特效的数据层——纯 three/数学，不依赖 React/DOM，Phase 2 可原样搬 RN。

import { Group, Vector3 } from 'three'

// —— 收获弹出（作物原地起跳 + 胀缩 + 消失）——

export interface Pop {
  obj: Group
  x: number
  z: number
  born: number
}

const pops: Pop[] = []

export function spawnHarvestPop(obj: Group, x: number, z: number) {
  pops.push({ obj, x, z, born: performance.now() })
}

/** 活跃列表（原地管理，PopLayer 负责增删） */
export function getPops(): readonly Pop[] {
  return pops
}

export function removePop(pop: Pop) {
  const i = pops.indexOf(pop)
  if (i >= 0) pops.splice(i, 1)
}

// —— 屏幕震动：toggle .jelly-shake class，CSS keyframe 帧率无关 ——
// Phase 2 的 RN 端可换成 Animated.spring 驱动根 view
const SHAKE_CLASS = 'jelly-shake'

export function triggerShake(intensity: 'normal' | 'soft' = 'normal'): void {
  const root = document.querySelector('.app') as HTMLElement | null
  if (!root) return
  root.classList.remove(SHAKE_CLASS)
  root.classList.add(intensity === 'soft' ? `${SHAKE_CLASS}--soft` : SHAKE_CLASS)
  window.setTimeout(() => root.classList.remove(SHAKE_CLASS, `${SHAKE_CLASS}--soft`), 280)
}

/** 兼容旧接口占位（已被 triggerShake 替代，保留免误用） */
export function consumeShake(): { x: number; y: number } {
  return { x: 0, y: 0 }
}

// —— 径向金光（mesh-free 几何：粒子从圆心向四周放射 + 快速淡出）——

const SHOCKWAVES: { x: number; z: number; born: number }[] = []
export function spawnShockwave(x: number, z: number): void {
  SHOCKWAVES.push({ x, z, born: performance.now() })
}
export function getShockwaves(): { x: number; z: number; born: number }[] {
  return SHOCKWAVES
}
export const SHOCKWAVE_MS = 280

// —— 叶子碎屑：成熟作物被收时左右溅射的小绿片（两个 plane）——

const LEAFS: { x: number; y: number; z: number; vx: number; vy: number; vz: number; rot: number; rotSpd: number; born: number }[] = []
export function spawnLeafBurst(x: number, y: number, z: number, count = 6): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    LEAFS.push({
      x,
      y,
      z,
      vx: Math.cos(a) * (1.5 + Math.random() * 1.2),
      vy: 1.2 + Math.random() * 1.4,
      vz: Math.sin(a) * (1.5 + Math.random() * 1.2),
      rot: Math.random() * Math.PI * 2,
      rotSpd: (Math.random() - 0.5) * 10,
      born: performance.now(),
    })
  }
}
export function getLeafs() {
  return LEAFS
}
export const LEAF_MS = 800

// —— 金币粒子（固定大小 InstancedMesh 池）——

export const MAX_COINS = 64

export interface Coin {
  pos: Vector3
  vel: Vector3
  rot: number
  spin: number
  tilt: number
  born: number
}

const coins: Coin[] = []

export function spawnCoinBurst(x: number, y: number, z: number, count = 18) {
  for (let i = 0; i < count; i++) {
    coins.push({
      pos: new Vector3(x, y, z),
      vel: new Vector3(
        (Math.random() - 0.5) * 3.2,
        2.6 + Math.random() * 2.0,
        (Math.random() - 0.5) * 3.2,
      ),
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 5),
      tilt: (Math.random() - 0.5) * 0.9,
      born: performance.now(),
    })
  }
  if (coins.length > MAX_COINS) coins.splice(0, coins.length - MAX_COINS)
}

export function updateCoins(dt: number, ttl: number) {
  const now = performance.now()
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i]
    c.vel.y -= 7.5 * dt
    c.pos.addScaledVector(c.vel, dt)
    c.rot += c.spin * dt
    if (c.pos.y < 0.03 && c.vel.y < 0) {
      // 落地弹一次，动能衰减
      c.pos.y = 0.03
      c.vel.y *= -0.35
      c.vel.x *= 0.7
      c.vel.z *= 0.7
    }
    if (now - c.born > ttl) coins.splice(i, 1)
  }
}

export function getCoins(): readonly Coin[] {
  return coins
}
