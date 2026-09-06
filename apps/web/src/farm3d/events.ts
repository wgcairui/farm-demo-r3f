// D6 试玩反馈落地：惊喜事件（下雨/干旱/害虫）+ 施肥工具 + 作物差异化。
// 设计原则：整个系统活在 React 之外（模块单例，同 effects.ts）——
// 生长偏移逐帧累加零重渲染，HUD 横幅/浮字走命令式 DOM。
// 时间模型仍是 packages/game 的 plantedAt 时间戳：事件不改游戏规则，
// 只改"有效生长进度"（bonusMs），stageOf/progressOf 拿到的依旧是一个纯时间戳，
// 与服务端方案的同构叙事不被破坏。
import { CROPS, PLOT_COUNT, tickPlot, type CropId, type Plot, type PlotState, WITHER_RECOVER_MS } from '@farm/game'
import { queueFloater } from './floaters'
import { plotPosition } from './layout'
import { playDamage, playDrought, playPest, playRain } from './sfx'

export type EventType = 'rain' | 'drought' | 'pest'

/** 施肥一次的价格（金币） */
export const FERT_COST = 5
/** 害虫出现到得逞的宽限时长 */
export const PEST_TTL_MS = 12_000

const RAIN_MS = 15_000
const DROUGHT_MS = 20_000
/** 调度器轮询间隔与概率：开局 20s 安静期让玩家学会基本操作 */
const ROLL_EVERY_MS = 5_000
const FIRST_EVENT_MS = 20_000
const ROLL_CHANCE = 0.45

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

const fx = new Map<number, PlotFx>()
let active: ActiveEvent | null = null
let nextRollAt = performance.now() + FIRST_EVENT_MS
/** 上一次 tick 的 performance.now：用于后台回来时按墙钟差补结算 */
let lastTickAt: number | null = null
let lastPlots: Plot[] = []
let bannerKey = ''
let tool: 'seed' | 'fert' = 'seed'

/** 附加层 bonusMs 的合法幅度上限（取最长作物全生长期的 2 倍），手工改档超界直接拒 */
const BONUS_LIMIT =
  Math.max(...Object.values(CROPS).map((c) => c.stageMs[0] + c.stageMs[1])) * 2

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

const BANNER_TEXT: Record<EventType, string> = {
  rain: '🌧️ 下雨了！全部作物生长 ×2',
  drought: '☀️ 干旱！🥕 耐旱 · 🌽 点击地块浇水',
  pest: '🐛 害虫出没！点击虫子驱赶',
}

function setBanner(ev: ActiveEvent | null, secsLeft = 0): void {
  const el = document.getElementById('event-banner')
  if (!el) return
  if (!ev) {
    if (bannerKey !== '') {
      bannerKey = ''
      el.className = ''
    }
    return
  }
  const secs = Math.max(0, Math.ceil(secsLeft / 1000))
  const key = `${ev.type}:${secs}`
  if (key === bannerKey) return
  bannerKey = key
  el.textContent = `${BANNER_TEXT[ev.type]} · ${secs}s`
  el.className = `show ${ev.type}`
}

// —— 调度与逐帧推进（EventsTicker 每帧调用）——

function startEvent(type: EventType, now: number): void {
  let plot = -1
  if (type === 'pest') {
    // 挑生长中的作物（空地/成熟不算）；玉米招虫（权重 ×3）
    const w: number[] = []
    lastPlots.forEach((p, i) => {
      if (p.crop && !isMature(p, i)) w.push(i, ...(p.crop === 'corn' ? [i, i] : []))
    })
    if (w.length === 0) return
    plot = w[Math.floor(Math.random() * w.length)]
  } else {
    // 干旱开始时浇过水的状态清零，每轮干旱都要重新照顾
    for (const f of fx.values()) f.watered = false
  }
  active = {
    type,
    plot,
    startAt: now,
    endAt: now + (type === 'rain' ? RAIN_MS : type === 'drought' ? DROUGHT_MS : PEST_TTL_MS),
    plantedAt: type === 'pest' ? (lastPlots[plot]?.plantedAt ?? null) : null,
  }
  if (type === 'rain') playRain()
  else if (type === 'drought') playDrought()
  else playPest()
  setBanner(active, active.endAt - now)
}

export function tickEvents(plots: Plot[]): void {
  const now = performance.now()
  const prevTick = lastTickAt
  lastTickAt = now
  // 墙钟差补结算：rAF 在后台标签页暂停，回来那一帧 gap 是真实间隔，一次性补齐——
  // 与生长的 Date.now() 墙钟哲学对齐，切后台不再"白嫖干旱"/白丢雨加成。
  // 事件效果只补到 endAt 为止（后台就该结束的部分不多算）。
  const gap = prevTick === null ? 0 : Math.max(0, now - prevTick)
  const evGap = active ? Math.max(0, Math.min(now, active.endAt) - (prevTick ?? now)) : 0
  lastPlots = plots

  // 偏移累加：只对生长中（未成熟）的地块生效；成熟后继续累计只会堆出无意义的大数
  for (let i = 0; i < plots.length; i++) {
    const p = plots[i]
    if (!p.crop || isMature(p, i)) continue
    const f = ensure(i)
    if (f.fert) f.bonusMs += gap * 0.5
    if (active?.type === 'rain') f.bonusMs += evGap
    else if (active?.type === 'drought') {
      if (p.crop === 'corn' && !f.watered) f.bonusMs -= evGap
      else if (p.crop === 'carrot') f.bonusMs += evGap * 0.5
    }
  }

  if (active) {
    if (now >= active.endAt) {
      // 超时减产校验 plantedAt：虫害期间目标被收获再补种，惩罚不能落到新茬头上
      const target = plots[active.plot]
      if (active.type === 'pest' && target?.crop && target.plantedAt === active.plantedAt) {
        ensure(active.plot).dmg = true
        const [x, z] = plotPosition(active.plot)
        queueFloater(x, 0.7, z, '🐛 叶子被啃 · 减产一半')
        playDamage()
      }
      active = null
      nextRollAt = now + ROLL_EVERY_MS
      setBanner(null)
      flush()
    } else {
      setBanner(active, active.endAt - now)
    }
  } else if (now >= nextRollAt) {
    if (Math.random() < ROLL_CHANCE) {
      const r = Math.random()
      startEvent(r < 0.4 ? 'rain' : r < 0.75 ? 'drought' : 'pest', now)
    }
    if (!active) nextRollAt = now + ROLL_EVERY_MS
  }
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
  nextRollAt = performance.now() + ROLL_EVERY_MS
  setBanner(null)
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
export const isRain = (): boolean => active?.type === 'rain'
export const isDrought = (): boolean => active?.type === 'drought'
export function getBonus(i: number): number {
  return fx.get(i)?.bonusMs ?? 0
}
export function getFx(i: number): Readonly<PlotFx> | undefined {
  return fx.get(i)
}

// —— 演示/测试钩子：强制触发事件（面试现场演示、playwright 验证都用它）——

declare global {
  interface Window {
    __farmEvent?: (type: EventType) => void
    /** 调试：读内部状态（active.plot / fx 表） */
    __farmDebug?: () => unknown
  }
}
if (typeof window !== 'undefined') {
  window.__farmEvent = (type) => {
    // 已有事件先无伤结束，保证演示确定性
    if (active) {
      active = null
      setBanner(null)
    }
    startEvent(type, performance.now())
  }
  window.__farmDebug = () => ({ active, fx: [...fx.entries()] })
}
