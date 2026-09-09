// Canvas 2D 渲染层类型契约。
// 视图组件只通过 AppControllerLike 与控制器通信，避免循环依赖。

import type { CropId, Plot } from '@farm/game'

export interface AppControllerLike {
  getData(): { plots: Plot[]; coins: number; selected: CropId }
  handlePlot(i: number): void
  select(crop: CropId): void
}
