// 6 块地的屏幕坐标布局：镜像 web 端 2×3 网格约定，
// 但单位改成"设计分辨率下的像素"，方便直接 setPosition。
//
// designResolution = 750×1334（见 project.json）
// 地砖目标尺寸：180px，列间距 30px；整体居中于屏幕中部。

export const PLOT_ROWS = 2
export const PLOT_COLS = 3

/** 单块地砖目标尺寸（像素，正方形） */
export const PLOT_TILE_PX = 180

/** 列间距 / 行间距（像素） */
export const PLOT_GAP_X = 30
export const PLOT_GAP_Y = 30

/** 整个地块网格的左上角锚点（像素，cc 默认左下原点，这里给出中心点公式即可） */
export const FARM_AREA_CENTER_Y = 700  // 屏幕中央偏上

/** 第 i 块地的屏幕中心点（cc 坐标系，左下原点） */
export function plotScreenCenter(i: number, designWidth: number, designHeight: number): { x: number; y: number } {
  const row = Math.floor(i / PLOT_COLS)
  const col = i % PLOT_COLS
  const totalW = PLOT_COLS * PLOT_TILE_PX + (PLOT_COLS - 1) * PLOT_GAP_X
  const totalH = PLOT_ROWS * PLOT_TILE_PX + (PLOT_ROWS - 1) * PLOT_GAP_Y
  const startX = (designWidth - totalW) / 2 + PLOT_TILE_PX / 2
  // 整个地块网格的纵向中心放在 FARM_AREA_CENTER_Y
  const centerY = designHeight - FARM_AREA_CENTER_Y  // cc 坐标左下原点
  const startY = centerY + totalH / 2 - PLOT_TILE_PX / 2
  return {
    x: startX + col * (PLOT_TILE_PX + PLOT_GAP_X),
    y: startY - row * (PLOT_TILE_PX + PLOT_GAP_Y),
  }
}
