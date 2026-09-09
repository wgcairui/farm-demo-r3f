// 跨模块复用的轻量类型契约。
// 不导出 @farm/game 的全部符号，只把视图层实际用到的那部分收口。

export { CROPS, stageOf, progressOf, PLOT_COUNT, WITHER_RECOVER_MS } from '@farm/game'
export type { CropDef, CropId, Plot, PlotState, SaveData, StorageBackend } from '@farm/game'
import type { Plot } from '@farm/game'

// 视图层只需要这两个 getter；用结构化类型避免直接 import AppController 类（避免循环引用）
export interface AppControllerLike {
  getData(): { plots: Plot[]; coins: number; selected: import('@farm/game').CropId }
  handlePlot(i: number): void
  select(crop: import('@farm/game').CropId): void
}
