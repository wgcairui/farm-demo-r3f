// P2-1 新手引导单例：命令式状态机，零 React 依赖（双端均可复用）。
// step: 0=未开始, 1=选种, 2=播种, 3=等待收获, 'done'=完成
// 持久化：引导完成/跳过后写 localStorage，刷新不再出现。

export type TutorialStep = 0 | 1 | 2 | 3 | 'done'

export interface TutorialState {
  step: TutorialStep
  /** 永久关闭（写 localStorage） */
  complete: boolean
  /** 引导指向的地块下标（step 2/3 时有效） */
  targetPlot: number | null
}

const STEP_KEY = 'farm-demo-tutorial-v1'

type Subscriber = (s: TutorialState) => void
const _subscribers = new Set<Subscriber>()

let _state: TutorialState = {
  step: 0,
  complete: false,
  targetPlot: null,
}

/** 从 localStorage 读取是否永久关闭 */
export function loadTutorialDone(): boolean {
  try {
    return localStorage.getItem(STEP_KEY) === 'done'
  } catch {
    return false
  }
}

/** 开始引导：step=1，重置 complete 与 targetPlot */
export function startTutorial(): void {
  _state = { step: 1, complete: false, targetPlot: null }
  _notify()
}

/** 进入下一步（可选传入地块下标，用于 step=2→3 时记录刚播种的地块） */
export function nextStep(plantedPlot?: number): void {
  switch (_state.step) {
    case 1:
      _state = { ..._state, step: 2, targetPlot: 0 }
      break
    case 2:
      // 记录刚播种的地块，等它成熟
      _state = { ..._state, step: 3, targetPlot: plantedPlot ?? _state.targetPlot }
      break
    default:
      return
  }
  _notify()
}

/** 跳过引导 */
export function skipTutorial(): void {
  _state = { step: 'done', complete: true, targetPlot: null }
  try {
    localStorage.setItem(STEP_KEY, 'done')
  } catch {
    /* 隐私模式 */
  }
  _notify()
}

/** 完成引导（收获后） */
export function finishTutorial(): void {
  _state = { step: 'done', complete: true, targetPlot: null }
  try {
    localStorage.setItem(STEP_KEY, 'done')
  } catch {
    /* 隐私模式 */
  }
  _notify()
}

/** 订阅状态变更，返回取消订阅函数 */
export function subscribeTutorial(fn: Subscriber): () => void {
  _subscribers.add(fn)
  return () => _subscribers.delete(fn)
}

/** 获取当前状态（初始加载时用） */
export function getTutorialState(): TutorialState {
  return _state
}

function _notify(): void {
  for (const fn of _subscribers) fn(_state)
}

// —— 初始化：页面加载时检查 localStorage ——
if (loadTutorialDone()) {
  _state = { step: 'done', complete: true, targetPlot: null }
}
