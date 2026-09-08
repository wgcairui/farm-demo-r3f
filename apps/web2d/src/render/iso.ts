// 等距投影（QQ 农场原版 2:1 tile）。
// 世界坐标 (wx, wy) —— 不叫 wz 是为了和 3D 版字段名错开避免歧义；wy 当 z 用。
// 屏幕坐标 = (canvas, canvas)，canvas 原点在左上。
//
// 投影矩阵：
//   sx = (wx - wy) * (TILE_W / 2)
//   sy = (wx + wy) * (TILE_H / 2)
//
// 高度（作物成长、浮字）走 sy 偏移：heightPx 是垂直方向的"像素高度"，加到 sy 上等于抬高。

export const TILE_W = 88
export const TILE_H = 44

/** 高度 1 单位对应的像素（sy 方向） */
export const Y_PER_UNIT = 16

/** tile 圆角半径（视觉接近 QQ 农场截图） */
export const TILE_RADIUS = 6

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

/**
 * 圆角方块（QQ 农场风）的 AABB 矩形（屏幕坐标）。
 * 比菱形更适合圆角地块渲染与命中。
 * 返回 4 个顶点：左上、右上、右下、左下，顺时针。
 */
export function tileAABB(wx: number, wy: number): {
  left: number
  top: number
  right: number
  bottom: number
} {
  const c = worldToScreen(wx, wy)
  // 等距 2:1 投影下，tile 中心到 4 边的距离：
  // 水平 = TILE_W/2，垂直 = TILE_H/2
  return {
    left: c.x - TILE_W / 2,
    top: c.y - TILE_H / 2,
    right: c.x + TILE_W / 2,
    bottom: c.y + TILE_H / 2,
  }
}

/**
 * 屏幕点是否在某个 tile 的圆角方块内（hit-test 主用）。
 * 先 AABB 粗判，再对 4 个圆角做修正：点到矩形边的最小距离 > r 才算完全在内。
 * 简化：用 AABB 内切 0..1 插值距离做修正（精确几何代价高，简化够用）。
 */
export function pointInTile(sx: number, sy: number, wx: number, wy: number): boolean {
  const b = tileAABB(wx, wy)
  // 圆角修正阈值：把判定收紧 r px，让圆角处的点不会被算作"在内"
  const r = TILE_RADIUS
  // 1) AABB 粗判
  if (sx < b.left + r * 0.7 || sx > b.right - r * 0.7) {
    // 处于左右边缘带，需要进一步看是否在圆角内
    if (sy < b.top + r || sy > b.bottom - r) {
      // 处于 4 个圆角之一
      const cornerCx = sx < (b.left + b.right) / 2 ? b.left + r : b.right - r
      const cornerCy = sy < (b.top + b.bottom) / 2 ? b.top + r : b.bottom - r
      const dx = sx - cornerCx
      const dy = sy - cornerCy
      return dx * dx + dy * dy <= r * r
    }
    return sx >= b.left && sx <= b.right
  }
  return sx >= b.left && sx <= b.right && sy >= b.top && sy <= b.bottom
}

/** canvas 全局平移：让世界 (0,0) 落在 canvas 中央偏上一点，留底部 HUD 空间 */
export function defaultOrigin(canvasW: number, canvasH: number): Vec2 {
  return {
    x: canvasW / 2,
    // 顶部留 80px 给 TopBar，底部留 100px 给 BottomBar，所以居中点是 (canvasH - 80 - 100)/2 + 80
    y: 80 + (canvasH - 80 - 100) / 2 + 16,
  }
}