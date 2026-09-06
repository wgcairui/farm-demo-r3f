// 浮动文字：3D 锚点 → 屏幕投影（Canvas 内 FloaterBridge 每帧计算）→ 纯 DOM 层 CSS 动画。
// DOM 挂载这份与 Phase 2 的 RN overlay 互为对位物，投影逻辑两端一致。

export interface FloaterSpawn {
  x: number
  y: number
  z: number
  text: string
}

const pending: FloaterSpawn[] = []

export function queueFloater(x: number, y: number, z: number, text: string) {
  pending.push({ x, y, z, text })
}

export function takeFloaters(): FloaterSpawn[] {
  return pending.splice(0, pending.length)
}

export function mountFloaterDom(sx: number, sy: number, text: string) {
  const root = document.getElementById('float-root')
  if (!root) return
  const el = document.createElement('span')
  el.className = 'floater'
  el.textContent = text
  el.style.left = `${sx}px`
  el.style.top = `${sy}px`
  root.appendChild(el)
  window.setTimeout(() => el.remove(), 950)
}
