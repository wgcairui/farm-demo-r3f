// AppController：游戏入口状态壳。
// 镜像 apps/web/src/farm3d/useFarm.ts 的契约：内部持 SaveData，对外暴露 handlePlot(i)。
// 唯一区别：load/save 注入 createWxStorageBackend() 而非默认 localStorage。

import {
  CROPS,
  load,
  save,
  tickPlot,
  type CropId,
  type Plot,
  type SaveData,
  type StorageBackend,
} from '@farm/game'

export class AppController {
  private data: SaveData
  private dirty = false
  private readonly backend: StorageBackend

  constructor(backend: StorageBackend) {
    this.backend = backend
    this.data = load(backend)
  }

  // 暴露给视图层的只读快照
  getData(): Readonly<SaveData> {
    return this.data
  }

  // 选中的种子变更（来自种子栏）
  select(crop: CropId) {
    if (this.data.selected === crop) return
    this.data = { ...this.data, selected: crop }
    this.dirty = true
  }

  // 单地块交互（来自 PlotView onTouchEnd）
  // 状态机镜像 web useFarm.handlePlot：
  //   empty    → 播种 (扣金币 / checkCoins)
  //   sown/sprout/growing → 重复点击无效 (M1 阶段不做浇水/施肥)
  //   mature   → 收获 (加金币)
  //   withered → 清理 (→ empty)
  handlePlot(i: number) {
    const plot = this.data.plots[i]
    if (!plot) return
    const result = applyAction(plot, this.data)
    if (!result.changed) return // 状态没变就不写盘
    const plots = this.data.plots.slice()
    plots[i] = result.plot
    this.data = { ...this.data, ...result.delta }
    this.dirty = true
  }

  // 每帧调一次：推进 withered → empty 自动恢复 + 落盘
  tick() {
    const now = Date.now()
    let changed = false
    const plots = this.data.plots.map((p) => {
      const np = tickPlot(p, now)
      if (np !== p) {
        changed = true
        return np
      }
      return p
    })
    if (changed) {
      this.data = { ...this.data, plots }
      this.dirty = true
    }
    if (this.dirty) {
      save(this.data, this.backend)
      this.dirty = false
    }
  }
}

interface ApplyResult {
  changed: boolean
  plot: Plot
  delta: Partial<SaveData>
}

// 纯函数：从 plot + save 推出下一态。
// 拆出来是为了 AppController 内部保持简洁，方便单测。
function applyAction(plot: Plot, save: SaveData): ApplyResult {
  switch (plot.state) {
    case 'empty': {
      const def = CROPS[save.selected]
      if (save.coins < def.seedPrice) return { changed: false, plot, delta: {} }
      return {
        changed: true,
        plot: {
          crop: save.selected,
          plantedAt: Date.now(),
          state: 'sown',
          witheredAt: null,
        },
        delta: { coins: save.coins - def.seedPrice },
      }
    }
    case 'mature': {
      const def = plot.crop ? CROPS[plot.crop] : null
      const earn = def ? def.sellPrice : 0
      return {
        changed: true,
        plot: { crop: null, plantedAt: null, state: 'empty', witheredAt: null },
        delta: { coins: save.coins + earn },
      }
    }
    case 'withered': {
      return {
        changed: true,
        plot: { crop: null, plantedAt: null, state: 'empty', witheredAt: null },
        delta: {},
      }
    }
    default:
      // sown / sprout / growing → M1 阶段无操作
      return { changed: false, plot, delta: {} }
  }
}
