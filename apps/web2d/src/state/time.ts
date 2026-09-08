// P2-6 春季日历基础设施：日历是 UI 层与持久化字段，游戏规则时间仍走墙钟
// （packages/game 零 diff）。把"时间"拆成两层：
//   事实时间 wall-clock: now = Date.now() - startAtMs + elapsedOffsetMs（喂给 stageOf/progressOf/tickPlot）
//   游戏时间: currentGameDay = floor(elapsedMs / MS_PER_DAY) → forecast[currentGameDay]
//
// persisted 字段：
//   startAtMs: 游戏开始的"真实时刻"——决定「当前是哪个游戏日」的基准。
//             默认 Date.now()（首进游戏即春耕开局）。
//   elapsedOffsetMs: 玩家手动快进的偏移。点击 ⏩ 时 += MS_PER_DAY（可负向）。
// elapsedMs = (Date.now() - startAtMs) + elapsedOffsetMs
// 这样所有玩家操作与"已经过去的真实时间"在同一根时间线上推进。

/** 1 游戏日 = 现实 60s；调这个值全局放缩节奏 */
export const MS_PER_DAY = 60_000

/** 春季范围：3 月 1 日 ~ 9 月 30 日（180 天） */
export const TOTAL_DAYS = 180

/** 起始月日（春耕开局：3 月 1 日 06:00） */
const START_MONTH = 3
const START_DAY = 1
/** 开局时刻偏移：elapsedMs = 0 时显示「3 月 1 日 06:00」 */
const START_HOUR_OFFSET_MS = (6 / 24) * MS_PER_DAY

export interface GameDate {
  month: number // 3..9
  day: number // 1..30
  hour: number // 0..23
}

interface TimePersisted {
  startAtMs: number
  elapsedOffsetMs: number
}

const TKEY = 'farm-time-v1'

let startAtMs: number = Date.now()
let elapsedOffsetMs = 0

// —— 持久化恢复 ——
try {
  const raw = localStorage.getItem(TKEY)
  if (raw) {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) {
      const p = parsed as Record<string, unknown>
      if (typeof p.startAtMs === 'number' && Number.isFinite(p.startAtMs)) startAtMs = p.startAtMs
      if (typeof p.elapsedOffsetMs === 'number' && Number.isFinite(p.elapsedOffsetMs)) elapsedOffsetMs = p.elapsedOffsetMs
    }
  }
} catch {
  /* 损坏即用默认 */
}

function flush(): void {
  try {
    localStorage.setItem(TKEY, JSON.stringify({ startAtMs, elapsedOffsetMs } satisfies TimePersisted))
  } catch {
    /* 隐私模式静默 */
  }
}
if (typeof window !== 'undefined') window.addEventListener('pagehide', flush)

/** 自启动至今的"游戏毫秒数"（真实时间 + 快进偏移 + 开局 6 点偏移） */
export function getElapsedMs(): number {
  return Date.now() - startAtMs + elapsedOffsetMs + START_HOUR_OFFSET_MS
}

/** 模拟"现在"：喂给游戏包用的墙钟（已叠加快进偏移） */
export function getNow(): number {
  return startAtMs + getElapsedMs()
}

/** 当前是第几个游戏日（0 = 3 月 1 日） */
export function getGameDay(): number {
  return Math.max(0, Math.floor(getElapsedMs() / MS_PER_DAY))
}

/** 真实小时（24h 制）：玩家主观时间是「3 月 1 日 06:00 开始，每 60s 走完 1 天」 */
export function getGameHour(): number {
  return Math.floor((getElapsedMs() % MS_PER_DAY) / (MS_PER_DAY / 24))
}

/** 解析为 {month, day, hour} */
export function getGameDate(): GameDate {
  const totalDays = getGameDay()
  const hour = getGameHour()
  // 简化：每月 30 天；起始 3 月 1 日 = day 0
  const monthOffset = Math.floor(totalDays / 30)
  const dayInMonth = totalDays - monthOffset * 30
  return {
    month: START_MONTH + monthOffset,
    day: START_DAY + dayInMonth,
    hour,
  }
}

/** 快进 N 天（N 可负） */
export function fastForward(days: number): void {
  elapsedOffsetMs += days * MS_PER_DAY
  flush()
}

/** 跳到指定游戏日（0 = 3 月 1 日） */
export function jumpToGameDay(day: number): void {
  const current = getGameDay()
  fastForward(day - current)
}

// 内部：forecast 模块通过 registerForecastLookup 注册查表函数，避免循环依赖
type ForecastLookup = (day: number) => { kind: string } | null
let forecastLookup: ForecastLookup | null = null
/** 由 forecast 模块在初始化时注册 */
export function registerForecastLookup(fn: ForecastLookup): void {
  forecastLookup = fn
}

/** 跳到下一个雨日（>= 明天）；返回 true 表示已跳，false 表示已无雨日可跳 */
export function jumpToNextRain(): boolean {
  if (!forecastLookup) return false
  const fromDay = getGameDay()
  for (let d = fromDay + 1; d < TOTAL_DAYS; d++) {
    const f = forecastLookup(d)
    if (f && (f.kind === 'lightRain' || f.kind === 'heavyRain' || f.kind === 'thunder')) {
      jumpToGameDay(d)
      return true
    }
  }
  return false
}

/** demo/test 钩子：与现有 __farmEvent 调试钩子风格一致 */
declare global {
  interface Window {
    __farmTime?: {
      getNow: () => number
      getGameDay: () => number
      getGameDate: () => GameDate
      fastForward: (days: number) => void
      jumpToGameDay: (day: number) => void
      jumpToNextRain: () => boolean
    }
  }
}
if (typeof window !== 'undefined') {
  window.__farmTime = {
    getNow,
    getGameDay,
    getGameDate,
    fastForward,
    jumpToGameDay,
    jumpToNextRain,
  }
}