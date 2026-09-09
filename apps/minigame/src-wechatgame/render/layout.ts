// 6 块地屏幕坐标（设计分辨率 750×1334，cc 风格左下原点）。
// 设计原则：地块网格水平居中，纵向中心在屏幕偏上（FARM_AREA_CENTER_Y）。

export const PLOT_ROWS = 2
export const PLOT_COLS = 3
export const PLOT_TILE_PX = 180
export const PLOT_GAP_X = 30
export const PLOT_GAP_Y = 30
const FARM_AREA_CENTER_Y = 700

export interface ScreenSize {
  width: number
  height: number
}

export function plotScreenCenter(i: number, size: ScreenSize): { x: number; y: number } {
  const row = Math.floor(i / PLOT_COLS)
  const col = i % PLOT_COLS
  const totalW = PLOT_COLS * PLOT_TILE_PX + (PLOT_COLS - 1) * PLOT_GAP_X
  const totalH = PLOT_ROWS * PLOT_TILE_PX + (PLOT_ROWS - 1) * PLOT_GAP_Y
  const startX = (size.width - totalW) / 2 + PLOT_TILE_PX / 2
  const centerY = size.height - FARM_AREA_CENTER_Y
  const startY = centerY + totalH / 2 - PLOT_TILE_PX / 2
  return {
    x: startX + col * (PLOT_TILE_PX + PLOT_GAP_X),
    y: startY - row * (PLOT_TILE_PX + PLOT_GAP_Y),
  }
}

export function hitTestPlot(x: number, y: number, size: ScreenSize): number | null {
  for (let i = 0; i < PLOT_COLS * PLOT_ROWS; i++) {
    const c = plotScreenCenter(i, size)
    const half = PLOT_TILE_PX / 2
    if (x >= c.x - half && x <= c.x + half && y >= c.y - half && y <= c.y + half) {
      return i
    }
  }
  return null
}

export function seedButtonCenter(i: number, size: ScreenSize): { x: number; y: number } {
  const w = 200
  const h = 100
  const gap = 40
  const totalW = 2 * w + gap
  const startX = (size.width - totalW) / 2 + w / 2
  return { x: startX + i * (w + gap), y: 120 + h / 2 }
}

export function hitTestSeed(x: number, y: number, size: ScreenSize): number | null {
  for (let i = 0; i < 2; i++) {
    const c = seedButtonCenter(i, size)
    const halfW = 100
    const halfH = 50
    if (x >= c.x - halfW && x <= c.x + halfW && y >= c.y - halfH && y <= c.y + halfH) {
      return i
    }
  }
  return null
}
