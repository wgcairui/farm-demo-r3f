// 程序化 sprite 绘制（Canvas2D 原语）。所有函数接收 ctx + 已投影到屏幕的坐标。
// 不调 beginPath/endPath 之外的副作用，调用方负责 save/restore。
//
// chunk 3：地块 + 作物最小集。
// chunk 5：补全 deco（仓库/树/狗/池塘/小屋/石板路/围栏）+ 4 种摆件 + 害虫。
// chunk 6：地块改圆角方块 + 渐变填充 + 进度环 + 成熟脉冲光晕；场景微动 + 装饰密度。

import type { CropId, PlotState } from '@farm/game'
import { worldToScreen, tileAABB, TILE_RADIUS, TILE_W, TILE_H } from './iso'
import type { DecorationKind } from '../state/decorations'

// ── 色板 ───────────────────────────────────────────────
export const COLOR: Record<string, string> = {
  // tile 渐变用：empty 暖沙土（QQ 农场风）
  dirtEmptyLight: '#D4A373',
  dirtEmptyDark: '#A07845',
  dirtDarkLight: '#8B5A2B',
  dirtDarkDark: '#5D4037',
  dirtWitheredLight: '#6D6058',
  dirtWitheredDark: '#3E3838',
  dirtEmptyGlow: '#C9A36B',
  // 进度条
  progressBg: 'rgba(0,0,0,0.25)',
  progressLow: '#7CB342',
  progressHigh: '#FBC02D',
  // 描边
  outline: '#3E2723',
  // 作物
  sprout: '#7CB342',
  sproutDark: '#558B2F',
  carrotOrange: '#FF7043',
  carrotShadow: '#D84315',
  cornYellow: '#FBC02D',
  cornShadow: '#F9A825',
  cornGreen: '#7CB342',
  // 害虫
  pestBody: '#5D4037',
  pestWing: '#8D6E63',
  // 装饰新增
  vineGreen: '#66BB6A',
  flowerYellow: '#FBC02D',
  flowerWhite: '#FAFAFA',
  flowerPink: '#F48FB1',
  boneWhite: '#FFF8E1',
  stoneLight: '#9E9E9E',
  stoneDark: '#616161',
  cloudWhite: 'rgba(255,255,255,0.85)',
  smokeGray: 'rgba(180,180,180,0.5)',
  signWood: '#8D6E63',
}

// ── 地块（圆角方块 + 渐变 + 进度环 + 成熟光晕） ─────────────────
export interface DrawTileOpts {
  /** empty 状态的呼吸 alpha 0..1（rAF 传入） */
  pulse?: number
  /** 是否处于"可种植"高亮（教程 step=2 时） */
  highlight?: boolean
  /** progressOf(plot, now) 0..1；sprout/growing 阶段用，画底部进度条 */
  progress?: number
  /** rAF 性能时间戳（秒），用于成熟脉冲 + 作物弹跳 */
  phase?: number
}

export function drawTile(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  state: PlotState,
  opts: DrawTileOpts = {},
): void {
  const b = tileAABB(wx, wy)
  const c = worldToScreen(wx, wy)
  const r = TILE_RADIUS

  // 圆角矩形路径（标准 4-arcTo）
  ctx.beginPath()
  ctx.moveTo(b.left + r, b.top)
  ctx.lineTo(b.right - r, b.top)
  ctx.arcTo(b.right, b.top, b.right, b.top + r, r)
  ctx.lineTo(b.right, b.bottom - r)
  ctx.arcTo(b.right, b.bottom, b.right - r, b.bottom, r)
  ctx.lineTo(b.left + r, b.bottom)
  ctx.arcTo(b.left, b.bottom, b.left, b.bottom - r, r)
  ctx.lineTo(b.left, b.top + r)
  ctx.arcTo(b.left, b.top, b.left + r, b.top, r)
  ctx.closePath()

  // 渐变填充：左上→右下，3 套配色按 state
  let top: string
  let bottom: string
  switch (state) {
    case 'empty':
      top = COLOR.dirtEmptyLight
      bottom = COLOR.dirtEmptyDark
      break
    case 'withered':
      top = COLOR.dirtWitheredLight
      bottom = COLOR.dirtWitheredDark
      break
    default:
      // sown/sprout/growing/mature 同一色：深土
      top = COLOR.dirtDarkLight
      bottom = COLOR.dirtDarkDark
  }
  const grad = ctx.createLinearGradient(b.left, b.top, b.right, b.bottom)
  grad.addColorStop(0, top)
  grad.addColorStop(1, bottom)
  ctx.fillStyle = grad
  ctx.fill()

  // empty 呼吸脉动：金色光晕叠层（半透明覆盖）
  if (state === 'empty' && opts.pulse !== undefined) {
    ctx.save()
    ctx.globalAlpha = 0.18 + 0.22 * opts.pulse
    ctx.fillStyle = COLOR.dirtEmptyGlow
    ctx.fill()
    ctx.restore()
  }

  // 成熟金色脉冲光晕：在底色之上画一层更亮的渐变
  if (state === 'mature' && opts.phase !== undefined) {
    ctx.save()
    const pulseAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(opts.phase * 4))
    ctx.globalAlpha = pulseAlpha
    const mg = ctx.createLinearGradient(b.left, b.top, b.right, b.bottom)
    mg.addColorStop(0, '#FFE082')
    mg.addColorStop(1, '#FBC02D')
    ctx.fillStyle = mg
    ctx.fill()
    ctx.restore()
  }

  // 描边：成熟用金色脉冲描边，其他用深棕
  if (state === 'mature' && opts.phase !== undefined) {
    ctx.save()
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(opts.phase * 4)
    ctx.strokeStyle = '#FFC107'
    ctx.lineWidth = 2
    ctx.stroke()
    // 再描一层深棕保边
    ctx.globalAlpha = 0.4
    ctx.strokeStyle = COLOR.outline
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
  } else if (opts.highlight) {
    ctx.save()
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 200)
    ctx.strokeStyle = '#FFC107'
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.restore()
  } else {
    ctx.strokeStyle = COLOR.outline
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

  // 进度环：sprout/growing 状态，底部 4px 进度条
  if ((state === 'sprout' || state === 'growing') && opts.progress !== undefined) {
    drawProgressBar(ctx, b, opts.progress)
  }
}

/** 地块底部 4px 进度条：绿→金渐变 + 半透明背景轨道 + 圆角 */
function drawProgressBar(
  ctx: CanvasRenderingContext2D,
  b: { left: number; top: number; right: number; bottom: number },
  progress: number,
): void {
  const t = Math.min(1, Math.max(0, progress))
  const barH = 4
  const barY = b.bottom - barH - 2
  const inset = 4
  const barLeft = b.left + inset
  const barRight = b.right - inset
  const barWidth = barRight - barLeft

  // 背景轨道（半透明黑）
  ctx.save()
  ctx.fillStyle = COLOR.progressBg
  roundRectPath(ctx, barLeft, barY, barWidth, barH, 2)
  ctx.fill()
  ctx.restore()

  // 填充（绿→金颜色插值）
  if (t > 0) {
    const fillWidth = Math.max(barH, barWidth * t)
    const r = Math.round(124 + (251 - 124) * t)
    const g = Math.round(180 + (192 - 180) * t)
    const bl = Math.round(66 + (45 - 66) * t)
    ctx.save()
    ctx.fillStyle = `rgb(${r},${g},${bl})`
    roundRectPath(ctx, barLeft, barY, fillWidth, barH, 2)
    ctx.fill()
    ctx.restore()
  }
}

/** ctx.beginPath() 圆角矩形（手拼 arcTo 路径，兼容老浏览器） */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
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
  /** rAF 性能时间戳（秒），用于 mature 阶段作物轻微弹跳 */
  phase?: number
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
    // 成熟时作物轻微弹跳（±0.8px）+ 整体 1.04 缩放
    const bounce = opts.phase !== undefined ? Math.sin(opts.phase * 8) * 0.8 : 0
    const scale = opts.phase !== undefined ? 1 + 0.04 * Math.sin(opts.phase * 6) : 1
    ctx.save()
    ctx.translate(c.x, c.y + bounce)
    ctx.scale(scale, scale)
    ctx.translate(-c.x, -c.y)
    drawMature(ctx, c.x, c.y, crop)
    ctx.restore()
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

export function drawCottage(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  phase: number = 0,
): void {
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
  // 烟囱（屋顶右侧伸出的方块）
  ctx.fillStyle = '#8D6E63'
  ctx.fillRect(c.x + 6, c.y - 28, 4, 8)
  ctx.strokeRect(c.x + 6, c.y - 28, 4, 8)
  // 烟（3 朵椭圆上飘，错相位）
  for (let i = 0; i < 3; i++) {
    const t = ((phase * 0.3 + i * 0.33) % 1)
    const sx = c.x + 8 + Math.sin(phase * 1.5 + i) * 2
    const sy = c.y - 28 - t * 24
    const alpha = (1 - t) * 0.5
    const r = 2 + t * 2
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = '#BDBDBD'
    ctx.beginPath()
    ctx.ellipse(sx, sy, r, r * 0.7, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()
}

export function drawWarehouse(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  phase: number = 0,
): void {
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
  // 门把手
  ctx.fillStyle = COLOR.outline
  ctx.beginPath()
  ctx.arc(c.x + 4, c.y - 6, 0.8, 0, Math.PI * 2)
  ctx.fill()
  // 梯子（右侧 5 根横档）
  ctx.fillStyle = '#8D6E63'
  ctx.fillRect(c.x + 22, c.y - 14, 1.2, 14)
  ctx.fillRect(c.x + 26, c.y - 14, 1.2, 14)
  for (let i = 0; i < 5; i++) {
    const y = c.y - 12 + i * 2.5
    ctx.fillRect(c.x + 22, y, 5.2, 0.8)
  }
  // 一袋种子（左侧地上）
  ctx.save()
  ctx.translate(c.x - 18, c.y - 1)
  ctx.fillStyle = '#A1887F'
  ctx.beginPath()
  ctx.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = COLOR.outline
  ctx.lineWidth = 0.5
  ctx.stroke()
  // 缝线
  ctx.beginPath()
  ctx.moveTo(-2, -2)
  ctx.lineTo(-1, 2)
  ctx.moveTo(2, -2)
  ctx.lineTo(1, 2)
  ctx.stroke()
  ctx.restore()
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
  // 树冠：3 圆，phase 让外圈微微呼吸 + 整体随风摆动（±0.05 rad）
  ctx.save()
  ctx.translate(c.x, c.y - 14)
  ctx.rotate(Math.sin(phase * 1.5) * 0.05)
  ctx.translate(-c.x, -(c.y - 14))
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
  // 涟漪扩散：3 圈错相位（每 1.5 秒扩散 8px→24px 后循环）
  for (let i = 0; i < 3; i++) {
    const t = ((phase * 0.4 + i * 0.33) % 1)
    const radius = 10 + t * 14
    ctx.save()
    ctx.globalAlpha = (1 - t) * 0.5
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.ellipse(c.x, c.y, radius, radius * 0.5, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
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
  // 鼻子（黑点）
  ctx.fillStyle = '#3E2723'
  ctx.beginPath()
  ctx.arc(c.x + 10, c.y - 4.5, 0.8, 0, Math.PI * 2)
  ctx.fill()
  // 腿（走路时上下抬腿，摆幅 1.5→2.5）
  const legLift = walking ? Math.sin(phase * 8) * 2.5 : 0
  ctx.fillStyle = DECO_COLORS.dogDark
  ctx.fillRect(c.x - 5, c.y - 1, 1.5, 3 - legLift)
  ctx.fillRect(c.x - 2, c.y - 1, 1.5, 3 + legLift)
  ctx.fillRect(c.x + 2, c.y - 1, 1.5, 3 - legLift)
  ctx.fillRect(c.x + 5, c.y - 1, 1.5, 3 + legLift)
  // 尾巴（摆，摆幅 1.5→2.5）
  ctx.strokeStyle = DECO_COLORS.dog
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(c.x - 8, c.y - 5)
  const tailY = c.y - 9 + Math.sin(phase * 4) * 2.5
  ctx.lineTo(c.x - 12, tailY)
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
  // 藤蔓小圆点（沿横梁 3 处，绿色）
  ctx.fillStyle = COLOR.vineGreen
  for (const vx of [c.x - 4, c.x, c.x + 4]) {
    ctx.beginPath()
    ctx.arc(vx, c.y - 4, 1.2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// ── 新增装饰函数（chunk 6：场景微动 + 装饰密度） ─────────────────

/** 云朵（白色椭圆 + 慢飘，由调用方控制 x 偏移） */
export function drawCloud(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number = 1,
): void {
  ctx.save()
  ctx.globalAlpha = 0.85
  ctx.fillStyle = COLOR.cloudWhite
  // 3 段椭圆叠加做蓬松感
  ctx.beginPath()
  ctx.ellipse(cx, cy, 18 * scale, 7 * scale, 0, 0, Math.PI * 2)
  ctx.ellipse(cx - 12 * scale, cy + 1, 11 * scale, 5 * scale, 0, 0, Math.PI * 2)
  ctx.ellipse(cx + 12 * scale, cy + 1, 11 * scale, 5 * scale, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** 小花丛：6 朵程序化小花，每朵 5 瓣 */
export function drawFlower(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  seed: number = 1,
): void {
  const c = worldToScreen(wx, wy, 0)
  ctx.save()
  const colors = [COLOR.flowerYellow, COLOR.flowerWhite, COLOR.flowerPink]
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + seed
    const r = 3 + (i % 2) * 1.5
    const fx = c.x + Math.cos(a) * r
    const fy = c.y + Math.sin(a) * r * 0.4
    const color = colors[(i + seed) % 3]
    ctx.fillStyle = color
    // 5 瓣小花
    for (let p = 0; p < 5; p++) {
      const pa = (p / 5) * Math.PI * 2
      ctx.beginPath()
      ctx.ellipse(fx + Math.cos(pa) * 1.2, fy + Math.sin(pa) * 1.2, 1.2, 0.8, pa, 0, Math.PI * 2)
      ctx.fill()
    }
    // 花心
    ctx.fillStyle = '#FFC107'
    ctx.beginPath()
    ctx.arc(fx, fy, 0.6, 0, Math.PI * 2)
    ctx.fill()
  }
  // 中央草
  ctx.fillStyle = COLOR.sproutDark
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(c.x - 1, c.y, 0.6, 1.5 + i * 0.5)
  }
  ctx.restore()
}

/** 木牌标志（带 emoji + 短竹竿） */
export function drawSign(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  emoji: string = '🧑‍🌾',
): void {
  const c = worldToScreen(wx, wy, 0)
  ctx.save()
  // 竹竿
  ctx.fillStyle = '#5D4037'
  ctx.fillRect(c.x - 0.5, c.y - 8, 1, 10)
  // 木牌
  ctx.fillStyle = COLOR.signWood
  ctx.fillRect(c.x - 6, c.y - 14, 12, 8)
  ctx.strokeStyle = COLOR.outline
  ctx.lineWidth = 0.6
  ctx.strokeRect(c.x - 6, c.y - 14, 12, 8)
  // emoji（用 fillText）
  ctx.font = '8px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, c.x, c.y - 10)
  ctx.restore()
}

/** 骨头玩具（白色椭圆 + 圆头） */
export function drawBone(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
): void {
  const c = worldToScreen(wx, wy, 0)
  ctx.save()
  ctx.fillStyle = COLOR.boneWhite
  ctx.strokeStyle = COLOR.outline
  ctx.lineWidth = 0.6
  // 中段
  ctx.beginPath()
  ctx.ellipse(c.x, c.y, 4, 1.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // 两端圆头
  ctx.beginPath()
  ctx.arc(c.x - 4, c.y, 1.5, 0, Math.PI * 2)
  ctx.arc(c.x + 4, c.y, 1.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

/** 石头堆（多边形 + 描边） */
export function drawStone(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  scale: number = 1,
): void {
  const c = worldToScreen(wx, wy, 0)
  ctx.save()
  ctx.fillStyle = COLOR.stoneLight
  ctx.strokeStyle = COLOR.stoneDark
  ctx.lineWidth = 0.8
  // 大石头
  ctx.beginPath()
  ctx.ellipse(c.x, c.y, 5 * scale, 3 * scale, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // 小石头
  ctx.fillStyle = '#BDBDBD'
  ctx.beginPath()
  ctx.ellipse(c.x - 4 * scale, c.y + 1, 2.5 * scale, 1.5 * scale, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(c.x + 4 * scale, c.y + 1, 3 * scale, 1.8 * scale, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
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
