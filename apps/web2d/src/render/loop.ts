// 主循环共享函数：避免 Scene2D ↔ tickLoop 循环依赖。
// renderFrame: 每帧画一帧；advancePlots/advanceEvents: 推进游戏状态。

import { PLOT_COUNT, progressOf, stageOf, type SaveData } from '@farm/game'
import { plotPosition } from '../state/layout'
import { getNow } from '../state/time'
import { tickEvents, tickPlotStates, getActive } from '../state/events'
import {
  drawBone,
  drawCloud,
  drawCottage,
  drawCrop,
  drawDecoration,
  drawDog,
  drawDoghouse,
  drawFence,
  drawFlower,
  drawPath,
  drawPest,
  drawPond,
  drawSign,
  drawStone,
  drawTile,
  drawTree,
  drawWarehouse,
} from './sprites'
import { defaultOrigin, pointInTile, worldToScreen } from './iso'
import { getTutorialState } from '../state/tutorial'
import { getDecorations } from '../state/decorations'

// 云朵慢飘：模块级单例，rAF 自增后传入 renderFrame
let cloudOffset = 0

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

  // 天空层：草地径向渐变 + 远景云朵（在 world translate 之前画）
  drawSky(ctx, cssW, cssH)

  ctx.save()
  ctx.translate(origin.x, origin.y)

  const now = getNow()
  const tut = getTutorialState()
  const highlightEmpty = tut.step === 2
  const phase = performance.now() / 1000

  // 背景草地（铺满世界平面）
  drawGrass(ctx)

  // 装饰（cot/warehouse/tree/pond/dog/doghouse/path/fence/flower/stone/bone/sign）
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
      progress: progressOf(p, now),
      phase,
    })
    if (p.crop && (p.state === 'sprout' || p.state === 'growing')) {
      const prog = progressOf(p, now)
      drawCrop(ctx, wx, wy, p.state, p.crop, { progress: prog, phase })
    } else if (p.crop) {
      drawCrop(ctx, wx, wy, p.state, p.crop, { phase })
    }
  }

  // 害虫
  drawPests(ctx, phase)

  ctx.restore()
}

function drawSky(ctx: CanvasRenderingContext2D, cssW: number, cssH: number): void {
  // 草地径向渐变（中心亮 → 边缘暗，QQ 农场风的"光从天上照下来"）
  const grad = ctx.createRadialGradient(cssW / 2, cssH / 2, 50, cssW / 2, cssH / 2, cssW)
  grad.addColorStop(0, '#9CCC65')
  grad.addColorStop(1, '#7CB342')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, cssW, cssH)

  // 3 朵云朵（白色椭圆叠加），慢飘
  const cloudY = 70
  const cloudConfigs = [
    { x0: 100, scale: 1.0 },
    { x0: 350, scale: 0.8 },
    { x0: 600, scale: 1.1 },
  ]
  const wrap = cssW + 200
  for (const cfg of cloudConfigs) {
    const x = ((cfg.x0 + cloudOffset * (cfg.scale * 8)) % wrap) - 100
    drawCloud(ctx, x, cloudY, cfg.scale)
  }
  // 顶部留 TopBar 区域（80px）不要画云
  ctx.fillStyle = '#9CCC65'
  ctx.fillRect(0, 0, cssW, 60)
}

/** rAF 主循环每帧调用一次，推进云朵偏移 */
export function tickClouds(dtMs: number): void {
  cloudOffset += dtMs / 1000
}

function drawGrass(ctx: CanvasRenderingContext2D): void {
  // 在世界坐标平面铺一张绿色草地 + 细斜线网格（呼应地块方阵）
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
  // 远景树（小尺寸，深景）
  drawTree(ctx, -7, -3, phase * 0.7)
  drawTree(ctx, 7, 4.5, phase * 0.6)
  // 中景小屋
  drawCottage(ctx, -5, -2, phase)
  // 中景仓库
  drawWarehouse(ctx, 5, -2.5, phase)
  // 池塘
  drawPond(ctx, 5, 3, phase)
  // 近景树（大尺寸，前景）
  drawTree(ctx, -4, 2.5, phase)
  drawTree(ctx, 3, 3, phase)
  drawTree(ctx, -6, 3.5, phase * 0.8)
  // 狗（小屋门口踱步）
  drawDog(ctx, -3.5 + Math.sin(phase * 0.6) * 0.8, -1.5, phase, true)
  // 骨头玩具（狗附近地上）
  drawBone(ctx, -4.5, -0.5)
  // 狗屋
  drawDoghouse(ctx, -2, -2)
  // 石板路（小屋到地块）
  for (let i = 0; i < 5; i++) {
    drawPath(ctx, -2.5 + i * 0.7, 0 + i * 0.2)
  }
  // 围栏（地块外圈示意）
  for (let i = -1.5; i <= 1.5; i += 1.2) {
    drawFence(ctx, i, 1.5)
    drawFence(ctx, i, -1.5)
  }
  // 小花丛（3 处，远处点缀）
  drawFlower(ctx, -3, 4, 1)
  drawFlower(ctx, 6, 1.5, 2)
  drawFlower(ctx, -7, 0.5, 3)
  // 石头堆（2 处）
  drawStone(ctx, 4, 4.5)
  drawStone(ctx, -3.5, 3.8, 0.7)
  // 木牌标志（场景入口）
  drawSign(ctx, -6, -1.5, '🧑‍🌾')
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
