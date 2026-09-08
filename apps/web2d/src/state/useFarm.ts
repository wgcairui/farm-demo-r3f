// 2D 版 useFarm：逻辑与 apps/web/src/farm3d/useFarm.ts 一致，只把渲染层 import 指向本地 Canvas 版本。
// 事件/浮字/相机触发与 web 版同步：播种 → playPlant+queueFloater+resetCombo，
// 收获 → shockwave/leaf/coin 粒子 + triggerShake + 相机推近 + combo。
// 2D 版粒子与相机推近在 render/particles.ts 与 state/cameraMotion.ts。
import { useCallback, useEffect, useRef, useState } from 'react'
import { CROPS, load, save, type CropId, type PlotState, type SaveData } from '@farm/game'
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
import {
  spawnCoinBurst,
  spawnLeafBurst,
  spawnShockwave,
  triggerShake,
} from '../render/particles'
import { clearFloaters, queueFloater } from '../render/floaters'
import { plotPosition } from './layout'
import { notifyHarvestCamera } from './cameraMotion'
import {
  playCoin,
  playFertilize,
  playHarvest,
  playPlant,
  playSplash,
  playSquash,
} from './sfx'
import { recordHarvest, resetCombo } from './combo'
import {
  finishTutorial,
  getTutorialState,
  nextStep,
  subscribeTutorial,
  type TutorialState,
} from './tutorial'

export function useFarm() {
  const [data, setData] = useState<SaveData>(() => load())
  const [tutorial, setTutorial] = useState<TutorialState>(() => getTutorialState())
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    const unsub = subscribeTutorial(setTutorial)
    return unsub
  }, [])

  useEffect(() => {
    save(data)
  }, [data])

  const handlePlot = useCallback((i: number) => {
    const at = Date.now()
    const snap = dataRef.current
    const p = snap.plots[i]
    const [px, pz] = plotPosition(i)

    switch (p.state as PlotState) {
      case 'empty': {
        if (getTool() === 'fert') {
          queueFloater(px, 0.45, pz, '🧪 施肥要点到作物上')
          return
        }
        const def = CROPS[snap.selected]
        if (snap.coins < def.seedPrice) return

        const tut = getTutorialState()
        if (tut.step === 2 && i === tut.targetPlot) {
          nextStep(i)
        }

        setData((d) => {
          if (d.plots[i].crop !== null || d.coins < CROPS[d.selected].seedPrice) return d
          const plots = d.plots.slice()
          plots[i] = { crop: d.selected, plantedAt: at, state: 'sown', witheredAt: null }
          return { ...d, plots, coins: d.coins - CROPS[d.selected].seedPrice }
        })
        playPlant()
        onPlant(i)
        queueFloater(px, 0.55, pz, `-${def.seedPrice}`)
        resetCombo()
        return
      }

      case 'sown':
      case 'sprout':
      case 'growing': {
        if (tryWater(i, p.crop!)) {
          playSplash()
          queueFloater(px, 0.5, pz, '💧')
          resetCombo()
          return
        }
        const fert = tryFertilize(i, snap.coins)
        if (fert === 'ok') {
          setData((d) => (d.coins < FERT_COST ? d : { ...d, coins: d.coins - FERT_COST }))
          playFertilize()
          queueFloater(px, 0.5, pz, '🌱 +50%')
          resetCombo()
          return
        }
        if (fert === 'poor') {
          queueFloater(px, 0.5, pz, '🪙 不够')
          resetCombo()
          return
        }
        return
      }

      case 'mature': {
        const tut = getTutorialState()
        if (tut.step === 3 && i === tut.targetPlot) {
          finishTutorial()
        }

        const def = CROPS[p.crop!]
        const gain = isDamaged(i) ? Math.floor(def.sellPrice / 2) : def.sellPrice
        setData((d) => {
          if (d.plots[i].crop !== p.crop) return d
          const plots = d.plots.slice()
          plots[i] = { crop: null, plantedAt: null, state: 'withered', witheredAt: at }
          return { ...d, plots, coins: d.coins + gain }
        })
        const { count: comboCount } = recordHarvest(at)
        clearFloaters()
        triggerShake(isDamaged(i) ? 'soft' : 'normal')
        spawnShockwave(px, pz)
        spawnLeafBurst(px, 0.5, pz, 8)
        playHarvest()
        window.setTimeout(playCoin, 90)
        spawnCoinBurst(px, 0.3, pz)
        queueFloater(
          px,
          0.85,
          pz,
          `+${gain}${isDamaged(i) ? ' 🐛' : ''}`,
          { hero: true, combo: comboCount >= 2 ? comboCount : undefined },
        )
        notifyHarvestCamera(px, pz)
        onHarvest(i)
        return
      }

      case 'withered': {
        setData((d) => {
          if (d.plots[i].state !== 'withered') return d
          const plots = d.plots.slice()
          plots[i] = { crop: null, plantedAt: null, state: 'empty', witheredAt: null }
          return { ...d, plots }
        })
        queueFloater(px, 0.45, pz, '🍂 已清理')
        resetCombo()
        return
      }
    }
  }, [])

  const handlePest = useCallback(() => {
    const plot = consumePest()
    if (plot < 0) return
    const [px, pz] = plotPosition(plot)
    setData((d) => ({ ...d, coins: d.coins + 2 }))
    playSquash()
    window.setTimeout(playCoin, 80)
    queueFloater(px, 0.55, pz, '✓ +2')
    resetCombo()
  }, [])

  const select = useCallback((id: CropId) => {
    const tut = getTutorialState()
    if (tut.step === 1) nextStep()
    setData((d) => ({ ...d, selected: id }))
  }, [])

  const tickPlots = useCallback((plots: SaveData['plots']) => {
    setData((d) => ({ ...d, plots }))
  }, [])

  const reset = useCallback(() => {
    localStorage.clear()
    location.reload()
  }, [])

  return { data, tutorial, handlePlot, handlePest, select, reset, tickPlots }
}
