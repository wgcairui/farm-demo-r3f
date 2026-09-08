// 主循环共享函数：避免 Scene2D ↔ tickLoop 循环依赖。
// renderFrame: 每帧画一帧；advancePlots/advanceEvents: 推进游戏状态。

import { PLOT_COUNT, progressOf, stageOf, type SaveData } from '@farm/game'
import { plotPosition } from '../state/layout'
import { getNow } from '../state/time'
import { tickEvents, tickPlotStates, getActive } from '../state/events'
import {
  drawCottage,
  drawCrop,
  drawDecoration,
  drawDog,
  drawDoghouse,
  drawFence,
  drawPath,
  drawPest,
  drawPond,
  drawTile,
  drawTree,
  drawWarehouse,
} from './sprites'
import { defaultOrigin, pointInTile, worldToScreen } from './iso'
import { getTutorialState } from '../state/tutorial'
import { getDecorations } from '../state/decorations'

export interface RenderInput {
  ctx: CanvasRenderingContext2D
  cssW: number
  cssH: number
  data: SaveData
  /** 0..1 呼吸相位，每帧 +0.05 由 tickLoop 自增 */
  pulse: number
}

export function renderFrame(input: RenderInput): void {
  const { ctx, cssW, cssH, data, pulse } = input
  ctx.clearRect(0, 0, cssW, cssH)

  const origin = defaultOrigin(cssW, cssH)
  ctx.save()
  ctx.translate(origin.x, origin.y)

  const now = getNow()
  const tut = getTutorialState()
  const highlightEmpty = tut.step === 2
  const phase = performance.now() / 1000

  // 背景草地（铺满世界平面）
  drawGrass(ctx)

  // 装饰（cot/warehouse/tree/pond/dog/doghouse/path/fence）
  drawDecorations(ctx, phase)

  // 摆件
  drawPlacedDecorations(ctx, phase)

  // 6 块地
  for (let i = 0; i < PLOT_COUNT; i++) {
    const p = data.plots[i]
    if (!p) continue
    const [wx, wy] = plotPosition(i)
    drawTile(ctx, wx, wy, p.state, {
      pulse,
      highlight: highlightEmpty && p.state === 'empty',
    })
    if (p.crop && (p.state === 'sprout' || p.state === 'growing')) {
      const prog = progressOf(p, now)
      drawCrop(ctx, wx, wy, p.state, p.crop, { progress: prog })
    } else if (p.crop) {
      drawCrop(ctx, wx, wy, p.state, p.crop)
    }
  }

  // 害虫
  drawPests(ctx, phase)

  ctx.restore()
}

function drawGrass(ctx: CanvasRenderingContext2D): void {
  // 简化的草地：8x6 网格浅色 tile（在世界平面铺）
  const span = 14
  ctx.fillStyle = '#7CB342'
  ctx.fillRect(-span * 32, -span * 16, span * 64, span * 32)
  ctx.strokeStyle = '#558B2F'
  ctx.lineWidth = 0.5
  for (let i = -span; i <= span; i++) {
    const sx = (i - (-span)) * 32
    const sy = (i - (-span)) * 16
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(sx + span * 64, sy - span * 32)
    ctx.stroke()
  }
}

function drawDecorations(ctx: CanvasRenderingContext2D, phase: number): void {
  // 固定布局（与 web 版 deco/index.tsx 简化版对齐）
  // 小屋（左上）
  drawCottage(ctx, -5, -2)
  // 仓库（右上）
  drawWarehouse(ctx, 5, -2.5)
  // 池塘（右下）
  drawPond(ctx, 5, 3, phase)
  // 树（散落 3 棵）
  drawTree(ctx, -4, 2.5, phase)
  drawTree(ctx, 3, 3, phase)
  drawTree(ctx, -6, -4, phase * 0.7)
  // 狗（小屋门口踱步）
  drawDog(ctx, -3.5 + Math.sin(phase * 0.6) * 0.8, -1.5, phase, true)
  // 狗屋
  drawDoghouse(ctx, -2, -2)
  // 石板路（小屋到地块）
  for (let i = 0; i < 5; i++) {
    drawPath(ctx, -2.5 + i * 0.7, 0 + i * 0.2)
  }
  // 围栏（地块外圈示意，简化为几根）
  for (let i = -1.5; i <= 1.5; i += 1.2) {
    drawFence(ctx, i, 1.5)
    drawFence(ctx, i, -1.5)
  }
}

function drawPlacedDecorations(ctx: CanvasRenderingContext2D, phase: number): void {
  const list = getDecorations()
  for (const d of list) {
    drawDecoration(ctx, d.x, d.z, d.kind, phase + d.x)
  }
}

function drawPests(ctx: CanvasRenderingContext2D, phase: number): void {
  const active = getActive()
  if (!active || active.type !== 'pest') return
  if (active.plot < 0) return
  const [wx, wy] = plotPosition(active.plot)
  // 害虫在成熟/生长期的作物上飘
  const ageSec = (performance.now() - active.startAt) / 1000
  drawPest(ctx, wx + Math.sin(phase * 3) * 0.3, wy + Math.cos(phase * 2.5) * 0.3, phase)
  // 警示环
  const c = worldToScreen(wx, wy, 0)
  ctx.save()
  ctx.strokeStyle = '#F44336'
  ctx.lineWidth = 2
  ctx.globalAlpha = 0.5 + 0.5 * Math.sin(phase * 6)
  ctx.beginPath()
  ctx.ellipse(c.x, c.y, 18, 9, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

export function advancePlots(plots: SaveData['plots'], now: number): SaveData['plots'] | null {
  return tickPlotStates(plots, now)
}

export function advanceEvents(plots: SaveData['plots']): void {
  tickEvents(plots)
}

export { pointInTile, worldToScreen }
