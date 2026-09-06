// D7 新增：地块视觉状态层。
// PlotState → 渲染颜色（tint）的映射表。
// 6 态颜色设计：
//   empty   — 裸土棕（0x8B6914），地表平静
//   sown    — 浅土微隆起（0x7A5C1E），比 empty 略深，稍有存在感
//   sprout  — 浅绿（0x6DB33F），表明有芽冒出
//   growing — 中绿（0x4CAF50），生机勃勃
//   mature  — 金黄（0xF5C518），丰收在望
//   withered — 深棕凹下感（0x3E2723），枯萎荒废
import type { PlotState } from '@farm/game'

export const PLOT_STATE_TINT: Record<PlotState, number> = {
  empty: 0x8b6914,
  sown: 0x7a5c1e,
  sprout: 0x6db33f,
  growing: 0x4caf50,
  mature: 0xf5c518,
  withered: 0x3e2723,
}

/** 该状态是否可恢复（点击清理后变 empty） */
export function isRecoverable(state: PlotState): boolean {
  return state === 'withered'
}
