// UI 状态壳：规则全部在 packages/game（阶段判定/进度/校验），这里只做状态容器与变更。
// 无心跳：生长呈现由 FarmScene 的 useFrame 逐帧计算，点击时直接取 Date.now()——
// 交互之间零重渲染。与 2D 版、未来服务端版同构（plantedAt 时间戳是唯一事实源）。
import { useCallback, useEffect, useRef, useState } from 'react'
import { CROPS, load, save, stageOf, type CropId, type SaveData } from '@farm/game'
import { spawnCoinBurst } from './effects'
import { queueFloater } from './floaters'
import { plotPosition } from './layout'
import { playCoin, playHarvest, playPlant } from './sfx'

export function useFarm() {
  const [data, setData] = useState<SaveData>(() => load())
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    save(data)
  }, [data])

  const handlePlot = useCallback((i: number) => {
    const at = Date.now()
    const snap = dataRef.current
    const p = snap.plots[i]
    const st = stageOf(p, at)

    if (st === 'empty') {
      const def = CROPS[snap.selected]
      if (snap.coins < def.seedPrice) return
      setData((d) => {
        // updater 内重新校验（纯函数，StrictMode 会双调用；音效/特效在 updater 外只发一次）
        if (d.plots[i].crop !== null || d.coins < CROPS[d.selected].seedPrice) return d
        const plots = d.plots.slice()
        plots[i] = { crop: d.selected, plantedAt: at }
        return { ...d, plots, coins: d.coins - CROPS[d.selected].seedPrice }
      })
      const [px, pz] = plotPosition(i)
      playPlant()
      queueFloater(px, 0.55, pz, `-${def.seedPrice}`)
      return
    }

    if (st === 'mature' && p.crop) {
      const def = CROPS[p.crop]
      setData((d) => {
        if (d.plots[i].crop !== p.crop) return d
        const plots = d.plots.slice()
        plots[i] = { crop: null, plantedAt: null }
        return { ...d, plots, coins: d.coins + def.sellPrice }
      })
      const [px, pz] = plotPosition(i)
      playHarvest()
      window.setTimeout(playCoin, 90)
      spawnCoinBurst(px, 0.3, pz)
      queueFloater(px, 0.75, pz, `+${def.sellPrice}`)
    }
  }, [])

  const select = useCallback((id: CropId) => setData((d) => ({ ...d, selected: id })), [])

  const reset = useCallback(() => {
    localStorage.clear()
    location.reload()
  }, [])

  return { data, handlePlot, select, reset }
}
