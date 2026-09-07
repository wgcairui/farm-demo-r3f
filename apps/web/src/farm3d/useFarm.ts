// UI 状态壳：规则全部在 packages/game（阶段判定/进度/校验），这里只做状态容器与变更。
// 无心跳：生长呈现由 FarmScene 的 useFrame 逐帧计算，点击时直接取 Date.now()——
// 交互之间零重渲染。与 2D 版、未来服务端版同构（plantedAt 时间戳是唯一事实源）。
// D6 事件层（events.ts）同样只通过"有效时间戳"介入：effPlot 偏移后喂给 stageOf。
//
// D7 状态分支说明：handlePlot 的主事实源是 plot.state，不再依赖 stageOf。
// events.ts 的 withered 自动恢复由 PlotStateTicker 驱动（tickPlotStates）。
import { useCallback, useEffect, useRef, useState } from 'react'
import { CROPS, load, save, tickPlot, type CropId, type PlotState, type SaveData } from '@farm/game'
import {
  consumePest,
  effPlot,
  FERT_COST,
  getTool,
  isDamaged,
  onHarvest,
  onPlant,
  tryFertilize,
  tryWater,
} from './events'
import { spawnCoinBurst, spawnLeafBurst, spawnShockwave, triggerShake } from './effects'
import { clearFloaters, queueFloater } from './floaters'
import { plotPosition } from './layout'
import { notifyHarvestCamera } from './cameraMotion'
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
    const [px, pz] = plotPosition(i)

    // handlePlot 状态分支主事实源是 plot.state，不再依赖 stageOf
    switch (p.state as PlotState) {
      case 'empty': {
        if (getTool() === 'fert') {
          queueFloater(px, 0.45, pz, '🧪 施肥要点到作物上')
          return
        }
        const def = CROPS[snap.selected]
        if (snap.coins < def.seedPrice) return
        setData((d) => {
          if (d.plots[i].crop !== null || d.coins < CROPS[d.selected].seedPrice) return d
          const plots = d.plots.slice()
          // 播种后立即进入 sown 状态（待 tickPlotStates 推进）
          plots[i] = { crop: d.selected, plantedAt: at, state: 'sown', witheredAt: null }
          return { ...d, plots, coins: d.coins - CROPS[d.selected].seedPrice }
        })
        playPlant()
        onPlant(i)
        queueFloater(px, 0.55, pz, `-${def.seedPrice}`)
        return
      }

      case 'sown':
      case 'sprout':
      case 'growing': {
        // 干旱浇水/施肥不能等 10 秒幼苗期过了才生效
        if (tryWater(i, p.crop!)) {
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

      case 'mature': {
        const def = CROPS[p.crop!]
        const gain = isDamaged(i) ? Math.floor(def.sellPrice / 2) : def.sellPrice
        setData((d) => {
          if (d.plots[i].crop !== p.crop) return d
          const plots = d.plots.slice()
          // 收获后进入 withered 状态，8s 后由 tickPlotStates 自动清空
          plots[i] = { crop: null, plantedAt: null, state: 'withered', witheredAt: at }
          return { ...d, plots, coins: d.coins + gain }
        })
        clearFloaters()
        triggerShake(isDamaged(i) ? 'soft' : 'normal')
        spawnShockwave(px, pz)
        spawnLeafBurst(px, 0.5, pz, 8)
        playHarvest()
        window.setTimeout(playCoin, 90)
        spawnCoinBurst(px, 0.3, pz)
        queueFloater(px, 0.85, pz, `+${gain}${isDamaged(i) ? ' 🐛' : ''}`, { hero: true })
        notifyHarvestCamera(px, pz)
        onHarvest(i)
        return
      }

      case 'withered': {
        // withered 状态点击立即清理，无需音效/特效
        setData((d) => {
          if (d.plots[i].state !== 'withered') return d
          const plots = d.plots.slice()
          plots[i] = { crop: null, plantedAt: null, state: 'empty', witheredAt: null }
          return { ...d, plots }
        })
        queueFloater(px, 0.45, pz, '🍂 已清理')
        return
      }
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

  /** D7：PlotStateTicker 回调，用 withered 自动恢复后的新 plots 数组替换 */
  const tickPlots = useCallback((plots: SaveData['plots']) => {
    setData((d) => ({ ...d, plots }))
  }, [])

  const reset = useCallback(() => {
    localStorage.clear()
    location.reload()
  }, [])

  return { data, handlePlot, handlePest, select, reset, tickPlots }
}
