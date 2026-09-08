// 收获连击 combo 单例：2.5s 窗口内连续收获计数。
// 仿 events.ts 风格：模块级状态 + 发布订阅，不走 React 状态。

const COMBO_WINDOW_MS = 2500
const COMBO_FLASH_MS = 150

let comboCount = 0
let lastHarvestAt = 0
let sequence = 0
const subscribers = new Set<(c: { count: number; at: number; seq: number }) => void>()

/** 每次收获时调用；返回当前 combo。seq 在窗口过期/重置时递增，可用于 React key 强制重挂载 */
export function recordHarvest(now: number): { count: number; seq: number } {
  if (now - lastHarvestAt < COMBO_WINDOW_MS) {
    comboCount++
  } else {
    comboCount = 1
    sequence++
  }
  lastHarvestAt = now
  const payload = { count: comboCount, at: now, seq: sequence }
  subscribers.forEach((fn) => fn(payload))
  return { count: comboCount, seq: sequence }
}

/** 供 React 订阅当前 combo 状态 */
export function getCombo(): { count: number; lastAt: number } {
  return { count: comboCount, lastAt: lastHarvestAt }
}

/** 非收获动作（播种/施肥/浇水/拍虫）打断 combo */
export function resetCombo(): void {
  if (comboCount > 0) {
    comboCount = 0
    sequence++
    subscribers.forEach((fn) => fn({ count: 0, at: Date.now(), seq: sequence }))
  }
}

export function subscribeCombo(
  fn: (c: { count: number; at: number; seq: number }) => void
): () => void {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

export { COMBO_WINDOW_MS, COMBO_FLASH_MS }
