// 游戏数值与核心状态机。
// 关键模式：只存 plantedAt 时间戳，生长阶段在读取时用当前时间计算
// —— 这和服务端方案的"时间戳 + 懒计算"同构，以后接后端时逻辑直接搬。

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

export interface Plot {
  crop: CropId | null
  plantedAt: number | null
}

export type Stage = 'empty' | 'sprout' | 'growing' | 'mature'

export function stageOf(plot: Plot, now: number): Stage {
  if (!plot.crop || !plot.plantedAt) return 'empty'
  const def = CROPS[plot.crop]
  // clamp 防时钟回拨导致阶段倒退；搬进服务端后由 serverNow 供时，客户端不再自己相减
  const elapsed = Math.max(0, now - plot.plantedAt)
  if (elapsed < def.stageMs[0]) return 'sprout'
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

export interface SaveData {
  coins: number
  plots: Plot[]
  selected: CropId
}

const KEY = 'farm-demo-v1'

function isPlot(v: unknown): v is Plot {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Plot
  const cropOk = p.crop === null || (typeof p.crop === 'string' && p.crop in CROPS)
  const timeOk = p.plantedAt === null || (typeof p.plantedAt === 'number' && Number.isFinite(p.plantedAt))
  return cropOk && timeOk
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
      // 形状不对（"null"、缺字段、旧 schema）一律当损坏处理，走全新档，避免渲染期白屏
      const parsed: unknown = JSON.parse(raw)
      if (isSaveData(parsed)) return parsed
    }
  } catch {
    // JSON 语法损坏直接重开，demo 不做迁移
  }
  return {
    coins: 50,
    plots: Array.from({ length: PLOT_COUNT }, () => ({ crop: null, plantedAt: null })),
    selected: 'carrot',
  }
}

export function save(d: SaveData) {
  localStorage.setItem(KEY, JSON.stringify(d))
}
