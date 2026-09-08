// P2-3 装饰摆件命令式单例。
// 数据存 localStorage，模块顶层自动加载，变更时自动持久化。
// 不引入新依赖，不触碰 packages/game。

export type DecorationKind = 'windmill' | 'scarecrow' | 'barrel' | 'fence'

export interface Decoration {
  id: string
  kind: DecorationKind
  x: number
  z: number
  rotY: number
}

const STORAGE_KEY = 'farm-demo-decorations-v1'

/** 8×6 网格世界坐标映射：8 列 x(-5..5)，6 行 z(-4..4) */
export const GRID_COLS = 8
export const GRID_ROWS = 6
export const GRID_X_MIN = -5
export const GRID_X_MAX = 5
export const GRID_Z_MIN = -4
export const GRID_Z_MAX = 4

/** 将网格 cell 索引映射到世界坐标 [x, z]（摆件放置在 y=0.02） */
export function gridCellToWorld(col: number, row: number): [number, number] {
  const x = GRID_X_MIN + (col / (GRID_COLS - 1)) * (GRID_X_MAX - GRID_X_MIN)
  const z = GRID_Z_MIN + (row / (GRID_ROWS - 1)) * (GRID_Z_MAX - GRID_Z_MIN)
  return [x, z]
}

// —— 命令式单例 ——

let _list: Decoration[] = []
const _subscribers = new Set<(list: Decoration[]) => void>()

function _notify() {
  for (const fn of _subscribers) fn(_list)
}

function _persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_list))
  } catch {
    // 隐私模式写失败：静默降级
  }
}

function _load(): Decoration[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // 过滤无效记录
    return parsed.filter(
      (r): r is Decoration =>
        typeof r === 'object' &&
        typeof r.id === 'string' &&
        typeof r.kind === 'string' &&
        typeof r.x === 'number' &&
        typeof r.z === 'number' &&
        typeof r.rotY === 'number',
    )
  } catch {
    return []
  }
}

/** 模块初始化时自动加载 */
_list = _load()

export function addDecoration(kind: DecorationKind, x: number, z: number, rotY = 0): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  _list = [..._list, { id, kind, x, z, rotY }]
  _persist()
  _notify()
  return id
}

export function removeDecoration(id: string): void {
  const before = _list.length
  _list = _list.filter((d) => d.id !== id)
  if (_list.length !== before) {
    _persist()
    _notify()
  }
}

export function clearDecorations(): void {
  if (_list.length === 0) return
  _list = []
  _persist()
  _notify()
}

export function getDecorations(): Decoration[] {
  return _list
}

export function subscribeDecorations(fn: (list: Decoration[]) => void): () => void {
  _subscribers.add(fn)
  return () => _subscribers.delete(fn)
}
