// 6 块地的世界坐标布局：2 行 × 3 列，围绕原点对称。
// 索引与 packages/game 的 plots 数组下标一一对应，D2 接逻辑时直接用。
export const PLOT_ROWS = 2
export const PLOT_COLS = 3
export const PLOT_GAP = 1.2

/** 第 i 块地的 [x, z] 世界坐标 */
export function plotPosition(i: number): [number, number] {
  const row = Math.floor(i / PLOT_COLS)
  const col = i % PLOT_COLS
  return [(col - (PLOT_COLS - 1) / 2) * PLOT_GAP, (row - (PLOT_ROWS - 1) / 2) * PLOT_GAP]
}
