// UI 状态壳：规则全部在 packages/game（阶段判定/进度/校验），这里只做状态容器与变更。
// 无心跳：生长呈现由 FarmScene 的 useFrame 逐帧计算，点击时直接取 Date.now()——
// 交互之间零重渲染。与 2D 版、未来服务端版同构（plantedAt 时间戳是唯一事实源）。
// D6 事件层（events.ts）同样只通过"有效时间戳"介入：effPlot 偏移后喂给 stageOf。
import { useCallback, useEffect, useRef, useState } from 'react'
import { CROPS, load, save, stageOf, type CropId, type SaveData } from '@farm/game'
import {
  consumePest,
  effPlot,
  FERT_COST,
  isDamaged,
  onHarvest,
  onPlant,
  tryFertilize,
  tryWater,
} from './events'
import { spawnCoinBurst } from './effects'
import { queueFloater } from './floaters'
import { plotPosition } from './layout'
import { playCoin, playFertilize, playHarvest, playPlant, playSplash, playSquash } from './sfx'

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
    const st = stageOf(effPlot(p, i), at)
    const [px, pz] = plotPosition(i)

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
      playPlant()
      onPlant(i)
      queueFloater(px, 0.55, pz, `-${def.seedPrice}`)
      return
    }

    // sprout 和 growing 都算"生长中"：干旱浇水/施肥不能等 10 秒幼苗期过了才生效
    if ((st === 'sprout' || st === 'growing') && p.crop) {
      // 干旱优先级最高：不浇水玉米就停长，施肥先靠边
      if (tryWater(i, p.crop)) {
        playSplash()
        queueFloater(px, 0.5, pz, '💧')
        return
      }
      const fert = tryFertilize(i, snap.coins)
      if (fert === 'ok') {
        setData((d) => (d.coins < FERT_COST ? d : { ...d, coins: d.coins - FERT_COST }))
        playFertilize()
        queueFloater(px, 0.5, pz, '🌱 +50%')
        return
      }
      if (fert === 'poor') queueFloater(px, 0.5, pz, '🪙 不够')
      return
    }

    if (st === 'mature' && p.crop) {
      const def = CROPS[p.crop]
      // 虫害没处理过：减产一半（floater 显示实际到账，玩家自己学到教训）
      const gain = isDamaged(i) ? Math.floor(def.sellPrice / 2) : def.sellPrice
      setData((d) => {
        if (d.plots[i].crop !== p.crop) return d
        const plots = d.plots.slice()
        plots[i] = { crop: null, plantedAt: null }
        return { ...d, plots, coins: d.coins + gain }
      })
      playHarvest()
      window.setTimeout(playCoin, 90)
      spawnCoinBurst(px, 0.3, pz)
      queueFloater(px, 0.75, pz, `+${gain}${isDamaged(i) ? ' 🐛' : ''}`)
      onHarvest(i)
    }
  }, [])

  /** 拍死害虫（PestBug 的点击回调）：+2 金币奖励手快 */
  const handlePest = useCallback(() => {
    const plot = consumePest()
    if (plot < 0) return
    const [px, pz] = plotPosition(plot)
    setData((d) => ({ ...d, coins: d.coins + 2 }))
    playSquash()
    window.setTimeout(playCoin, 80)
    queueFloater(px, 0.55, pz, '✓ +2')
  }, [])

  const select = useCallback((id: CropId) => setData((d) => ({ ...d, selected: id })), [])

  const reset = useCallback(() => {
    localStorage.clear()
    location.reload()
  }, [])

  return { data, handlePlot, handlePest, select, reset }
}
