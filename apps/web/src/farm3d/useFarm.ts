// UI 状态壳：规则全部在 packages/game（阶段判定/进度/校验），这里只做状态容器与变更。
// 500ms 心跳驱动重渲染——数据本身只依赖 plantedAt 时间戳，与 2D 版、未来服务端版同构。
import { useCallback, useEffect, useState } from 'react'
import { CROPS, load, save, stageOf, type CropId, type SaveData } from '@farm/game'

export function useFarm() {
  const [data, setData] = useState<SaveData>(() => load())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    save(data)
  }, [data])

  const handlePlot = useCallback((i: number) => {
    const at = Date.now()
    setData((d) => {
      const p = d.plots[i]
      const st = stageOf(p, at)
      const plots = d.plots.slice()

      if (st === 'empty') {
        const def = CROPS[d.selected]
        if (d.coins < def.seedPrice) return d
        plots[i] = { crop: d.selected, plantedAt: at }
        return { ...d, plots, coins: d.coins - def.seedPrice }
      }
      if (st === 'mature' && p.crop) {
        plots[i] = { crop: null, plantedAt: null }
        return { ...d, plots, coins: d.coins + CROPS[p.crop].sellPrice }
      }
      return d
    })
  }, [])

  const select = useCallback((id: CropId) => setData((d) => ({ ...d, selected: id })), [])

  const reset = useCallback(() => {
    localStorage.clear()
    location.reload()
  }, [])

  return { data, now, handlePlot, select, reset }
}
