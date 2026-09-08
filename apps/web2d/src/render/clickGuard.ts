// 拖拽 vs 点击判定：在地块上按下并拖走再松手（orbit 起手）不该触发播种/收获。
// PRD 规范：位移 ≤ 8px 判定为点击。
let downX = 0
let downY = 0

export function trackPointerDown(e: { clientX: number; clientY: number }) {
  downX = e.clientX
  downY = e.clientY
}

export function isClick(e: { clientX: number; clientY: number }, threshold = 8) {
  return Math.hypot(e.clientX - downX, e.clientY - downY) <= threshold
}
