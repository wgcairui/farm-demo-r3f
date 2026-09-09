// Canvas 2D 场景渲染：每帧从 AppController 拉数据画整屏。
// 单元测试时这个模块可独立调用 draw(ctx, app, size) 渲染到任意 ctx。

import { CROPS, progressOf, stageOf, type Plot, type PlotState } from '@farm/game'
import type { AppControllerLike } from './types'
import { PLOT_TILE_PX, plotScreenCenter, seedButtonCenter, type ScreenSize } from './layout'

const COLORS = {
  bg: '#8fc34a',
  panel: 'rgba(40, 25, 5, 0.92)',
  panelBorder: '#ff9c33',
  text: '#ffffff',
  textShadow: 'rgba(0, 0, 0, 0.55)',
  empty: '#8b6914',
  sown: '#7a5c1e',
  sprout: '#6db33f',
  growing: '#4caf50',
  mature: '#f5c518',
  withered: '#3e2723',
  ringMature: 'rgba(255, 224, 102, 0.86)',
  ringWithered: 'rgba(120, 60, 30, 0.78)',
  btnBg: 'rgba(255, 255, 255, 0.92)',
  btnBgActive: '#ffe066',
  btnBorder: '#78501e',
  btnText: '#321e0a',
  btnTextActive: '#502800',
}

const STATE_COLOR: Record<PlotState, string> = {
  empty: COLORS.empty,
  sown: COLORS.sown,
  sprout: COLORS.sprout,
  growing: COLORS.growing,
  mature: COLORS.mature,
  withered: COLORS.withered,
}

function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return 1 - Math.pow(1 - x, 3)
}

function remainingMs(plot: Plot, now: number): number | null {
  if (!plot.crop || !plot.plantedAt) return null
  if (plot.state === 'mature') return 0
  const def = CROPS[plot.crop]
  const totalMs = def.stageMs[0] + def.stageMs[1]
  const elapsed = now - plot.plantedAt
  return Math.max(0, totalMs - elapsed)
}

function formatMmSs(ms: number): string {
  const totalSec = Math.ceil(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export function drawBackground(ctx: CanvasRenderingContext2D, size: ScreenSize) {
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, size.width, size.height)
}

export function drawCoinHud(ctx: CanvasRenderingContext2D, size: ScreenSize, coins: number) {
  const w = 280
  const h = 80
  const x = (size.width - w) / 2
  const y = size.height - 600 - h / 2
  ctx.fillStyle = COLORS.panel
  roundRect(ctx, x, y, w, h, 16)
  ctx.fill()
  ctx.strokeStyle = COLORS.panelBorder
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = COLORS.text
  ctx.font = 'bold 36px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`💰 ${coins}`, x + w / 2, y + h / 2 + 2)
}

export function drawPlot(
  ctx: CanvasRenderingContext2D,
  i: number,
  plot: Plot,
  now: number,
  size: ScreenSize,
) {
  const c = plotScreenCenter(i, size)
  const half = PLOT_TILE_PX / 2

  // 底色
  ctx.fillStyle = STATE_COLOR[plot.state]
  ctx.fillRect(c.x - half, c.y - half, PLOT_TILE_PX, PLOT_TILE_PX)

  // 状态环
  if (plot.state === 'mature') {
    ctx.strokeStyle = COLORS.ringMature
    ctx.lineWidth = 6
    ctx.strokeRect(c.x - half + 3, c.y - half + 3, PLOT_TILE_PX - 6, PLOT_TILE_PX - 6)
  } else if (plot.state === 'withered') {
    ctx.strokeStyle = COLORS.ringWithered
    ctx.lineWidth = 6
    ctx.strokeRect(c.x - half + 3, c.y - half + 3, PLOT_TILE_PX - 6, PLOT_TILE_PX - 6)
  }

  // 作物 emoji + 倒计时 + 缩放
  if (plot.crop && plot.state !== 'empty') {
    const stage = stageOf(plot, now)
    const t = progressOf(plot, now)
    const scale = 0.4 + 0.6 * easeOutCubic(t)
    const def = CROPS[plot.crop]
    const emoji = def.emoji
    const remain = remainingMs(plot, now)
    ctx.save()
    ctx.translate(c.x, c.y)
    ctx.scale(scale, scale)
    if (plot.state === 'mature') {
      ctx.fillText(emoji, 0, 0)
    } else if (remain !== null && stage !== 'mature') {
      ctx.fillText(emoji, 0, -8)
      ctx.font = 'bold 18px sans-serif'
      ctx.fillText(formatMmSs(remain), 0, 22)
    } else {
      ctx.fillText(emoji, 0, 0)
    }
    ctx.restore()
  } else if (plot.state === 'withered') {
    ctx.save()
    ctx.translate(c.x, c.y)
    ctx.font = '54px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🍂', 0, 0)
    ctx.restore()
  }
}

export function drawSeedBar(
  ctx: CanvasRenderingContext2D,
  size: ScreenSize,
  selected: import('@farm/game').CropId,
) {
  const crops: import('@farm/game').CropId[] = ['carrot', 'corn']
  for (let i = 0; i < crops.length; i++) {
    const crop = crops[i]
    const c = seedButtonCenter(i, size)
    const w = 200
    const h = 100
    const isSelected = crop === selected
    ctx.fillStyle = isSelected ? COLORS.btnBgActive : COLORS.btnBg
    roundRect(ctx, c.x - w / 2, c.y - h / 2, w, h, 16)
    ctx.fill()
    ctx.strokeStyle = COLORS.btnBorder
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = isSelected ? COLORS.btnTextActive : COLORS.btnText
    ctx.font = 'bold 32px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const def = CROPS[crop]
    ctx.fillText(`${def.emoji}\n${def.seedPrice}🪙`, c.x, c.y)
  }
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  app: AppControllerLike,
  size: ScreenSize,
) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const data = app.getData()
  drawBackground(ctx, size)
  const now = Date.now()
  for (let i = 0; i < data.plots.length; i++) {
    drawPlot(ctx, i, data.plots[i], now, size)
  }
  drawCoinHud(ctx, size, data.coins)
  drawSeedBar(ctx, size, data.selected)
}
