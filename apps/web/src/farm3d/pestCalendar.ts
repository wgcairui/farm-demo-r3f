// P2-6 虫害按月份调权重：3 月少（5 月多，6-9 月回落）
// 替代 events.ts 里写死的"玉米 ×3"权重——保留作物差异化但叠加月份系数。

import type { CropId } from '@farm/game'
import { getGameDate } from './time'

/** 月份权重表：3 月 0.5 / 4 月 1.0 / 5 月 1.5 / 6-9 月 0.8 */
const MONTH_WEIGHT: Record<number, number> = {
  3: 0.5,
  4: 1.0,
  5: 1.5,
  6: 0.8,
  7: 0.8,
  8: 0.8,
  9: 0.8,
}

/** 当前月份的虫害全局权重（events.ts 调度时乘以这个） */
export function getMonthPestWeight(): number {
  return MONTH_WEIGHT[getGameDate().month] ?? 1.0
}

/** 综合权重：月份系数 × 作物偏好（玉米招虫） */
export function getPestWeight(crop: CropId): number {
  const base = crop === 'corn' ? 3 : 1
  return base * getMonthPestWeight()
}