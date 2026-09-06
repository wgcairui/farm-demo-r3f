// 浮动文字：3D 锚点 → 屏幕投影（Canvas 内 FloaterBridge 每帧计算）→ 纯 DOM 层 CSS 动画。
// DOM 挂载这份与 Phase 2 的 RN overlay 互为对位物，投影逻辑两端一致。

export interface FloaterSpawn {
  x: number
  y: number
  z: number
  text: string
  /** 主菜级浮字：收获时的大字+金光+轻微果冻震；普通 -N/+2 走默认 */
  hero?: boolean
}

const pending: FloaterSpawn[] = []

export function queueFloater(x: number, y: number, z: number, text: string, opts?: { hero?: boolean }) {
  pending.push({ x, y, z, text, hero: opts?.hero })
}

export function takeFloaters(): FloaterSpawn[] {
  return pending.splice(0, pending.length)
}

/** 收获后清空所有未投影的浮字（避免主菜浮字被旧"可收获"覆盖） */
export function clearFloaters(): void {
  pending.length = 0
}

export function mountFloaterDom(sx: number, sy: number, text: string, hero = false) {
  const root = document.getElementById('float-root')
  if (!root) return
  const el = document.createElement('span')
  el.className = hero ? 'floater hero' : 'floater'
  el.textContent = text
  el.style.left = `${sx}px`
  el.style.top = `${sy}px`
  root.appendChild(el)
  // 主菜浮字停留更长（1200ms 让玩家读完大数字+看到回弹）
  window.setTimeout(() => el.remove(), hero ? 1200 : 1100)
}
