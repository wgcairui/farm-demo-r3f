// 等距投影（QQ 农场原版 2:1 tile）。
// 世界坐标 (wx, wy) —— 不叫 wz 是为了和 3D 版字段名错开避免歧义；wy 当 z 用。
// 屏幕坐标 = (sx, sy)，canvas 原点在左上。
//
// 投影矩阵：
//   sx = (wx - wy) * (TILE_W / 2)
//   sy = (wx + wy) * (TILE_H / 2)
//
// 高度（作物成长、浮字）走 sy 偏移：y_px 是垂直方向的"像素高度"，加到 sy 上等于抬高。

export const TILE_W = 64
export const TILE_H = 32

/** 高度 1 单位对应的像素（sy 方向） */
export const Y_PER_UNIT = 16

export interface Vec2 {
  x: number
  y: number
}

/** 世界坐标 → 屏幕坐标。heightPx 是垂直像素偏移（如作物 sprite 抬高、浮字） */
export function worldToScreen(wx: number, wy: number, heightPx = 0): Vec2 {
  return {
    x: (wx - wy) * (TILE_W / 2),
    y: (wx + wy) * (TILE_H / 2) - heightPx,
  }
}

/** 屏幕坐标 → 世界坐标（命中检测用）。返回的不是唯一解：忽略 height 维度 */
export function screenToWorld(sx: number, sy: number): Vec2 {
  return {
    x: (sx / (TILE_W / 2) + sy / (TILE_H / 2)) / 2,
    y: (sy / (TILE_H / 2) - sx / (TILE_W / 2)) / 2,
  }
}

/** tile 菱形 4 个顶点（用于 hit-test 和 draw） */
export function tileDiamond(wx: number, wy: number): Vec2[] {
  const c = worldToScreen(wx, wy)
  return [
    { x: c.x, y: c.y - TILE_H / 2 },
    { x: c.x + TILE_W / 2, y: c.y },
    { x: c.x, y: c.y + TILE_H / 2 },
    { x: c.x - TILE_W / 2, y: c.y },
  ]
}

/** 屏幕点是否在某个 tile 的菱形内（hit-test 主用） */
export function pointInTile(sx: number, sy: number, wx: number, wy: number): boolean {
  // 菱形边界：|dx|/(TILE_W/2) + |dy|/(TILE_H/2) <= 1
  const c = worldToScreen(wx, wy)
  const dx = Math.abs(sx - c.x)
  const dy = Math.abs(sy - c.y)
  return dx / (TILE_W / 2) + dy / (TILE_H / 2) <= 1
}

/** canvas 全局平移：让世界 (0,0) 落在 canvas 中央偏上一点，留底部 HUD 空间 */
export function defaultOrigin(canvasW: number, canvasH: number): Vec2 {
  return {
    x: canvasW / 2,
    // 顶部留 80px 给 TopBar，底部留 100px 给 BottomBar，所以居中点是 (canvasH - 80 - 100)/2 + 80
    y: 80 + (canvasH - 80 - 100) / 2 + 16,
  }
}
