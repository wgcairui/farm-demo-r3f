// 2D 粒子系统：替换 web 版 effects.ts 的 Three 版本。
// 全部用模块单例 + rAF 推进，spawn* 即入池，tickLoop 在 renderFrame 前调 updateParticles 推进一帧。
//
// 粒子类型：
//   shockwave - 径向金光环（收获时）
//   leaf      - 叶子碎屑（8 片，带重力 + 风偏）
//   coin      - 金币粒子（圆形 + 数字 + 抛物线）
//   rain      - 雨滴（90 条，循环回收，由 events.isRain 触发）
//
// 屏幕震动：单独 shakeOffset，consumeShake() 一次性读出，rAF 减幅。

import { COLOR as _ } from './sprites' // 引用统一色板（未来扩展）

export type ShakeKind = 'soft' | 'normal'

interface Particle {
  x: number
  y: number
  z: number // y_px 高度偏移（iso 抬高）
  vx: number
  vy: number
  vz: number
  age: number
  ttl: number
  color: string
  size: number
  kind: 'shockwave' | 'leaf' | 'coin' | 'rain'
}

const particles: Particle[] = []
let shakeAmp = 0
let shakeUntil = 0
let rainActive = false

// ── API ───────────────────────────────────────────────

export function spawnShockwave(x: number, z: number): void {
  particles.push({
    x,
    y: 0,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 0,
    ttl: 500,
    color: '#FFC107',
    size: 4,
    kind: 'shockwave',
  })
}

export function spawnLeafBurst(x: number, _y: number, z: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5
    const sp = 40 + Math.random() * 30
    particles.push({
      x,
      y: 8,
      z,
      vx: Math.cos(a) * sp,
      vy: 30 + Math.random() * 20,
      vz: Math.sin(a) * sp,
      age: 0,
      ttl: 700,
      color: Math.random() < 0.5 ? '#7CB342' : '#558B2F',
      size: 3 + Math.random() * 2,
      kind: 'leaf',
    })
  }
}

export function spawnCoinBurst(x: number, _y: number, z: number): void {
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    particles.push({
      x,
      y: 4,
      z,
      vx: Math.cos(a) * 30,
      vy: 50 + Math.random() * 30,
      vz: Math.sin(a) * 30,
      age: 0,
      ttl: 900,
      color: '#FBC02D',
      size: 4,
      kind: 'coin',
    })
  }
}

export function triggerShake(kind: ShakeKind): void {
  shakeAmp = kind === 'normal' ? 6 : 3
  shakeUntil = performance.now() + (kind === 'normal' ? 250 : 150)
}

export function consumeShake(): { x: number; y: number } {
  const now = performance.now()
  if (now >= shakeUntil || shakeAmp <= 0) {
    shakeAmp = 0
    return { x: 0, y: 0 }
  }
  const x = (Math.random() - 0.5) * shakeAmp
  const y = (Math.random() - 0.5) * shakeAmp
  shakeAmp *= 0.85
  return { x, y }
}

export function setRainActive(active: boolean): void {
  rainActive = active
  if (active && particles.filter((p) => p.kind === 'rain').length === 0) {
    for (let i = 0; i < 90; i++) spawnRainDrop()
  }
}

function spawnRainDrop(): void {
  // 在世界 (wx, wy) 平面内随机撒
  const range = 12
  particles.push({
    x: (Math.random() - 0.5) * range * 2,
    y: 0,
    z: (Math.random() - 0.5) * range * 2,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 0,
    ttl: 1000,
    color: 'rgba(180, 220, 255, 0.6)',
    size: 2,
    kind: 'rain',
  })
}

// ── 更新 + 绘制 ─────────────────────────────────────────

export function updateParticles(dtMs: number): void {
  const dt = dtMs / 1000
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.age += dtMs
    if (p.age >= p.ttl) {
      // rain 循环回收；其他删除
      if (p.kind === 'rain' && rainActive) {
        const range = 12
        p.x = (Math.random() - 0.5) * range * 2
        p.z = (Math.random() - 0.5) * range * 2
        p.age = 0
      } else {
        particles.splice(i, 1)
      }
      continue
    }
    // 物理
    if (p.kind === 'leaf') {
      p.vy -= 80 * dt // 重力
      p.vx *= 0.98
      p.vz *= 0.98
    } else if (p.kind === 'coin') {
      p.vy -= 120 * dt // 重力更大
    } else if (p.kind === 'rain') {
      // 不太关心 vy；让 age 推进后回收
    }
    p.x += p.vx * dt
    p.z += p.vz * dt
    // 高度直接用 y（y_px）不再叠加
  }
}

/** 由 rAF 主循环在 renderFrame 前调用（实际已在 tickLoop 中处理；这里暴露供 hook 使用） */
export function getParticleCount(): number {
  return particles.length
}

// 暴露给 render/loop.ts 内部调用
export const _internal = { particles }
