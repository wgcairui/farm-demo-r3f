// 程序化 sprite 绘制（Canvas2D 原语）。所有函数接收 ctx + 已投影到屏幕的坐标。
// 不调 beginPath/endPath 之外的副作用，调用方负责 save/restore。
//
// chunk 3：地块 + 作物最小集。
// chunk 5：补全 deco（仓库/树/狗/池塘/小屋/石板路/围栏）+ 4 种摆件 + 害虫。

import type { CropId, PlotState } from '@farm/game'
import { worldToScreen, tileDiamond } from './iso'
import type { DecorationKind } from '../state/decorations'

// ── 色板 ───────────────────────────────────────────────
export const COLOR: Record<string, string> = {
  // tile
  dirtDark: '#6D4C2E',
  dirtMid: '#8B5A2B',
  dirtEmpty: '#A07845',
  dirtEmptyGlow: '#C9A36B',
  dirtWithered: '#5D4A3A',
  // 作物
  sprout: '#7CB342',
  sproutDark: '#558B2F',
  carrotOrange: '#FF7043',
  carrotShadow: '#D84315',
  cornYellow: '#FBC02D',
  cornShadow: '#F9A825',
  cornGreen: '#7CB342',
  // 描边
  outline: '#3E2723',
  // 害虫
  pestBody: '#5D4037',
  pestWing: '#8D6E63',
}

// ── 地块 ───────────────────────────────────────────────
export interface DrawTileOpts {
  /** empty 状态的呼吸 alpha 0..1（rAF 传入） */
  pulse?: number
  /** 是否处于"可种植"高亮（教程 step=2 时） */
  highlight?: boolean
}

export function drawTile(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  state: PlotState,
  opts: DrawTileOpts = {},
): void {
  const c = worldToScreen(wx, wy)
  const points = tileDiamond(wx, wy)

  // 主体填充
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < 4; i++) ctx.lineTo(points[i].x, points[i].y)
  ctx.closePath()

  let fill = COLOR.dirtMid
  let stroke = COLOR.outline
  switch (state) {
    case 'empty':
      fill = COLOR.dirtEmpty
      break
    case 'withered':
      fill = COLOR.dirtWithered
      break
    case 'sown':
    case 'sprout':
    case 'growing':
    case 'mature':
      fill = COLOR.dirtDark
      break
  }
  ctx.fillStyle = fill
  ctx.fill()

  // empty 呼吸脉动：金色底 + 透明度 0.0~0.35
  if (state === 'empty' && opts.pulse !== undefined) {
    ctx.save()
    ctx.globalAlpha = 0.15 + 0.2 * opts.pulse
    ctx.fillStyle = COLOR.dirtEmptyGlow
    ctx.fill()
    ctx.restore()
  }

  // 教程高亮：外圈金色环
  if (opts.highlight) {
    ctx.save()
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 200)
    ctx.strokeStyle = '#FFC107'
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.restore()
  } else {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // withered 状态：残茬叉
  if (state === 'withered') {
    ctx.save()
    ctx.strokeStyle = '#3E2723'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(c.x - 4, c.y - 3)
    ctx.lineTo(c.x + 4, c.y + 3)
    ctx.moveTo(c.x + 4, c.y - 3)
    ctx.lineTo(c.x - 4, c.y + 3)
    ctx.stroke()
    ctx.restore()
  }
}

// ── 作物 ───────────────────────────────────────────────
// 5 阶段：sown → sprout → growing → mature（由 progressOf 0..1 插值）
// 这里 stage 不是 stageOf 的 6 值，而是按 PlotState 走的简化版：
//   sown → 只一个小绿点
//   sprout/growing → 用 progressOf(0..1) 插值叶片大小
//   mature → 完整作物

export interface DrawCropOpts {
  /** progressOf(plot, now) 0..1，sprout/growing 阶段用 */
  progress?: number
}

export function drawCrop(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  state: PlotState,
  crop: CropId,
  opts: DrawCropOpts = {},
): void {
  const c = worldToScreen(wx, wy, 4) // 抬高一点避免贴地

  if (state === 'sown') {
    // 一个小绿点
    ctx.save()
    ctx.fillStyle = COLOR.sproutDark
    ctx.beginPath()
    ctx.arc(c.x, c.y, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  if (state === 'sprout' || state === 'growing') {
    const t = Math.min(1, Math.max(0, opts.progress ?? 0))
    drawGrowingStage(ctx, c.x, c.y, t, crop)
    return
  }

  if (state === 'mature') {
    drawMature(ctx, c.x, c.y, crop)
  }
}

function drawGrowingStage(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  t: number,
  crop: CropId,
): void {
  // 茎
  const stemH = 4 + t * 6
  ctx.save()
  ctx.fillStyle = COLOR.sproutDark
  ctx.fillRect(cx - 1, cy - stemH, 2, stemH)

  // 叶：左右两片，宽度随 t 增长
  const leafW = 3 + t * 4
  ctx.fillStyle = COLOR.sprout
  // 左叶
  ctx.beginPath()
  ctx.ellipse(cx - leafW, cy - stemH + 1, leafW, 2, 0, 0, Math.PI * 2)
  ctx.fill()
  // 右叶
  ctx.beginPath()
  ctx.ellipse(cx + leafW, cy - stemH + 1, leafW, 2, 0, 0, Math.PI * 2)
  ctx.fill()

  // corn 顶端：往上长第二簇叶
  if (crop === 'corn' && t > 0.5) {
    ctx.fillStyle = COLOR.cornGreen
    const h = (t - 0.5) * 8
    ctx.beginPath()
    ctx.ellipse(cx, cy - stemH - h, 2, 2, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawMature(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  crop: CropId,
): void {
  if (crop === 'carrot') {
    drawCarrot(ctx, cx, cy)
  } else {
    drawCorn(ctx, cx, cy)
  }
}

function drawCarrot(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  // 顶部 3 片绿叶
  ctx.save()
  ctx.fillStyle = COLOR.sproutDark
  ctx.beginPath()
  ctx.ellipse(cx, cy - 12, 1.5, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = COLOR.sprout
  ctx.beginPath()
  ctx.ellipse(cx - 2.5, cy - 10, 2, 3.5, 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(cx + 2.5, cy - 10, 2, 3.5, -0.3, 0, Math.PI * 2)
  ctx.fill()

  // 橙色三角主体（朝下尖）
  ctx.fillStyle = COLOR.carrotOrange
  ctx.beginPath()
  ctx.moveTo(cx, cy - 6)
  ctx.lineTo(cx - 5, cy - 2)
  ctx.lineTo(cx + 5, cy - 2)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = COLOR.outline
  ctx.lineWidth = 1
  ctx.stroke()

  // 阴影横纹
  ctx.strokeStyle = COLOR.carrotShadow
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.moveTo(cx - 3, cy - 4)
  ctx.lineTo(cx + 3, cy - 4)
  ctx.stroke()
  ctx.restore()
}

function drawCorn(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  // 茎 + 玉米棒（黄色椭圆 + 顶端绿丝）
  ctx.save()
  ctx.fillStyle = COLOR.sproutDark
  ctx.fillRect(cx - 1, cy - 4, 2, 6)

  // 玉米棒主体（椭圆）
  ctx.fillStyle = COLOR.cornYellow
  ctx.beginPath()
  ctx.ellipse(cx, cy - 8, 3.5, 5.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = COLOR.cornShadow
  ctx.lineWidth = 0.8
  ctx.stroke()

  // 顶上一撮绿
  ctx.fillStyle = COLOR.cornGreen
  ctx.beginPath()
  ctx.ellipse(cx, cy - 14, 2, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = COLOR.sproutDark
  ctx.beginPath()
  ctx.ellipse(cx, cy - 16, 1, 2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// ── 装饰（仓库/树/狗/池塘/小屋/石板路/围栏） ─────────────────

const DECO_COLORS: Record<string, string> = {
  roof: '#8B4513',
  roofDark: '#5D4037',
  wall: '#D7CCC8',
  wallDark: '#A1887F',
  wood: '#6D4C41',
  water: '#42A5F5',
  waterDark: '#1976D2',
  foliage: '#388E3C',
  foliageDark: '#2E7D32',
  fence: '#8D6E63',
  dog: '#FFB74D',
  dogDark: '#F57C00',
  stone: '#9E9E9E',
  stoneDark: '#616161',
}

export function drawCottage(ctx: CanvasRenderingContext2D, wx: number, wy: number): void {
  const c = worldToScreen(wx, wy, 0)
  ctx.save()
  // 主体
  ctx.fillStyle = DECO_COLORS.wall
  ctx.fillRect(c.x - 16, c.y - 18, 32, 16)
  ctx.strokeStyle = COLOR.outline
  ctx.lineWidth = 1
  ctx.strokeRect(c.x - 16, c.y - 18, 32, 16)
  // 屋顶（等距三角 + 厚度）
  ctx.fillStyle = DECO_COLORS.roof
  ctx.beginPath()
  ctx.moveTo(c.x - 20, c.y - 18)
  ctx.lineTo(c.x, c.y - 30)
  ctx.lineTo(c.x + 20, c.y - 18)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  // 屋顶厚度阴影
  ctx.fillStyle = DECO_COLORS.roofDark
  ctx.beginPath()
  ctx.moveTo(c.x + 20, c.y - 18)
  ctx.lineTo(c.x, c.y - 30)
  ctx.lineTo(c.x, c.y - 24)
  ctx.closePath()
  ctx.fill()
  // 门
  ctx.fillStyle = DECO_COLORS.wood
  ctx.fillRect(c.x - 3, c.y - 12, 6, 10)
  ctx.restore()
}

export function drawWarehouse(ctx: CanvasRenderingContext2D, wx: number, wy: number): void {
  const c = worldToScreen(wx, wy, 0)
  ctx.save()
  // 主体（更大、更扁）
  ctx.fillStyle = DECO_COLORS.wallDark
  ctx.fillRect(c.x - 22, c.y - 16, 44, 14)
  ctx.strokeStyle = COLOR.outline
  ctx.lineWidth = 1
  ctx.strokeRect(c.x - 22, c.y - 16, 44, 14)
  // 屋顶（梯形 + 山墙）
  ctx.fillStyle = DECO_COLORS.roofDark
  ctx.beginPath()
  ctx.moveTo(c.x - 26, c.y - 16)
  ctx.lineTo(c.x - 14, c.y - 26)
  ctx.lineTo(c.x + 14, c.y - 26)
  ctx.lineTo(c.x + 26, c.y - 16)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  // 山墙
  ctx.fillStyle = DECO_COLORS.roof
  ctx.beginPath()
  ctx.moveTo(c.x + 14, c.y - 26)
  ctx.lineTo(c.x + 14, c.y - 16)
  ctx.lineTo(c.x + 26, c.y - 16)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  // 大门
  ctx.fillStyle = DECO_COLORS.wood
  ctx.fillRect(c.x - 8, c.y - 11, 16, 9)
  ctx.restore()
}

export function drawTree(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  phase: number,
): void {
  const c = worldToScreen(wx, wy, 0)
  ctx.save()
  // 树干
  ctx.fillStyle = DECO_COLORS.wood
  ctx.fillRect(c.x - 2, c.y - 8, 4, 8)
  // 树冠（3 圆，phase 让外圈微微呼吸）
  const r = 10 + Math.sin(phase) * 0.4
  ctx.fillStyle = DECO_COLORS.foliageDark
  ctx.beginPath()
  ctx.arc(c.x, c.y - 14, r + 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = DECO_COLORS.foliage
  ctx.beginPath()
  ctx.arc(c.x - 3, c.y - 16, r - 2, 0, Math.PI * 2)
  ctx.arc(c.x + 4, c.y - 14, r - 3, 0, Math.PI * 2)
  ctx.arc(c.x - 1, c.y - 19, r - 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawPond(ctx: CanvasRenderingContext2D, wx: number, wy: number, phase: number): void {
  const c = worldToScreen(wx, wy, 0)
  ctx.save()
  // 水面（菱形）
  ctx.fillStyle = DECO_COLORS.water
  ctx.beginPath()
  ctx.ellipse(c.x, c.y, 24, 12, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = DECO_COLORS.waterDark
  ctx.lineWidth = 1
  ctx.stroke()
  // 鱼影（3 条鱼来回游）
  for (let i = 0; i < 3; i++) {
    const a = phase + (i * Math.PI * 2) / 3
    const fx = Math.cos(a) * 12
    const fy = Math.sin(a * 1.3) * 5
    ctx.fillStyle = '#FFA726'
    ctx.beginPath()
    ctx.ellipse(c.x + fx, c.y + fy, 2.5, 1.2, a, 0, Math.PI * 2)
    ctx.fill()
  }
  // 水波纹
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.arc(c.x, c.y, 18 + Math.sin(phase * 2) * 1.5, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

export function drawDog(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  phase: number,
  walking: boolean,
): void {
  const c = worldToScreen(wx, wy, 0)
  ctx.save()
  // 身体（椭圆）
  ctx.fillStyle = DECO_COLORS.dog
  ctx.beginPath()
  ctx.ellipse(c.x, c.y - 4, 8, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = COLOR.outline
  ctx.lineWidth = 0.8
  ctx.stroke()
  // 头
  ctx.fillStyle = DECO_COLORS.dog
  ctx.beginPath()
  ctx.arc(c.x + 7, c.y - 5, 3.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // 耳朵
  ctx.fillStyle = DECO_COLORS.dogDark
  ctx.beginPath()
  ctx.moveTo(c.x + 6, c.y - 8)
  ctx.lineTo(c.x + 5, c.y - 5)
  ctx.lineTo(c.x + 8, c.y - 5)
  ctx.closePath()
  ctx.fill()
  // 腿（走路时上下抬腿）
  const legLift = walking ? Math.sin(phase * 8) * 1.5 : 0
  ctx.fillStyle = DECO_COLORS.dogDark
  ctx.fillRect(c.x - 5, c.y - 1, 1.5, 3 - legLift)
  ctx.fillRect(c.x - 2, c.y - 1, 1.5, 3 + legLift)
  ctx.fillRect(c.x + 2, c.y - 1, 1.5, 3 - legLift)
  ctx.fillRect(c.x + 5, c.y - 1, 1.5, 3 + legLift)
  // 尾巴（摆）
  ctx.strokeStyle = DECO_COLORS.dog
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(c.x - 8, c.y - 5)
  const tailY = c.y - 8 + Math.sin(phase * 4) * 1.5
  ctx.lineTo(c.x - 11, tailY)
  ctx.stroke()
  ctx.restore()
}

export function drawDoghouse(ctx: CanvasRenderingContext2D, wx: number, wy: number): void {
  const c = worldToScreen(wx, wy, 0)
  ctx.save()
  ctx.fillStyle = DECO_COLORS.wood
  ctx.fillRect(c.x - 8, c.y - 6, 16, 8)
  ctx.strokeRect(c.x - 8, c.y - 6, 16, 8)
  // 屋顶
  ctx.fillStyle = DECO_COLORS.roof
  ctx.beginPath()
  ctx.moveTo(c.x - 10, c.y - 6)
  ctx.lineTo(c.x, c.y - 13)
  ctx.lineTo(c.x + 10, c.y - 6)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  // 门口
  ctx.fillStyle = '#000'
  ctx.fillRect(c.x - 3, c.y - 4, 6, 6)
  ctx.restore()
}

export function drawPath(ctx: CanvasRenderingContext2D, wx: number, wy: number): void {
  const c = worldToScreen(wx, wy, 0)
  ctx.save()
  ctx.fillStyle = DECO_COLORS.stone
  ctx.fillRect(c.x - 12, c.y - 3, 24, 6)
  ctx.strokeStyle = DECO_COLORS.stoneDark
  ctx.lineWidth = 0.6
  ctx.strokeRect(c.x - 12, c.y - 3, 24, 6)
  // 接缝
  ctx.beginPath()
  ctx.moveTo(c.x - 4, c.y - 3)
  ctx.lineTo(c.x - 4, c.y + 3)
  ctx.moveTo(c.x + 4, c.y - 3)
  ctx.lineTo(c.x + 4, c.y + 3)
  ctx.stroke()
  ctx.restore()
}

export function drawFence(ctx: CanvasRenderingContext2D, wx: number, wy: number): void {
  const c = worldToScreen(wx, wy, 0)
  ctx.save()
  // 两根竖柱 + 一根横梁
  ctx.fillStyle = DECO_COLORS.fence
  ctx.fillRect(c.x - 6, c.y - 8, 1.5, 10)
  ctx.fillRect(c.x + 4.5, c.y - 8, 1.5, 10)
  ctx.fillRect(c.x - 7, c.y - 5, 14, 1.2)
  ctx.fillRect(c.x - 7, c.y - 1, 14, 1.2)
  ctx.strokeStyle = COLOR.outline
  ctx.lineWidth = 0.5
  ctx.strokeRect(c.x - 6, c.y - 8, 1.5, 10)
  ctx.strokeRect(c.x + 4.5, c.y - 8, 1.5, 10)
  ctx.restore()
}

// ── 摆件（4 种） ─────────────────────────────────────────

export function drawDecoration(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  kind: DecorationKind,
  phase: number,
): void {
  const c = worldToScreen(wx, wy, 0)
  ctx.save()
  switch (kind) {
    case 'windmill': {
      // 杆
      ctx.fillStyle = DECO_COLORS.fence
      ctx.fillRect(c.x - 1, c.y - 14, 2, 14)
      // 叶片（4 扇旋转）
      ctx.save()
      ctx.translate(c.x, c.y - 14)
      ctx.rotate(phase * 0.8)
      ctx.fillStyle = '#ECEFF1'
      for (let i = 0; i < 4; i++) {
        ctx.save()
        ctx.rotate((i * Math.PI) / 2)
        ctx.fillRect(0, -1, 12, 2)
        ctx.restore()
      }
      ctx.restore()
      // 圆心
      ctx.fillStyle = '#37474F'
      ctx.beginPath()
      ctx.arc(c.x, c.y - 14, 1.5, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'scarecrow': {
      // 杆
      ctx.fillStyle = DECO_COLORS.wood
      ctx.fillRect(c.x - 0.5, c.y - 16, 1, 16)
      // 横梁
      ctx.fillRect(c.x - 8, c.y - 10, 16, 1)
      // 头
      ctx.fillStyle = '#FFF59D'
      ctx.beginPath()
      ctx.arc(c.x, c.y - 13, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = COLOR.outline
      ctx.stroke()
      // 衣服
      ctx.fillStyle = '#5D4037'
      ctx.beginPath()
      ctx.moveTo(c.x - 4, c.y - 9)
      ctx.lineTo(c.x + 4, c.y - 9)
      ctx.lineTo(c.x + 3, c.y - 4)
      ctx.lineTo(c.x - 3, c.y - 4)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      // 帽子
      ctx.fillStyle = '#3E2723'
      ctx.fillRect(c.x - 4, c.y - 16, 8, 1.5)
      ctx.fillRect(c.x - 2.5, c.y - 18, 5, 2)
      break
    }
    case 'barrel': {
      ctx.fillStyle = DECO_COLORS.wood
      ctx.beginPath()
      ctx.ellipse(c.x, c.y - 4, 6, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      // 桶箍
      ctx.strokeStyle = '#424242'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.ellipse(c.x, c.y - 4, 6, 4, 0, 0, Math.PI)
      ctx.stroke()
      ctx.beginPath()
      ctx.ellipse(c.x, c.y - 4, 6, 4, 0, Math.PI, Math.PI * 2)
      ctx.stroke()
      break
    }
    case 'fence': {
      drawFence(ctx, wx, wy)
      break
    }
  }
  ctx.restore()
}

// ── 害虫 ───────────────────────────────────────────────

export function drawPest(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  phase: number,
): void {
  const c = worldToScreen(wx, wy, 6)
  ctx.save()
  // 身体
  ctx.fillStyle = COLOR.pestBody
  ctx.beginPath()
  ctx.ellipse(c.x, c.y, 3, 2, 0, 0, Math.PI * 2)
  ctx.fill()
  // 翅膀（透明）
  ctx.fillStyle = 'rgba(141, 110, 99, 0.6)'
  ctx.beginPath()
  ctx.ellipse(c.x - 1.5, c.y - 1, 2.5, 1.5, -0.3 + Math.sin(phase * 8) * 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(c.x + 1.5, c.y - 1, 2.5, 1.5, 0.3 - Math.sin(phase * 8) * 0.2, 0, Math.PI * 2)
  ctx.fill()
  // 触角
  ctx.strokeStyle = COLOR.pestBody
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(c.x - 2, c.y - 1.5)
  ctx.lineTo(c.x - 4, c.y - 4)
  ctx.moveTo(c.x + 2, c.y - 1.5)
  ctx.lineTo(c.x + 4, c.y - 4)
  ctx.stroke()
  ctx.restore()
}
