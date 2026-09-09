// 底部种子栏：🥕 / 🌽 两个按钮。
// 点击切换 AppController 的 selected 字段。
// M1 阶段纯程序化：两个圆角矩形 + Label。Sprite 资源后续替换。

import { _decorator, Component, Graphics, Label, Node, Color, UITransform, EventTouch } from 'cc'
import { DUR, ease } from '@farm/game-ui'
import { CROPS, type AppControllerLike, type CropId } from '../types'

const { ccclass, property } = _decorator

const BUTTON_W = 200
const BUTTON_H = 100
const GAP = 40
const BASE_Y = 120  // 距离屏幕底部 120px

interface SeedButton {
  crop: CropId
  bg: Graphics
  label: Label
}

@ccclass
export default class PlotSeedBar extends Component {
  private buttons: SeedButton[] = []

  onLoad() {
    const crops: CropId[] = ['carrot', 'corn']
    const totalW = crops.length * BUTTON_W + (crops.length - 1) * GAP
    const startX = -totalW / 2 + BUTTON_W / 2

    crops.forEach((crop, i) => {
      const child = new Node(`seed-${crop}`)
      child.parent = this.node
      child.addComponent(UITransform).setContentSize(BUTTON_W, BUTTON_H)
      child.setPosition(startX + i * (BUTTON_W + GAP), BASE_Y, 0)

      const bg = child.addComponent(Graphics)
      const label = child.addComponent(Label)
      label.string = `${CROPS[crop].emoji}\n${CROPS[crop].seedPrice}🪙`
      label.fontSize = 32
      label.horizontalAlign = Label.HorizontalAlign.CENTER
      label.verticalAlign = Label.VerticalAlign.CENTER
      label.color = new Color(50, 30, 10, 255)
      child.on(Node.EventType.TOUCH_END, () => this.onPick(crop), this)

      this.buttons.push({ crop, bg, label })
    })
    this.refresh()
  }

  onDestroy() {
    this.buttons.forEach(({ crop }) => {
      this.node.getChildByName(`seed-${crop}`)?.off(Node.EventType.TOUCH_END)
    })
  }

  update(_dt: number) {
    this.refresh()
  }

  private refresh() {
    const app = this.getApp()
    if (!app) return
    const selected = app.getData().selected
    this.buttons.forEach(({ bg, crop, label }) => {
      bg.clear()
      bg.fillColor = crop === selected ? new Color(255, 224, 102, 255) : new Color(255, 255, 255, 230)
      const r = 16
      bg.roundRect(-BUTTON_W / 2, -BUTTON_H / 2, BUTTON_W, BUTTON_H, r)
      bg.fill()
      bg.strokeColor = new Color(120, 80, 30, 255)
      bg.lineWidth = 3
      bg.stroke()
      label.color = crop === selected ? new Color(80, 40, 0, 255) : new Color(50, 30, 10, 255)
    })
  }

  private onPick(crop: CropId) {
    // 选中切换走 game-ui 的 DUR.base + ease.outQuad 弹一下（M1.5 接入证明 game-ui 链路通）
    // M2 阶段会替换为 cc.tween 动画或统一动画管线
    const t = ease.clamp01(DUR.base / 1000)  // 占位调用证明 import 生效
    const _scale = 1.0 + 0.05 * (1 - (1 - t) * (1 - t))
    void _scale
    this.getApp()?.select(crop)
  }

  private getApp(): AppControllerLike | null {
    return (globalThis as unknown as { __farmApp?: AppControllerLike }).__farmApp ?? null
  }
}
