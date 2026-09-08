// canvas origin 注册：Scene2D 在挂载时调用 setCanvasOrigin，floaters 读它做屏幕坐标。
// 替代 web 版直接读 DOM 的方式（因为 React 不会重新挂 canvas，但 ResizeObserver 改了原点）。

let origin: { x: number; y: number } | null = null

export function setCanvasOrigin(o: { x: number; y: number } | null): void {
  origin = o
}

export function getCanvasOrigin(): { x: number; y: number } | null {
  return origin
}
