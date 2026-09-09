// 微信小游戏入口：拿到 canvas → 起主循环 → 派发触摸事件。
//
// 设计：AppController 纯逻辑 + Canvas 2D 渲染 + wx.onTouchStart/Move/End 三件套。
// 与 web 端 useFrame 同样的 "plantedAt 是唯一事实源" 不变量。
// 与 Cocos 端同样的全局单例 (`globalThis.__farmApp`)。

import { AppController } from './controller'
import { createWxStorageBackend } from './storage'
import { drawScene } from './render/scene'
import { hitTestPlot, hitTestSeed, type ScreenSize } from './render/layout'

interface GlobalWithApp {
  __farmApp?: AppController
}

function start() {
  const designSize: ScreenSize = { width: 750, height: 1334 }

  const canvas = wx.createCanvas()
  canvas.width = designSize.width
  canvas.height = designSize.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    console.error('[farm] failed to get 2d context')
    return
  }

  const app = new AppController(createWxStorageBackend())
  ;(globalThis as unknown as GlobalWithApp).__farmApp = app

  // 主循环：用 setInterval 兜底，1/30s 帧（与 Cocos 60fps 同模式）
  // 微信小游戏没有 requestAnimationFrame，用 setInterval 驱动
  const FRAME_MS = 1000 / 30
  let lastTouch: { x: number; y: number; t: number } | null = null
  const TAP_SLOP_PX = 20
  const TAP_MAX_MS = 500

  setInterval(() => {
    app.tick()
    drawScene(ctx, app, designSize)
  }, FRAME_MS)

  // 触摸事件：start 记坐标，end 做 hit-test；位移阈值抗滑
  wx.onTouchStart((e: unknown) => {
    const touch = (e as { touches: Array<{ clientX: number; clientY: number }> }).touches[0]
    if (!touch) return
    lastTouch = { x: touch.clientX, y: touch.clientY, t: Date.now() }
  })

  wx.onTouchEnd((e: unknown) => {
    const touch = (e as { changes: Array<{ clientX: number; clientY: number }> }).changes[0]
    if (!touch || !lastTouch) {
      lastTouch = null
      return
    }
    const dx = touch.clientX - lastTouch.x
    const dy = touch.clientY - lastTouch.y
    const dt = Date.now() - lastTouch.t
    lastTouch = null
    if (Math.hypot(dx, dy) > TAP_SLOP_PX || dt > TAP_MAX_MS) return

    // 触摸坐标已经是 canvas-internal 设计坐标（polyfill 在 onTouchEnd 之前转好）
    const x = touch.clientX
    const y = touch.clientY

    const plotIdx = hitTestPlot(x, y, designSize)
    if (plotIdx !== null) {
      app.handlePlot(plotIdx)
      return
    }
    const seedIdx = hitTestSeed(x, y, designSize)
    if (seedIdx !== null) {
      const crops: Array<'carrot' | 'corn'> = ['carrot', 'corn']
      app.select(crops[seedIdx])
    }
  })
}

start()
