// 2D 版相机推近：替换 web 版 three camera 沿 z 推近 + 回位。
// 这里只暴露订阅/触发 API，rAF 主循环在 chunk 4 中读 currentScale 做 lerp。
export interface CameraFocus {
  x: number
  z: number
  /** 推近系数，1.0=默认，0.82=窄屏（web 版 harvestZoom） */
  zoom: number
  /** 推送时刻的 wall clock，rAF 用它算 ease 进度 */
  startMs: number
}

let pending: CameraFocus | null = null
const listeners = new Set<(f: CameraFocus) => void>()

export function notifyHarvestCamera(x: number, z: number, zoom = 0.82): void {
  pending = { x, z, zoom, startMs: performance.now() }
  for (const fn of listeners) fn(pending)
}

export function getPendingFocus(): CameraFocus | null {
  return pending
}

export function clearPendingFocus(): void {
  pending = null
}

export function subscribeCameraMotion(fn: (f: CameraFocus) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
