// Scene2D：单 <canvas> + rAF 主循环 + 鼠标点击命中检测。
// 所有渲染逻辑在 render/loop.ts；这里只管 canvas 生命周期和点击。

import { useEffect, useRef } from 'react'
import { PLOT_COUNT, type SaveData } from '@farm/game'
import { plotPosition } from '../state/layout'
import { tickLoopStart } from '../state/tickLoop'
import { pointInTile, worldToScreen, defaultOrigin } from './iso'
import { setCanvasOrigin } from '../state/canvasRegistry'

export interface Scene2DProps {
  data: SaveData
  onPlot: (i: number) => void
  onTickPlots: (plots: SaveData['plots']) => void
}

export default function Scene2D({ data, onPlot, onTickPlots }: Scene2DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data

  const propsRef = useRef({ onPlot, onTickPlots })
  propsRef.current = { onPlot, onTickPlots }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      setCanvasOrigin(defaultOrigin(rect.width, rect.height))
    }
    resize()
    window.addEventListener('resize', resize)

    const stop = tickLoopStart(canvas, () => dataRef.current, propsRef)

    return () => {
      window.removeEventListener('resize', resize)
      stop()
    }
  }, [])

  const handleClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const sx = ev.clientX - rect.left
    const sy = ev.clientY - rect.top
    let bestI = -1
    let bestDist = Infinity
    for (let i = 0; i < PLOT_COUNT; i++) {
      const [px, pz] = plotPosition(i)
      if (pointInTile(sx, sy, px, pz)) {
        const c = worldToScreen(px, pz)
        const d = Math.hypot(sx - c.x, sy - c.y)
        if (d < bestDist) {
          bestDist = d
          bestI = i
        }
      }
    }
    if (bestI >= 0) propsRef.current.onPlot(bestI)
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className="scene2d-canvas"
    />
  )
}
