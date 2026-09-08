// rAF 主循环：每帧推进游戏状态 + 渲染 canvas。
// 替换 FarmScene.tsx 的 useFrame（约 2200 行）。
//
// 时序（每帧）：
//   1. dt 计算（封顶 100ms 防后台切回跳变）
//   2. tickPlotStates（withered 自动恢复）
//   3. tickEvents（bonusMs 累加）
//   4. updateParticles + tickFloaters（粒子 + DOM 浮字）
//   5. setRainActive(isRain()) 切换雨滴池
//   6. ctx.translate(shake) → renderFrame
//   7. camera viewScale 应用：ctx.scale/translate 复原
//
// 注意：rAF 在后台 tab 节流到 1Hz，所以"8 秒 withered 恢复"在 tab 隐藏时仍能
// 触发（只要 now() 持续推进）；切回 tab 看到一帧跳变是预期的（web 版同模式）。

import type { SaveData } from '@farm/game'
import { getNow } from './time'
import { advanceEvents, advancePlots, renderFrame } from '../render/loop'
import { consumeShake, setRainActive, updateParticles } from '../render/particles'
import { tickFloaters } from '../render/floaters'
import { isRain } from './events'
import { getPendingFocus, clearPendingFocus } from './cameraMotion'
import { ease } from './motion'
import { CAMERA } from './motion'

export interface TickLoopPropsRef {
  onPlot: (i: number) => void
  onTickPlots: (plots: SaveData['plots']) => void
}

export function tickLoopStart(
  canvas: HTMLCanvasElement,
  getData: () => SaveData,
  propsRef: { current: TickLoopPropsRef },
): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  let rafId = 0
  let lastTs = performance.now()
  let pulse = 0
  let lastPlotsRef = getData().plots

  const frame = (ts: number) => {
    const dt = Math.min(100, ts - lastTs)
    lastTs = ts
    pulse = (pulse + dt / 1000) % (Math.PI * 2)

    const now = getNow()
    const data = getData()

    // 1) plot 状态机推进
    const advanced = advancePlots(data.plots, now)
    let currentData = data
    if (advanced && advanced !== data.plots) {
      currentData = { ...data, plots: advanced }
      if (advanced.length === lastPlotsRef.length) {
        let changed = false
        for (let i = 0; i < advanced.length; i++) {
          if (advanced[i] !== lastPlotsRef[i]) {
            changed = true
            break
          }
        }
        if (changed) {
          lastPlotsRef = advanced
          propsRef.current.onTickPlots(advanced)
        }
      }
    }

    // 2) 事件
    advanceEvents(currentData.plots)
    setRainActive(isRain())

    // 3) 粒子 + 浮字
    updateParticles(dt)
    tickFloaters()

    // 4) 相机 viewScale：收获推近 600ms outCubic，0→zoom→1
    const focus = getPendingFocus()
    let viewScale = 1
    if (focus) {
      const elapsed = performance.now() - focus.startMs
      const half = CAMERA.harvestMs / 2
      let t: number
      if (elapsed < half) {
        t = elapsed / half
        viewScale = 1 + (1 - focus.zoom) * ease.outCubic(t)
      } else if (elapsed < CAMERA.harvestMs) {
        t = (elapsed - half) / half
        viewScale = focus.zoom + (1 - focus.zoom) * ease.outCubic(t)
      } else {
        viewScale = 1
        clearPendingFocus()
      }
    }

    // 5) 渲染：先应用 shake + viewScale
    const rect = canvas.getBoundingClientRect()
    ctx.save()
    const shake = consumeShake()
    ctx.translate(shake.x, shake.y)
    ctx.translate(rect.width / 2, rect.height / 2)
    ctx.scale(viewScale, viewScale)
    ctx.translate(-rect.width / 2, -rect.height / 2)
    renderFrame({
      ctx,
      cssW: rect.width,
      cssH: rect.height,
      data: currentData,
      pulse: 0.5 + 0.5 * Math.sin(pulse),
    })
    ctx.restore()

    rafId = requestAnimationFrame(frame)
  }

  rafId = requestAnimationFrame(frame)

  return () => {
    cancelAnimationFrame(rafId)
  }
}
