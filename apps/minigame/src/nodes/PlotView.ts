// 单地块视图：Cocos 2D 实现 web 端 PlotView 的核心逻辑。
// 节点树：PlotNode → { dirtRect（cc.Graphics 画的方块底色）, cropLabel（emoji+倒计时）, ringRect（状态环） }
// 每帧从 AppController 拉 plot 数据 → 算 scale/状态色/倒计时文字 → 同步到节点。
//
// 关键不变量（来自 AGENTS.md 第 44 行）：
//   "生长呈现不走 React 状态/心跳：plantedAt 时间戳是唯一事实源，帧级插值在 update 里算"
//
// M1 阶段：作物 emoji 用文字 Label 凑，CC0 sprite 后续替换；缩放曲线复用 web ease.outCubic。

import { _decorator, Component, Graphics, Label, Node, Color, UITransform, EventTouch } from 'cc'
import { CROPS, progressOf, stageOf, type AppControllerLike, type Plot } from '../types'

const { ccclass, property } = _decorator

const TILE_PX = 180
const CROP_FONT_SIZE = 48

@ccclass
export default class PlotView extends Component {
  @property(Number) index = 0

  private dirt: Graphics | null = null
  private cropLabel: Label | null = null
  private ring: Graphics | null = null

  onLoad() {
    // 地砖底色：用 Graphics 画一个圆角矩形（M1 阶段用直角矩形，避免 Graphics.roundRect 兼容性）
    this.dirt = this.addComponent(Graphics)
    this.dirt.fillColor = new Color(0x8b, 0x69, 0x14, 255)
    this.dirt.rect(-TILE_PX / 2, -TILE_PX / 2, TILE_PX, TILE_PX)
    this.dirt.fill()

    // 状态环：画在底色之上，初始透明
    this.ring = this.addComponent(Graphics)
    this.ring.strokeColor = new Color(255, 242, 176, 0)
    this.ring.lineWidth = 6
    this.ring.rect(-TILE_PX / 2 + 3, -TILE_PX / 2 + 3, TILE_PX - 6, TILE_PX - 6)
    this.ring.stroke()

    // 作物 Label
    const labelNode = new Node('crop')
    labelNode.addComponent(UITransform).setContentSize(TILE_PX, TILE_PX)
    const label = labelNode.addComponent(Label)
    label.fontSize = CROP_FONT_SIZE
    label.string = ''
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.color = new Color(255, 255, 255, 255)
    labelNode.setPosition(0, 0, 0)
    labelNode.parent = this.node
    this.cropLabel = label

    // 触摸事件
    this.node.on(Node.EventType.TOUCH_END, this.onTap, this)
  }

  onDestroy() {
    this.node.off(Node.EventType.TOUCH_END, this.onTap, this)
  }

  update(_dt: number) {
    const app = this.getApp()
    if (!app) return
    const plot = app.getData().plots[this.index]
    if (!plot) return
    this.render(plot, app)
  }

  private getApp(): AppControllerLike | null {
    return (globalThis as unknown as { __farmApp?: AppControllerLike }).__farmApp ?? null
  }

  private render(plot: Plot, app: AppControllerLike) {
    // 1. 底色 = 状态色
    if (this.dirt) {
      this.dirt.clear()
      this.dirt.fillColor = stateColor(plot.state)
      this.dirt.rect(-TILE_PX / 2, -TILE_PX / 2, TILE_PX, TILE_PX)
      this.dirt.fill()
    }
    // 2. 状态环：mature 时金色脉动
    if (this.ring) {
      this.ring.clear()
      if (plot.state === 'mature') {
        this.ring.strokeColor = new Color(255, 224, 102, 220)
      } else if (plot.state === 'withered') {
        this.ring.strokeColor = new Color(120, 60, 30, 200)
      } else {
        this.ring.strokeColor = new Color(255, 255, 255, 0)
      }
      this.ring.lineWidth = 6
      this.ring.rect(-TILE_PX / 2 + 3, -TILE_PX / 2 + 3, TILE_PX - 6, TILE_PX - 6)
      this.ring.stroke()
    }
    // 3. 作物文字 + 缩放
    if (this.cropLabel) {
      const now = Date.now()
      if (plot.crop && plot.state !== 'empty') {
        const stage = stageOf(plot, now)
        const t = progressOf(plot, now)
        const scale = 0.4 + 0.6 * easeOutCubic(t)
        const cropEmoji = CROPS[plot.crop].emoji
        const remainMs = remainingMs(plot, now)
        if (plot.state === 'mature') {
          this.cropLabel.string = cropEmoji
        } else if (remainMs !== null) {
          this.cropLabel.string = `${cropEmoji}\n${formatMmSs(remainMs)}`
        } else {
          this.cropLabel.string = cropEmoji
        }
        this.node.setScale(scale, scale, 1)
      } else {
        this.cropLabel.string = plot.state === 'withered' ? '🍂' : ''
        this.node.setScale(1, 1, 1)
      }
    }
  }

  private onTap(_e: EventTouch) {
    const app = this.getApp()
    if (!app) return
    app.handlePlot(this.index)
  }
}

// ---------- 模块级辅助（与 web motion.ts 镜像） ----------

function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return 1 - Math.pow(1 - x, 3)
}

function stateColor(state: Plot['state']): Color {
  switch (state) {
    case 'empty':    return new Color(0x8b, 0x69, 0x14, 255)
    case 'sown':     return new Color(0x7a, 0x5c, 0x1e, 255)
    case 'sprout':   return new Color(0x6d, 0xb3, 0x3f, 255)
    case 'growing':  return new Color(0x4c, 0xaf, 0x50, 255)
    case 'mature':   return new Color(0xf5, 0xc5, 0x18, 255)
    case 'withered': return new Color(0x3e, 0x27, 0x23, 255)
  }
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
