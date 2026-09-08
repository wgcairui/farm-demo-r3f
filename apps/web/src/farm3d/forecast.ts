// P2-6 春季天气表（180 天）：6 种天气按月份动态概率生成，
// 持久化以保证「重载页面后天数一致」——用确定性 RNG（mulberry32）。
//
// 设计要点：
// - 月份概率表：3 月冷（雨/雪少）、4 月回暖、5 月雷阵雨多、6-9 月夏天更晴
// - 连雨约束：连续 ≥3 天雨天概率 ~10%（梅雨前兆）
// - 干旱涌现：当连续 ≥4 天无雨时，第 5 天起算 drought，直到下一场雨
// - 温度：按月份线性插值

import { registerForecastLookup, TOTAL_DAYS, getGameDay } from './time'

export type WeatherKind = 'sunny' | 'cloudy' | 'overcast' | 'lightRain' | 'heavyRain' | 'thunder'

export interface DailyForecast {
  kind: WeatherKind
  /** 最高气温 ℃ */
  tempHigh: number
  /** 最低气温 ℃ */
  tempLow: number
}

interface ForecastPersisted {
  seed: number
  days: DailyForecast[]
}

const FKEY = 'farm-forecast-v1'
const DEFAULT_SEED = 42

let days: DailyForecast[] = []

// —— 确定性 RNG：mulberry32 ——
function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// —— 按月份概率表（晴 / 多云 / 阴 / 小雨 / 大雨 / 雷）——
const WEATHER_TABLE: ReadonlyArray<ReadonlyArray<WeatherKind>> = [
  // 3 月：sunny 40% / cloudy 30% / overcast 12% / lightRain 12% / heavyRain 4% / thunder 2%
  ['sunny', 'sunny', 'sunny', 'sunny', 'cloudy', 'cloudy', 'cloudy', 'overcast', 'overcast', 'lightRain', 'lightRain', 'heavyRain', 'thunder'],
  // 4 月：sunny 45% / cloudy 28% / overcast 12% / lightRain 10% / heavyRain 3% / thunder 2%
  ['sunny', 'sunny', 'sunny', 'sunny', 'sunny', 'cloudy', 'cloudy', 'cloudy', 'overcast', 'lightRain', 'lightRain', 'heavyRain', 'thunder'],
  // 5 月：sunny 42% / cloudy 25% / overcast 13% / lightRain 11% / heavyRain 5% / thunder 4%
  ['sunny', 'sunny', 'sunny', 'sunny', 'cloudy', 'cloudy', 'cloudy', 'overcast', 'overcast', 'lightRain', 'lightRain', 'heavyRain', 'thunder', 'thunder'],
  // 6 月：夏天更晴
  ['sunny', 'sunny', 'sunny', 'sunny', 'sunny', 'cloudy', 'cloudy', 'overcast', 'lightRain', 'lightRain', 'heavyRain', 'thunder', 'thunder'],
  // 7 月
  ['sunny', 'sunny', 'sunny', 'sunny', 'sunny', 'sunny', 'cloudy', 'overcast', 'lightRain', 'lightRain', 'heavyRain', 'thunder', 'thunder'],
  // 8 月
  ['sunny', 'sunny', 'sunny', 'sunny', 'sunny', 'sunny', 'cloudy', 'overcast', 'lightRain', 'lightRain', 'heavyRain', 'thunder', 'thunder'],
  // 9 月：转凉，雷雨减少
  ['sunny', 'sunny', 'sunny', 'sunny', 'sunny', 'cloudy', 'cloudy', 'cloudy', 'overcast', 'lightRain', 'lightRain', 'heavyRain', 'thunder'],
]

/** 按月份气温（℃）：base = 月最低 / high = 月最高，线性插值 */
function tempRange(month: number): { low: number; high: number } {
  // 3 月 -2~12, 4 月 5~18, 5 月 12~24, 6 月 18~30, 7-8 月 22~34, 9 月 15~26
  const table: Record<number, [number, number]> = {
    3: [-2, 12],
    4: [5, 18],
    5: [12, 24],
    6: [18, 30],
    7: [22, 34],
    8: [22, 34],
    9: [15, 26],
  }
  const r = table[month] ?? [10, 20]
  return { low: r[0], high: r[1] }
}

function pickWeather(rng: () => number, monthIdx: number): WeatherKind {
  const t = WEATHER_TABLE[Math.min(monthIdx, WEATHER_TABLE.length - 1)]
  return t[Math.floor(rng() * t.length)]
}

function isRainKind(k: WeatherKind): boolean {
  return k === 'lightRain' || k === 'heavyRain' || k === 'thunder'
}

function generateForecasts(seed: number): DailyForecast[] {
  const rng = mulberry32(seed)
  const out: DailyForecast[] = []
  let consecutiveRain = 0
  let consecutiveDry = 0

  for (let d = 0; d < TOTAL_DAYS; d++) {
    const monthIdx = Math.floor(d / 30) // 0=3 月, ..., 6=9 月
    const month = 3 + monthIdx
    let kind = pickWeather(rng, monthIdx)

    // 连雨约束：连续 ≥3 天雨天后强制转晴（避免梅雨无止境）
    if (isRainKind(kind)) {
      consecutiveRain++
      consecutiveDry = 0
      if (consecutiveRain >= 3 && rng() < 0.55) {
        kind = rng() < 0.6 ? 'cloudy' : 'sunny'
        consecutiveRain = 0
      }
    } else {
      consecutiveDry++
      consecutiveRain = 0
    }

    const { low, high } = tempRange(month)
    // 日内浮动 ±4℃
    const dayJitter = (rng() - 0.5) * 4
    const tempHigh = Math.round(high + dayJitter)
    const tempLow = Math.round(low + dayJitter * 0.5)
    out.push({ kind, tempHigh, tempLow })
  }
  return out
}

// —— 查询接口 ——

/** 今天的 forecast */
export function getTodayForecast(): DailyForecast {
  return days[Math.min(getGameDay(), TOTAL_DAYS - 1)]
}

/** 指定游戏日的 forecast（dayOffset=0 今天，1 明天，-1 昨天） */
export function getForecast(day: number): DailyForecast {
  const d = Math.max(0, Math.min(TOTAL_DAYS - 1, day))
  return days[d]
}

/** 指定游戏日是否处于干旱（连续 ≥4 天无雨，自动涌现） */
export function isDroughtDay(day: number): boolean {
  if (day <= 0) return false
  // 看从 day-4 到 day-1 的连续非雨日数
  let consecutiveDry = 0
  for (let i = day - 1; i >= day - 5 && i >= 0; i--) {
    if (!isRainKind(days[i].kind)) consecutiveDry++
    else break
  }
  // 连续 ≥4 天无雨 → 当天干旱
  return consecutiveDry >= 4
}

/** 当前游戏日是否干旱 */
export function getIsDrought(): boolean {
  return isDroughtDay(getGameDay())
}

// —— 注册查表函数到 time.ts ——
registerForecastLookup((d) => {
  if (d < 0 || d >= TOTAL_DAYS) return null
  return days[d]
})

/** demo/test 钩子 */
declare global {
  interface Window {
    __farmForecast?: () => { dayCount: number; today: DailyForecast; isDrought: boolean }
  }
}
if (typeof window !== 'undefined') {
  window.__farmForecast = () => ({
    dayCount: days.length,
    today: getTodayForecast(),
    isDrought: getIsDrought(),
  })
}

// —— 持久化恢复（必须放在所有 const / function 定义之后，避免 TDZ）——
try {
  const raw = localStorage.getItem(FKEY)
  if (raw) {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) {
      const p = parsed as Record<string, unknown>
      if (Array.isArray(p.days) && p.days.length === TOTAL_DAYS) {
        days = p.days as DailyForecast[]
      }
    }
  }
} catch {
  /* 损坏即重新生成 */
}

if (days.length !== TOTAL_DAYS) {
  days = generateForecasts(DEFAULT_SEED)
  try {
    localStorage.setItem(FKEY, JSON.stringify({ seed: DEFAULT_SEED, days } satisfies ForecastPersisted))
  } catch {
    /* 静默 */
  }
}