// 游戏数值与核心状态机。
// 关键模式：只存 plantedAt 时间戳，生长阶段在读取时用当前时间计算
// —— 这和服务端方案的"时间戳 + 懒计算"同构，以后接后端时逻辑直接搬。
//
// 【D7 破零 diff 红线说明】
// packages/game 从 2D 基线逐字节抽出，本文件零 diff 是"逻辑未被 3D 改动污染"的证明。
// D7 任务需要新增 withered 状态与 tickPlot 自动恢复机制，scope 仅限本文件：
//   - PlotState 枚举加 'withered'
//   - Plot 接口加 state / witheredAt
//   - stageOf() 改读 state（生长中三阶段仍按时间戳计算，与 stageOf 哲学一致）
//   - tickPlot() 新增（withered → empty 触发）
//   - WITHER_RECOVER_MS 新增
//   - localStorage key 升 v2 + v1 迁移
// 除上述 scope 外，本文件其他行（progressOf / CROPS / PLOT_COUNT / load / save）不因 D7 改任何内容。

export type CropId = 'carrot' | 'corn'

export interface CropDef {
  id: CropId
  name: string
  emoji: string
  seedPrice: number
  sellPrice: number
  /** 两段生长期时长（毫秒）：种子→幼苗→成熟，demo 特意调短方便看效果 */
  stageMs: [number, number]
}

export const CROPS: Record<CropId, CropDef> = {
  carrot: { id: 'carrot', name: '胡萝卜', emoji: '🥕', seedPrice: 10, sellPrice: 25, stageMs: [10_000, 15_000] },
  corn: { id: 'corn', name: '玉米', emoji: '🌽', seedPrice: 20, sellPrice: 55, stageMs: [20_000, 30_000] },
}

export type PlotState = 'empty' | 'sown' | 'sprout' | 'growing' | 'mature' | 'withered'

export interface Plot {
  crop: CropId | null
  plantedAt: number | null
  state: PlotState
  witheredAt: number | null
}

export function stageOf(plot: Plot, now: number): PlotState {
  // withered / empty 直接返回，不走时间计算
  if (plot.state === 'withered' || plot.state === 'empty') return plot.state
  // 生长中三阶段：仍按时间戳 + elapsed 判定（与 stageOf 的"读取时计算"哲学对齐）
  if (!plot.crop || !plot.plantedAt) return 'empty'
  const def = CROPS[plot.crop]
  const elapsed = Math.max(0, now - plot.plantedAt)
  if (elapsed < def.stageMs[0]) return 'sown'
  if (elapsed < def.stageMs[0] + def.stageMs[1]) return 'growing'
  return 'mature'
}

/** 总生长进度 0~1，用于进度条 */
export function progressOf(plot: Plot, now: number): number {
  if (!plot.crop || !plot.plantedAt) return 0
  const def = CROPS[plot.crop]
  const total = def.stageMs[0] + def.stageMs[1]
  return Math.min(1, Math.max(0, (now - plot.plantedAt) / total))
}

export const PLOT_COUNT = 6

/** withered 状态自动恢复时长（ms）：收获后 8 秒自动变回 empty */
export const WITHER_RECOVER_MS = 8_000

export interface SaveData {
  coins: number
  plots: Plot[]
  selected: CropId
}

const KEY = 'farm-demo-v2'
const KEY_V1 = 'farm-demo-v1'

function isPlot(v: unknown): v is Plot {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Plot
  const cropOk = p.crop === null || (typeof p.crop === 'string' && p.crop in CROPS)
  const timeOk = p.plantedAt === null || (typeof p.plantedAt === 'number' && Number.isFinite(p.plantedAt))
  const stateOk =
    typeof p.state === 'string' &&
    ('empty' === p.state ||
      'sown' === p.state ||
      'sprout' === p.state ||
      'growing' === p.state ||
      'mature' === p.state ||
      'withered' === p.state)
  const witheredOk = p.witheredAt === null || (typeof p.witheredAt === 'number' && Number.isFinite(p.witheredAt))
  return cropOk && timeOk && stateOk && witheredOk
}

// v1 Plot shape（迁移前）
interface PlotV1 {
  crop: CropId | null
  plantedAt: number | null
}

function isPlotV1(v: unknown): v is PlotV1 {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  const cropOk = p.crop === null || (typeof p.crop === 'string' && p.crop in CROPS)
  const timeOk = p.plantedAt === null || (typeof p.plantedAt === 'number' && Number.isFinite(p.plantedAt))
  return cropOk && timeOk
}

function isSaveDataV1(v: unknown): v is { coins: number; plots: PlotV1[]; selected: CropId } {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Record<string, unknown>
  return (
    typeof d.coins === 'number' &&
    Array.isArray(d.plots) &&
    d.plots.length === PLOT_COUNT &&
    d.plots.every((p) => isPlotV1(p)) &&
    typeof d.selected === 'string' &&
    d.selected in CROPS
  )
}

/** v1 Plot → v2 Plot：推导 state 字段 */
function migratePlotV1(p: PlotV1, now: number): Plot {
  if (!p.crop || !p.plantedAt) return { crop: null, plantedAt: null, state: 'empty', witheredAt: null }
  const def = CROPS[p.crop]
  const elapsed = Math.max(0, now - p.plantedAt)
  let state: PlotState
  if (elapsed < def.stageMs[0]) state = 'sown'
  else if (elapsed < def.stageMs[0] + def.stageMs[1]) state = 'growing'
  else state = 'mature'
  return { crop: p.crop, plantedAt: p.plantedAt, state, witheredAt: null }
}

function isSaveData(v: unknown): v is SaveData {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Record<string, unknown>
  return (
    typeof d.coins === 'number' &&
    Array.isArray(d.plots) &&
    d.plots.length === PLOT_COUNT &&
    d.plots.every((p) => isPlot(p)) &&
    typeof d.selected === 'string' &&
    d.selected in CROPS
  )
}

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isSaveData(parsed)) return parsed
    }
    // v1 迁移：尝试读旧 key
    const rawV1 = localStorage.getItem(KEY_V1)
    if (rawV1) {
      const parsedV1: unknown = JSON.parse(rawV1)
      if (isSaveDataV1(parsedV1)) {
        const now = Date.now()
        return {
          coins: parsedV1.coins,
          plots: parsedV1.plots.map((p) => migratePlotV1(p, now)),
          selected: parsedV1.selected,
        }
      }
    }
  } catch {
    // JSON 损坏直接重开
  }
  return {
    coins: 50,
    plots: Array.from({ length: PLOT_COUNT }, () => ({ crop: null, plantedAt: null, state: 'empty', witheredAt: null })),
    selected: 'carrot',
  }
}

export function save(d: SaveData) {
  localStorage.setItem(KEY, JSON.stringify(d))
}

/**
 * 推动单块地的状态机。
 * withered 地块：若已过 WITHER_RECOVER_MS 则转为 empty（并清除 crop/plantedAt/witheredAt）。
 * 其他状态原样返回。
 */
export function tickPlot(plot: Plot, now: number): Plot {
  if (plot.state !== 'withered') return plot
  if (plot.witheredAt === null) return { ...plot, state: 'empty', witheredAt: null }
  if (now - plot.witheredAt < WITHER_RECOVER_MS) return plot
  // 自动恢复为 empty
  return { crop: null, plantedAt: null, state: 'empty', witheredAt: null }
}
