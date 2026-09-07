// 相机反馈事件：用命令式单例连接 UI/游戏交互与 Three 相机，避免每帧 React 重渲染。

export interface HarvestCameraEvent {
  x: number
  z: number
  at: number
}

let latestHarvest: HarvestCameraEvent | null = null
let sequence = 0

export function notifyHarvestCamera(x: number, z: number): void {
  latestHarvest = { x, z, at: performance.now() }
  sequence += 1
}

export function readHarvestCamera(): { event: HarvestCameraEvent | null; sequence: number } {
  return { event: latestHarvest, sequence }
}

/** 当前已派发的 sequence。组件挂载时用来与 lastHarvestSeqRef 同步，避免 StrictMode 重放过期事件 */
export function getCameraSequence(): number {
  return sequence
}

/**
 * 清空事件：组件卸载时调用，避免 StrictMode 双挂载期间被 stale event 触发幽灵动画
 * 不重置 sequence——sequence 是递增的，重置后 sequence 反而会让消费方误判「重放过期」
 */
export function resetHarvestCamera(): void {
  latestHarvest = null
}
