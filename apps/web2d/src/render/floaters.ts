// 2D 浮字：替换 web 版 floaters.ts 的 three 投影。
// 流程：queueFloater(worldX, worldY, worldZ, text, opts) → pending[] →
// rAF tickFloater 推 iso 投影 → 挂 DOM <span> 到 #float-root → 动画 → 移除。
//
// 这是 web 版同名 API 的完全替身，events.ts 调用无需改 import。

import { worldToScreen, defaultOrigin } from './iso'
import { getNow } from '../state/time'
import { getCanvasOrigin } from '../state/canvasRegistry'

export interface FloaterOpts {
  hero?: boolean
  combo?: number
}

interface PendingFloater {
  x: number
  y: number
  z: number
  text: string
  opts: FloaterOpts
  bornMs: number
  el?: HTMLSpanElement
  baseY?: number
  baseX?: number
}

const DURATION_MS = 900
const pending: PendingFloater[] = []
let rootEl: HTMLElement | null = null

export function queueFloater(
  x: number,
  y: number,
  z: number,
  text: string,
  opts: FloaterOpts = {},
): void {
  pending.push({ x, y, z, text, opts, bornMs: getNow() })
}

export function clearFloaters(): void {
  for (const f of pending) {
    if (f.el) f.el.remove()
  }
  pending.length = 0
}

function ensureRoot(): HTMLElement | null {
  if (rootEl) return rootEl
  if (typeof document === 'undefined') return null
  rootEl = document.getElementById('float-root')
  return rootEl
}

export function tickFloaters(): void {
  const root = ensureRoot()
  if (!root) return

  const origin = getCanvasOrigin() ?? { x: 0, y: 0 }

  const now = getNow()
  for (let i = pending.length - 1; i >= 0; i--) {
    const f = pending[i]
    const age = now - f.bornMs
    if (age >= DURATION_MS) {
      if (f.el) f.el.remove()
      pending.splice(i, 1)
      continue
    }
    const screen = worldToScreen(f.x, f.z, f.y * 16 + 8)
    const sx = screen.x + origin.x
    const sy = screen.y + origin.y - age * 0.04 // 向上飘
    if (!f.el) {
      const el = document.createElement('span')
      el.className = 'floater'
      if (f.opts.hero) el.classList.add('floater--hero')
      if (f.opts.combo) {
        el.classList.add('floater--combo')
        el.dataset.combo = String(f.opts.combo)
      }
      el.textContent = f.text
      root.appendChild(el)
      f.el = el
      f.baseX = sx
      f.baseY = sy
    }
    f.el.style.transform = `translate(${sx}px, ${sy}px)`
    f.el.style.opacity = String(1 - age / DURATION_MS)
  }
}
