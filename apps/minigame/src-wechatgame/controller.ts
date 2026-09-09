// AppController：纯游戏状态壳，不依赖任何渲染后端。
// 镜像 apps/web/src/farm3d/useFarm.ts 的契约：内部持 SaveData，
// 对外暴露 getData / handlePlot / select / tick。

import {
  CROPS,
  load,
  save,
  stageOf,
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

  getData(): Readonly<SaveData> {
    return this.data
  }

  select(crop: CropId) {
    if (this.data.selected === crop) return
    this.data = { ...this.data, selected: crop }
    this.dirty = true
  }

  handlePlot(i: number) {
    const plot = this.data.plots[i]
    if (!plot) return
    const result = applyAction(plot, this.data)
    if (!result.changed) return
    const plots = this.data.plots.slice()
    plots[i] = result.plot
    this.data = { ...this.data, ...result.delta, plots }
    this.dirty = true
  }

  tick() {
    const now = Date.now()
    let changed = false
    const plots = this.data.plots.map((p) => {
      // 1) withered → empty 自动恢复（来自 @farm/game）
      const recovered = tickPlot(p, now)
      if (recovered !== p) {
        changed = true
        return recovered
      }
      // 2) sown → growing → mature 时间推进
      // （plantedAt 是唯一事实源，每帧用 stageOf 派生；不依赖 plot.state 的旧值）
      if (p.crop && p.plantedAt !== null && p.state !== 'withered' && p.state !== 'empty') {
        const derived = stageOf(p, now)
        if (derived !== p.state) {
          changed = true
          return { ...p, state: derived }
        }
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

function applyAction(plot: Plot, saveData: SaveData): ApplyResult {
  switch (plot.state) {
    case 'empty': {
      const def = CROPS[saveData.selected]
      if (saveData.coins < def.seedPrice) return { changed: false, plot, delta: {} }
      return {
        changed: true,
        plot: {
          crop: saveData.selected,
          plantedAt: Date.now(),
          state: 'sown',
          witheredAt: null,
        },
        delta: { coins: saveData.coins - def.seedPrice },
      }
    }
    case 'mature': {
      const def = plot.crop ? CROPS[plot.crop] : null
      const earn = def ? def.sellPrice : 0
      return {
        changed: true,
        plot: { crop: null, plantedAt: null, state: 'empty', witheredAt: null },
        delta: { coins: saveData.coins + earn },
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
      return { changed: false, plot, delta: {} }
  }
}
