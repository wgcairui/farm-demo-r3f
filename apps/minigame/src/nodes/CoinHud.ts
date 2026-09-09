// 顶部金币 HUD：💰 <金币数>。
// M1 阶段：Label + 圆角矩形背景。复用 AppController.getData().coins。

import { _decorator, Component, Graphics, Label, Node, Color, UITransform } from 'cc'
import type { AppControllerLike } from '../types'

const { ccclass, property } = _decorator

const W = 280
const H = 80

@ccclass
export default class CoinHud extends Component {
  private bg: Graphics | null = null
  private label: Label | null = null
  private lastCoins = -1

  onLoad() {
    this.bg = this.addComponent(Graphics)
    this.bg.fillColor = new Color(40, 25, 5, 220)
    this.bg.roundRect(-W / 2, -H / 2, W, H, 16)
    this.bg.fill()

    const labelNode = new Node('label')
    labelNode.parent = this.node
    labelNode.addComponent(UITransform).setContentSize(W, H)
    const label = labelNode.addComponent(Label)
    label.string = '💰 0'
    label.fontSize = 36
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.color = new Color(255, 220, 80, 255)
    labelNode.setPosition(0, 0, 0)
    this.label = label

    this.setPosition(0, 600, 0)
  }

  update(_dt: number) {
    const app = this.getApp()
    if (!app || !this.label) return
    const coins = app.getData().coins
    if (coins === this.lastCoins) return
    this.lastCoins = coins
    this.label.string = `💰 ${coins}`
  }

  private getApp(): AppControllerLike | null {
    return (globalThis as unknown as { __farmApp?: AppControllerLike }).__farmApp ?? null
  }
}
