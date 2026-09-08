// 6 块地的世界坐标布局：2 行 × 3 列，围绕原点对称。
// 索引与 packages/game 的 plots 数组下标一一对应，D2 接逻辑时直接用。
export const PLOT_ROWS = 2
export const PLOT_COLS = 3
export const PLOT_GAP = 1.0

/** 两组地块的世界原点偏移（避免与 cottage / trees / fence 重叠） */
export const PLOT_GROUP_ORIGINS: [number, number][] = [
  [0, 0],     // group 0：原 6 块，围绕世界原点
  [-8, 5.5],  // group 1：左后方新 6 块
]
export const PLOT_GROUP_COUNT = PLOT_GROUP_ORIGINS.length

/** 第 i 块地、groupIdx 组的 [x, z] 世界坐标 */
export function plotPosition(i: number, groupIdx: number = 0): [number, number] {
  const [baseX, baseZ] = PLOT_GROUP_ORIGINS[groupIdx] ?? [0, 0]
  const row = Math.floor(i / PLOT_COLS)
  const col = i % PLOT_COLS
  return [baseX + (col - (PLOT_COLS - 1) / 2) * PLOT_GAP, baseZ + (row - (PLOT_ROWS - 1) / 2) * PLOT_GAP]
}
