import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { CROPS, type CropId } from '@farm/game'
import './App.css'
import { FERT_COST, setTool } from './farm3d/events'
import FarmScene from './farm3d/FarmScene'
import { useFarm } from './farm3d/useFarm'
import { setMuted, loadVolumePref } from './farm3d/sfx'
import { subscribeCombo } from './farm3d/combo'
import { dismissTutorialOnce, loadTutorialDone, skipTutorial, startTutorial } from './farm3d/tutorial'
import {
  addDecoration,
  gridCellToWorld,
  GRID_COLS,
  GRID_ROWS,
  type DecorationKind,
} from './farm3d/decorations'
import { WeatherForecast, WeatherSheetBody } from './farm3d/WeatherForecast'
import { BottomSheet } from './farm3d/BottomSheet'

/** 作物特性一句话（与 events.ts 的 isThirsty/虫害权重规则对应，只是给玩家看的说明书） */
const TRAITS: Record<CropId, string> = {
  carrot: '耐旱 · 快',
  corn: '怕旱 · 招虫',
}

const HINTS_KEY = 'farm-demo-hints-v1'
const HINT_DISMISS_EVENT = 'farm:hint-dismiss'

/** P2-3 摆件 emoji 表 */
const DECO_EMOJI: Record<DecorationKind, string> = {
  windmill: '🗼',
  scarecrow: '🎃',
  barrel: '🛢',
  fence: '🪵',
}

/** P2-3 摆件中文名 */
const DECO_NAME: Record<DecorationKind, string> = {
  windmill: '风车',
  scarecrow: '稻草人',
  barrel: '木桶',
  fence: '木栅栏',
}

/** localStorage 读失败（隐私模式、SSR、塞满）时一律视为「未关闭过」 */
function readHintsDismissed(): boolean {
  try {
    return localStorage.getItem(HINTS_KEY) === 'dismissed'
  } catch {
    return false
  }
}

/** 移动优先：长按 1s 才确认重置 */
const RESET_HOLD_MS = 1000

export default function App() {
  const { data, tutorial, handlePlot, handlePest, select, reset, tickPlots } = useFarm()
  const [fertMode, setFertMode] = useState(false)
  const [hintsDismissed, setHintsDismissed] = useState(() => readHintsDismissed())
  // 静音状态：useState 初始化时调用 sfx.loadVolumePref()（内部读 localStorage 并同步 muted 标志 + masterGain.gain）
  const [muted, setMutedState] = useState<boolean>(() => loadVolumePref())
  const [comboFlash, setComboFlash] = useState(false)

  // Sheet 状态：互斥打开（同一时刻只一个抽屉）
  const [sheet, setSheet] = useState<'weather' | 'seed' | 'deco' | 'tutorial' | null>(null)
  const [seedSheetId, setSeedSheetId] = useState<CropId | null>(null)
  const [tutorialAutoShown, setTutorialAutoShown] = useState(false)

  // P2-3 摆件放置模式
  const [placingMode, setPlacingMode] = useState(false)
  const [placingKind, setPlacingKind] = useState<DecorationKind | null>(null)

  // 重置按钮长按进度
  const resetTimerRef = useRef<number | null>(null)
  const [resetPressing, setResetPressing] = useState(false)

  // P2-1：首次访问且未完成引导 → 自动开始 + 自动弹一次 tutorial sheet
  useEffect(() => {
    if (!loadTutorialDone()) {
      startTutorial()
      setTutorialAutoShown(true)
      // 延迟到开场运镜结束再弹（运镜 600ms + 一点点缓冲）
      const id = window.setTimeout(() => setSheet('tutorial'), 800)
      return () => window.clearTimeout(id)
    }
  }, [])

  useEffect(() => {
    const onDismiss = () => setHintsDismissed(true)
    window.addEventListener(HINT_DISMISS_EVENT, onDismiss)
    return () => window.removeEventListener(HINT_DISMISS_EVENT, onDismiss)
  }, [])

  // combo >= 4 时触发 150ms 全屏闪光
  useEffect(() => {
    return subscribeCombo(({ count }) => {
      if (count >= 4) {
        setComboFlash(true)
        window.setTimeout(() => setComboFlash(false), 150)
      }
    })
  }, [])

  const closeHintsOnce = () => setHintsDismissed(true)
  const closeHintsForever = () => {
    try {
      localStorage.setItem(HINTS_KEY, 'dismissed')
    } catch {
      // 隐私模式写不进去：降级为本次会话关闭
    }
    setHintsDismissed(true)
  }

  // sfx.setMuted 内部已写 localStorage（含 try/catch 兜底），这里只需同步 React state
  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }

  const pickSeed = (id: CropId) => {
    select(id)
    setFertMode(false)
    setTool('seed')
  }
  const pickFert = () => {
    const next = !fertMode
    setFertMode(next)
    setTool(next ? 'fert' : 'seed')
  }

  // 长按 ↺ 1s 才触发重置；press = pointerdown 任意时机，release/cancel = pointerup/pointerleave
  const startResetHold = () => {
    if (resetTimerRef.current !== null) return
    setResetPressing(true)
    resetTimerRef.current = window.setTimeout(() => {
      resetTimerRef.current = null
      setResetPressing(false)
      reset()
    }, RESET_HOLD_MS)
  }
  const cancelResetHold = () => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }
    setResetPressing(false)
  }
  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
        resetTimerRef.current = null
      }
    }
  }, [])

  // 种子详情 sheet：长按触发（pointerdown 后 400ms 算长按，移动端是合理的"查看详情"手势）。
  // 同时跟踪按下位置，超过 8px 位移就认为是拖拽（用户想滑动/滚动），取消长按 timer——
  // 否则用户一边选种一边手指稍微一动，400ms 后还是会弹详情，体验糟糕。
  const longPressTimerRef = useRef<number | null>(null)
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null)
  const LONG_PRESS_DRAG_PX = 8
  const startSeedLongPress = (id: CropId, ev: React.PointerEvent<HTMLButtonElement>) => {
    if (longPressTimerRef.current !== null) return
    longPressStartRef.current = { x: ev.clientX, y: ev.clientY }
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null
      longPressStartRef.current = null
      setSeedSheetId(id)
      setSheet('seed')
    }, 400)
  }
  const trackSeedLongPressMove = (ev: React.PointerEvent<HTMLButtonElement>) => {
    const start = longPressStartRef.current
    if (!start || longPressTimerRef.current === null) return
    const dx = ev.clientX - start.x
    const dy = ev.clientY - start.y
    if (Math.hypot(dx, dy) > LONG_PRESS_DRAG_PX) cancelSeedLongPress()
  }
  const cancelSeedLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    longPressStartRef.current = null
  }

  const seedSheetDef = seedSheetId ? CROPS[seedSheetId] : null

  return (
    <div className="app">
      <Canvas
        shadows="percentage"
        flat
        dpr={[1, 2]}
        camera={{ position: [5.4, 6.0, 6.8], fov: 48, near: 0.1, far: 100 }}
      >
        <FarmScene data={data} onPlot={handlePlot} onPest={handlePest} onTickPlots={tickPlots} />
      </Canvas>

      {/* 顶部 TopBar：标题 / 天气 / 金币 */}
      <header className="topbar">
        <span className="topbar-title">🧑‍🌾 小满农场</span>
        <WeatherForecast onOpen={() => setSheet('weather')} />
        <div key={data.coins} className="coin-pill">
          <span className="coin-icon">🪙</span>
          <span>{data.coins}</span>
        </div>
      </header>

      {/* 事件横幅：events.ts 命令式更新（textContent/className），React 不参与 */}
      <div id="event-banner" />

      {/* combo >= 4 时全屏金色 vignette 闪光 */}
      <div id="combo-flash" className={comboFlash ? 'show' : ''} />

      {/* P1-3 教程提示：让用户发现 R 键重置和收获时的镜头推近
          P1-4 P0 补强：补一句"空地发光可播种"，让玩家把空地脉动与播种意图关联
          自动关闭由 R 键 / 收获动效派发 CustomEvent 触发
          主动关闭通过 localStorage 永久记忆 */}
      {!hintsDismissed && sheet !== 'tutorial' && (
        <div className="hints" role="status">
          <span>
            空地发光可播种；按 <span className="kbd">R</span> 重置视角
          </span>
          <button className="hints-never" onClick={closeHintsForever} type="button">
            不再提示
          </button>
          <button className="hints-close" onClick={closeHintsOnce} type="button" aria-label="关闭">
            ×
          </button>
        </div>
      )}

      {/* P2-1 新手引导 overlay：仅在引导进行中（step !== 0 && step !== 'done'）显示
          移动优先：从顶部黄色条改为底部 sheet，统一移动端 modal 体验 */}
      {tutorial.step !== 0 && tutorial.step !== 'done' && (
        <div className="tutorial-overlay" role="status">
          <span style={{ flex: 1 }}>
            {tutorial.step === 1 && 'Step 1/3: 长按或点胡萝卜图标'}
            {tutorial.step === 2 && 'Step 2/3: 点空地播种'}
            {tutorial.step === 3 && 'Step 3/3: 等待成熟，点击收获'}
          </span>
          <button onClick={dismissTutorialOnce} type="button" aria-label="本次跳过（刷新后会再出现）">
            本次跳过
          </button>
          <button onClick={skipTutorial} type="button">
            不再提示
          </button>
        </div>
      )}

      {/* 引导完成后的庆祝提示 */}
      {tutorial.step === 'done' && tutorial.complete && (
        <div className="tutorial-overlay" role="status">
          <span style={{ flex: 1 }}>🎉 太棒了！现在自由探索</span>
        </div>
      )}

      {/* 底部 BottomBar：左侧种子 + 施肥 + 右侧工具 */}
      <div className="bottombar">
        <div className="seed-group" role="group" aria-label="选择种子">
          {(Object.keys(CROPS) as CropId[]).map((id) => {
            const def = CROPS[id]
            const afford = data.coins >= def.seedPrice
            const isActive = data.selected === id && !fertMode
            return (
              <button
                key={id}
                className={`seed-pill ${isActive ? 'active' : ''} ${
                  afford ? '' : 'poor'
                } ${tutorial.step === 1 && id === 'carrot' ? 'tutorial-target' : ''}`}
                onClick={() => pickSeed(id)}
                onPointerDown={(ev) => startSeedLongPress(id, ev)}
                onPointerMove={trackSeedLongPressMove}
                onPointerUp={cancelSeedLongPress}
                onPointerLeave={cancelSeedLongPress}
                onPointerCancel={cancelSeedLongPress}
                aria-label={`${def.name} ${def.seedPrice}/${def.sellPrice}`}
                type="button"
              >
                <span>{def.emoji}</span>
                <span className="price-badge">{def.seedPrice}</span>
              </button>
            )
          })}
          {/* 施肥按钮：作为第 3 颗"种子药丸"（emoji + 价格），切换为 fert tool */}
          <button
            key="fert"
            className={`seed-pill ${fertMode ? 'active' : ''} ${
              data.coins < FERT_COST ? 'poor' : ''
            }`}
            onClick={pickFert}
            aria-label={`施肥 ${FERT_COST} 金币`}
            type="button"
          >
            <span>🧪</span>
            <span className="price-badge">{FERT_COST}</span>
          </button>
        </div>

        <div className="tool-group" role="group" aria-label="工具">
          <button
            type="button"
            className={`icon-btn ${placingMode || placingKind ? 'active' : ''}`}
            onClick={() => setSheet('deco')}
            aria-label="装饰摆件"
            title="装饰摆件"
          >
            🏠
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? '取消静音' : '静音'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            type="button"
            className={`icon-btn icon-btn--reset ${resetPressing ? 'icon-btn--resetting' : ''}`}
            onPointerDown={startResetHold}
            onPointerUp={cancelResetHold}
            onPointerLeave={cancelResetHold}
            onPointerCancel={cancelResetHold}
            aria-label="长按重置"
            title="长按重置"
          >
            <span className="reset-progress" aria-hidden="true" />
            <span className="icon-btn__label">↺</span>
          </button>
        </div>
      </div>

      {/* P2-3 网格放置覆盖层（避让 HUD：top 52 / bottom 66） */}
      {placingMode && (
        <div
          className="deco-grid"
          onClick={(e) => {
            if (!placingKind) return
            const rect = e.currentTarget.getBoundingClientRect()
            const col = Math.floor(((e.clientX - rect.left) / rect.width) * GRID_COLS)
            const row = Math.floor(((e.clientY - rect.top) / rect.height) * GRID_ROWS)
            const clampedCol = Math.max(0, Math.min(GRID_COLS - 1, col))
            const clampedRow = Math.max(0, Math.min(GRID_ROWS - 1, row))
            const [wx, wz] = gridCellToWorld(clampedCol, clampedRow)
            addDecoration(placingKind, wx, wz, 0)
            setPlacingMode(false)
            setPlacingKind(null)
          }}
        >
          {Array.from({ length: GRID_COLS * GRID_ROWS }, (_, i) => (
            <div key={i} className="deco-cell" />
          ))}
        </div>
      )}

      <div id="float-root" />

      {/* 放置模式激活时，底部 BottomBar 让位给「取消 / 完成」二选一，避免依赖 ESC 键 */}
      {placingMode && (
        <div className="bottombar">
          <div className="tool-group" style={{ width: '100%', justifyContent: 'space-between' }}>
            <button
              type="button"
              className="icon-btn icon-btn--wide"
              onClick={() => {
                setPlacingMode(false)
                setPlacingKind(null)
              }}
              aria-label="取消放置"
            >
              取消
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
              点击格子放置
            </span>
            <button
              type="button"
              className="icon-btn icon-btn--wide active"
              onClick={() => {
                setPlacingMode(false)
                setPlacingKind(null)
              }}
              aria-label="完成放置"
            >
              完成
            </button>
          </div>
        </div>
      )}

      {/* —— BottomSheet 抽屉系统（互斥打开） —— */}
      <BottomSheet
        open={sheet === 'weather'}
        onClose={() => setSheet(null)}
        title="天气预报"
        subtitle="点击日期可快进到那一天"
      >
        <WeatherSheetBody onClose={() => setSheet(null)} />
      </BottomSheet>

      <BottomSheet
        open={sheet === 'seed' && seedSheetDef !== null}
        onClose={() => {
          setSheet(null)
          setSeedSheetId(null)
        }}
      >
        {seedSheetDef && (
          <div className="seed-detail">
            <span className="big-emoji">{seedSheetDef.emoji}</span>
            <span className="seed-name">{seedSheetDef.name}</span>
            <span className="seed-trait">{seedSheetId ? TRAITS[seedSheetId] : ''}</span>
            <div className="seed-prices">
              <span>
                买 <b>{seedSheetDef.seedPrice}</b> 🪙
              </span>
              <span>
                卖 <b>{seedSheetDef.sellPrice}</b> 🪙
              </span>
            </div>
            <button
              type="button"
              className="sheet-cta"
              style={{ marginTop: 16 }}
              onClick={() => {
                if (seedSheetId) pickSeed(seedSheetId)
                setSheet(null)
                setSeedSheetId(null)
              }}
            >
              选择 {seedSheetDef.name}
            </button>
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        open={sheet === 'deco'}
        onClose={() => setSheet(null)}
        title="摆件"
        subtitle="选一个放到农场里"
      >
        <div className="deco-sheet-grid">
          {(['windmill', 'scarecrow', 'barrel', 'fence'] as DecorationKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              className="deco-sheet-card"
              onClick={() => {
                setPlacingKind(kind)
                setPlacingMode(true)
                setSheet(null)
              }}
            >
              <span className="emoji">{DECO_EMOJI[kind]}</span>
              <span>{DECO_NAME[kind]}</span>
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet
        open={sheet === 'tutorial' && tutorial.step !== 0 && tutorial.step !== 'done'}
        onClose={() => setSheet(null)}
        title={tutorialAutoShown ? '欢迎来到小满农场' : '教程提示'}
        subtitle={
          tutorial.step === 1
            ? '点击底部的 🥕 胡萝卜图标开始'
            : tutorial.step === 2
            ? '点击任意空地播种'
            : '点击成熟的作物收获'
        }
      >
        <p style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.5, margin: '12px 0' }}>
          {tutorial.step === 1 &&
            '选种子只要点一下图标；想看价格 / 卖出价，长按图标会弹出详情。'}
          {tutorial.step === 2 && '播种会扣金币；作物需要时间生长，期间保持金色脉动。'}
          {tutorial.step === 3 &&
            '收获后金币入账；如果 8 秒内不点击清空，作物会自动消失。'}
        </p>
        <button type="button" className="sheet-cta" onClick={() => setSheet(null)}>
          继续
        </button>
      </BottomSheet>
    </div>
  )
}
