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

export function spawnCoinBurst(x: number, y: number, z: number, count = 10) {
  for (let i = 0; i < count; i++) {
    coins.push({
      pos: new Vector3(x, y, z),
      vel: new Vector3(
        (Math.random() - 0.5) * 2.4,
        2.1 + Math.random() * 1.7,
        (Math.random() - 0.5) * 2.4,
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
