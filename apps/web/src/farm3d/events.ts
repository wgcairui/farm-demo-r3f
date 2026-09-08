// D6 试玩反馈落地 + P2-6 春季日历接入：
// 旧版"惊喜事件（下雨/干旱/害虫）+ 施肥工具 + 作物差异化"系统活在 React 之外（模块单例）。
// 生长偏移逐帧累加零重渲染，HUD 横幅/浮字走命令式 DOM。
// 时间模型仍是 packages/game 的 plantedAt 时间戳：事件不改游戏规则，
// 只改"有效生长进度"（bonusMs），stageOf/progressOf 拿到的依旧是一个纯时间戳，
// 与服务端方案的同构叙事不被破坏。
//
// P2-6 改造要点：
//   - 移除瞬时随机（RAIN_MS / ROLL_EVERY_MS / FIRST_EVENT_MS / ROLL_CHANCE 等）
//   - isRain / isDrought 改为派生：读 forecast 表 + 干旱涌现判定
//   - tickEvents 只负责 bonusMs 累加，不再调度事件
//   - banner 文案按 forecast.kind 区分（晴/多云/阴/小雨/大雨/雷/干旱/害虫）
//   - pest 保留原随机触发，但虫害地块权重叠加 pestCalendar.getMonthPestWeight()
import { CROPS, PLOT_COUNT, tickPlot, type CropId, type Plot, type PlotState, WITHER_RECOVER_MS } from '@farm/game'
import { getTodayForecast, getIsDrought, getForecast, type WeatherKind } from './forecast'
import { getMonthPestWeight } from './pestCalendar'
import { queueFloater } from './floaters'
import { plotPosition } from './layout'
import { playDamage, playDrought, playPest, playRain } from './sfx'
import { getGameDay } from './time'

export type EventType = 'rain' | 'drought' | 'pest'

/** 施肥一次的价格（金币） */
export const FERT_COST = 5
/** 害虫出现到得逞的宽限时长 */
export const PEST_TTL_MS = 12_000

/** 每块地的附加状态。bonusMs>0=进度提前（雨/肥），<0=冻结累计（干旱） */
interface PlotFx {
  bonusMs: number
  fert: boolean
  dmg: boolean
  watered: boolean
}

export interface ActiveEvent {
  type: EventType
  /** 事件作用的地块下标；全场地面事件（雨/旱）为 -1 */
  plot: number
  startAt: number
  endAt: number
  /** pest 专用：锁定目标那一茬的 plantedAt，收获补种后超时不殃及新苗 */
  plantedAt: number | null
}

// 推进时钟统一用 Date.now()（墙钟）：与 packages/game 的 stageOf/progressOf/tickPlot 同源，
// 避免 performance.now() 帧时钟与持久化 Date.now() 时间戳混用导致侧栏/浮字/恢复计时偶尔差一拍。
const fx = new Map<number, PlotFx>()
let active: ActiveEvent | null = null
/** 上一次 tick 的 Date.now：用于后台回来时按墙钟差补结算 */
let lastTickAt: number | null = null
let lastPlots: Plot[] = []
/** 上次写入 DOM 的 banner signature，节流避免每帧操作 */
let lastBannerKind: string | null = null
/** 干旱首日标记：跨日时清零 watered */
let lastDroughtDay = -1
let tool: 'seed' | 'fert' = 'seed'

/** 附加层 bonusMs 的合法幅度上限（取最长作物全生长期的 2 倍），手工改档超界直接拒 */
const BONUS_LIMIT =
  Math.max(...Object.values(CROPS).map((c) => c.stageMs[0] + c.stageMs[1])) * 2

/** 运行中钳位：bonusMs 累加越界会让 effPlot 算出 plantedAt - bonus < 0（"1970 已成熟"假象） */
function clampBonus(v: number): number {
  if (v > BONUS_LIMIT) return BONUS_LIMIT
  if (v < -BONUS_LIMIT) return -BONUS_LIMIT
  return v
}

// —— 附加状态持久化：主存档（coins/plots）归 packages/game，这里只存事件附加层 ——
// 逐帧累加的 bonusMs 不落盘（崩溃丢几秒进度可接受），只在离散动作后整体冲刷。

const EKEY = 'farm-demo-extras-v1'

function flush(): void {
  try {
    localStorage.setItem(EKEY, JSON.stringify([...fx]))
  } catch {
    /* 隐私模式等写入失败静默忽略 */
  }
}

try {
  const raw = localStorage.getItem(EKEY)
  if (raw) {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      for (const [i, v] of parsed as [unknown, unknown][]) {
        if (typeof i !== 'number' || i < 0 || i >= PLOT_COUNT) continue
        if (typeof v !== 'object' || v === null) continue
        const e = v as Record<string, unknown>
        if (typeof e.bonusMs !== 'number' || !Number.isFinite(e.bonusMs)) continue
        fx.set(i, {
          bonusMs: Math.max(-BONUS_LIMIT, Math.min(BONUS_LIMIT, e.bonusMs)),
          fert: e.fert === true,
          dmg: e.dmg === true,
          watered: e.watered === true,
        })
      }
    }
  }
} catch {
  /* 损坏即全新附加层 */
}
if (typeof window !== 'undefined') window.addEventListener('pagehide', flush)

function ensure(i: number): PlotFx {
  let f = fx.get(i)
  if (!f) {
    f = { bonusMs: 0, fert: false, dmg: false, watered: false }
    fx.set(i, f)
  }
  return f
}

/** 事件偏移后的"有效播种种时间戳"——stageOf/progressOf 一律喂这个 */
export function effPlot(p: Plot, i: number): Plot {
  const bonus = fx.get(i)?.bonusMs ?? 0
  return p.plantedAt === null ? p : { crop: p.crop, plantedAt: p.plantedAt - bonus, state: p.state, witheredAt: p.witheredAt }
}

function isMature(p: Plot, i: number): boolean {
  if (!p.crop || p.plantedAt === null) return false
  const def = CROPS[p.crop]
  return Date.now() - (p.plantedAt - (fx.get(i)?.bonusMs ?? 0)) >= def.stageMs[0] + def.stageMs[1]
}

// —— 作物差异化：唯一的规则出处，UI 标签与事件逻辑都引用它 ——

/** 玉米怕旱：干旱中不浇水就冻结；胡萝卜耐旱：干旱中保持半速 */
export function isThirsty(crop: CropId): boolean {
  return crop === 'corn'
}

// —— 横幅：命令式 DOM，与 floaters 同风格 ——
// P2-6：banner 文案按 forecast.kind / 干旱天数 / pest 状态三类区分

const BANNER_WEATHER_TEXT: Record<WeatherKind, string> = {
  sunny: '☀️ 晴朗',
  cloudy: '🌤️ 多云',
  overcast: '☁️ 阴',
  lightRain: '🌧️ 小雨 · 作物生长 ×2',
  heavyRain: '⛈️ 大雨 · 作物生长 ×2',
  thunder: '⚡ 雷阵雨 · 作物生长 ×2',
}

/** 干旱持续天数（用于 banner 提示「第几天」） */
function droughtStreak(): number {
  const day = getGameDay()
  let n = 0
  for (let i = day - 1; i >= 0; i--) {
    const f = getForecast(i)
    if (f.kind === 'lightRain' || f.kind === 'heavyRain' || f.kind === 'thunder') break
    n++
    if (n >= 30) break // 上限 30 天
  }
  return n
}

/** 计算当前应显示的 banner signature（同一 signature 不写 DOM） */
function currentBannerSig(nowMs: number): string {
  if (active?.type === 'pest') {
    const secs = Math.max(0, Math.ceil((active.endAt - nowMs) / 1000))
    return `pest:${secs}`
  }
  if (getIsDrought()) {
    return `drought:${droughtStreak()}`
  }
  const today = getTodayForecast()
  if (today.kind === 'lightRain' || today.kind === 'heavyRain' || today.kind === 'thunder') {
    return `rain:${today.kind}:day=${getGameDay()}`
  }
  return 'none'
}

function renderBanner(sig: string, nowMs: number): void {
  if (sig === lastBannerKind) return
  const el = document.getElementById('event-banner')
  if (!el) return
  lastBannerKind = sig
  if (sig === 'none') {
    el.className = ''
    el.textContent = ''
    return
  }
  if (sig.startsWith('pest:')) {
    el.textContent = `🐛 害虫出没！点击虫子驱赶 · ${sig.slice(5)}s`
    el.className = 'show pest'
    return
  }
  if (sig.startsWith('drought:')) {
    const days = Number(sig.slice(8))
    el.textContent = `☀️ 干旱 · 第${days}天 · 🥕 耐旱 · 🌽 点击地块浇水`
    el.className = 'show drought'
    return
  }
  if (sig.startsWith('rain:')) {
    // sig = "rain:<kind>:day=<n>"
    const kind = sig.split(':')[1] as WeatherKind
    el.textContent = `${BANNER_WEATHER_TEXT[kind]} · 持续到明日`
    el.className = 'show rain'
    return
  }
}

// —— 调度与逐帧推进（EventsTicker 每帧调用）——
// P2-6：仅 pest 仍走瞬时事件；rain 由 forecast.kind 派生（isRain），drought 自动涌现（isDrought）。

// RNG 注入：仅用于 pest 选地块；可被 setRng 替换以便 server-side 重放。
let rng: () => number = Math.random
export function setRng(next: () => number): void {
  rng = next
}

// 害虫选地块：玉米招虫（权重 ×3）× 月份系数（pestCalendar）
function pickPestPlot(): number {
  const w: number[] = []
  const monthFactor = getMonthPestWeight()
  lastPlots.forEach((p, i) => {
    if (!p.crop || isMature(p, i)) return
    const cropFactor = p.crop === 'corn' ? 3 : 1
    const weight = Math.round(cropFactor * monthFactor)
    for (let k = 0; k < weight; k++) w.push(i)
  })
  if (w.length === 0) return -1
  return w[Math.floor(rng() * w.length)]
}

/** 启动一个 pest 事件 */
function startPestEvent(now: number): boolean {
  const plot = pickPestPlot()
  if (plot === -1) return false
  active = {
    type: 'pest',
    plot,
    startAt: now,
    endAt: now + PEST_TTL_MS,
    plantedAt: lastPlots[plot]?.plantedAt ?? null,
  }
  playPest()
  return true
}

/** 进入干旱时：清零所有 watered 状态（每轮干旱需重新照顾） */
function enterDrought(): void {
  for (const f of fx.values()) f.watered = false
}

export function tickEvents(plots: Plot[]): void {
  const now = Date.now()
  const prevTick = lastTickAt
  lastTickAt = now
  // 墙钟差补结算：rAF 在后台标签页暂停，回来那一帧 gap 是真实间隔，一次性补齐——
  // 与生长的 Date.now() 墙钟哲学对齐，切后台不再"白嫖干旱"/白丢雨加成。
  // P2-6：rain / drought 由 forecast 派生（不再走瞬时 active.endAt），
  // evGap 仅用于 pest 倒计时内的补结算。
  const gap = prevTick === null ? 0 : Math.max(0, now - prevTick)
  const evGap = active ? Math.max(0, Math.min(now, active.endAt) - (prevTick ?? now)) : 0
  lastPlots = plots

  const rain = isRain()
  const drought = isDrought()

  // 干旱边界：今日进入干旱时清零 watered
  if (drought && lastDroughtDay !== getGameDay()) {
    enterDrought()
    lastDroughtDay = getGameDay()
  }

  // 偏移累加：只对生长中（未成熟）的地块生效；成熟后继续累计只会堆出无意义的大数
  for (let i = 0; i < plots.length; i++) {
    const p = plots[i]
    if (!p.crop || isMature(p, i)) continue
    const f = ensure(i)
    if (f.fert) f.bonusMs = clampBonus(f.bonusMs + gap * 0.5)
    if (rain) f.bonusMs = clampBonus(f.bonusMs + gap)
    else if (drought) {
      if (p.crop === 'corn' && !f.watered) f.bonusMs = clampBonus(f.bonusMs - gap)
      else if (p.crop === 'carrot') f.bonusMs = clampBonus(f.bonusMs + gap * 0.5)
    }
  }

  // pest 倒计时收尾
  if (active?.type === 'pest') {
    if (now >= active.endAt) {
      const target = plots[active.plot]
      if (target?.crop && target.plantedAt === active.plantedAt) {
        ensure(active.plot).dmg = true
        const [x, z] = plotPosition(active.plot)
        queueFloater(x, 0.7, z, '🐛 叶子被啃 · 减产一半')
        playDamage()
      }
      active = null
      flush()
    }
  }

  // banner 渲染（按日 / pest 倒计时统一签名节流）
  const sig = currentBannerSig(now)
  renderBanner(sig, now)

  // 暴露 __farmEvent 也可继续触发 pest（演示现场）
  void evGap
}

// —— 玩家侧动作 ——

export type FertResult = 'no-tool' | 'poor' | 'already' | 'ok'

/** 选中施肥工具后点击生长中作物；返回具体结果让调用方出对应反馈 */
export function tryFertilize(i: number, coins: number): FertResult {
  if (tool !== 'fert') return 'no-tool'
  if (coins < FERT_COST) return 'poor'
  const f = ensure(i)
  if (f.fert) return 'already'
  f.fert = true
  flush()
  return 'ok'
}

/** 干旱中点击缺水的玉米浇水；胡萝卜不需要 */
export function tryWater(i: number, crop: CropId): boolean {
  if (active?.type !== 'drought' || !isThirsty(crop)) return false
  const f = ensure(i)
  if (f.watered) return false
  f.watered = true
  flush()
  return true
}

/** 拍死害虫：返回地块下标（无活跃虫害返回 -1） */
export function consumePest(): number {
  if (active?.type !== 'pest') return -1
  const plot = active.plot
  active = null
  return plot
}

/** 播种/收获时清附加层，防止上一茬的减产/加成串到下一茬 */
export function onPlant(i: number): void {
  fx.delete(i)
  flush()
}
export function onHarvest(i: number): void {
  fx.delete(i)
  flush()
}
export function isDamaged(i: number): boolean {
  return fx.get(i)?.dmg === true
}

// —— D7 withered 状态驱动 ——

/**
 * 推动所有 withered 地块的状态机。
 * 如果某地块从 withered 转为 empty，同步清除事件附加层（fx.delete）。
 * 返回新 plots 数组（仅当有 transition 时）；否则返回 null 让调用方跳过 setData。
 */
export function tickPlotStates(plots: Plot[], now: number): Plot[] | null {
  let changed = false
  const next = plots.map((p, i) => {
    if (p.state !== 'withered') return p
    const next = tickPlot(p, now)
    // withered → empty 转换：清除事件附加层，避免恢复后还带减产/加成
    if (next.state === 'empty') {
      fx.delete(i)
      flush()
      changed = true
    }
    return next
  })
  return changed ? next : null
}

/**
 * 返回 withered 地块距离自动恢复的剩余秒数（向上取整）。
 * 非 withered 地块或已无 witheredAt 时返回 0。
 */
export function getPlotStateRecoveryMs(i: number, now: number, plots?: Plot[]): number {
  const src = plots ?? lastPlots
  const p = src[i]
  if (!p || p.state !== 'withered' || p.witheredAt === null) return 0
  const remain = WITHER_RECOVER_MS - (now - p.witheredAt)
  return Math.max(0, Math.ceil(remain / 1000))
}

// —— 工具选择（施肥 vs 种子）与场景读取接口 ——

export const getTool = (): 'seed' | 'fert' => tool
export const setTool = (t: 'seed' | 'fert'): void => {
  tool = t
}
export const getActive = (): ActiveEvent | null => active
// P2-6：isRain / isDrought 由 forecast 派生（不再依赖 active）
export const isRain = (): boolean => {
  const k = getTodayForecast().kind
  return k === 'lightRain' || k === 'heavyRain' || k === 'thunder'
}
export const isDrought = (): boolean => getIsDrought()
export function getBonus(i: number): number {
  return fx.get(i)?.bonusMs ?? 0
}
export function getFx(i: number): Readonly<PlotFx> | undefined {
  return fx.get(i)
}

// —— 演示/测试钩子：强制触发事件（面试现场演示、playwright 验证都用它）——
// P2-6：rain/drought 由 forecast 派生，不再支持；仅保留 pest。

declare global {
  interface Window {
    __farmEvent?: (type: EventType) => void
    /** 调试：读内部状态（active.plot / fx 表） */
    __farmDebug?: () => unknown
  }
}
if (typeof window !== 'undefined') {
  window.__farmEvent = (type) => {
    // 已有 pest 先无伤结束，保证演示确定性
    if (active) {
      active = null
    }
    if (type === 'pest') {
      startPestEvent(Date.now())
    }
    // rain / drought 演示路径：提示调用方改用 __farmTime.fastForward() 或 console.log
    void type
  }
  window.__farmDebug = () => ({ active, fx: [...fx.entries()] })
}
