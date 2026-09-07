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
