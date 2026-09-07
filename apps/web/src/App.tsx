import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { CROPS, type CropId } from '@farm/game'
import './App.css'
import { FERT_COST, setTool } from './farm3d/events'
import FarmScene from './farm3d/FarmScene'
import { useFarm } from './farm3d/useFarm'
import { setMuted, loadVolumePref } from './farm3d/sfx'
import { subscribeCombo } from './farm3d/combo'
import { loadTutorialDone, skipTutorial, startTutorial } from './farm3d/tutorial'

/** 作物特性一句话（与 events.ts 的 isThirsty/虫害权重规则对应，只是给玩家看的说明书） */
const TRAITS: Record<CropId, string> = {
  carrot: '耐旱 · 快',
  corn: '怕旱 · 招虫',
}

const HINTS_KEY = 'farm-demo-hints-v1'
const HINT_DISMISS_EVENT = 'farm:hint-dismiss'

/** localStorage 读失败（隐私模式、SSR、塞满）时一律视为「未关闭过」 */
function readHintsDismissed(): boolean {
  try {
    return localStorage.getItem(HINTS_KEY) === 'dismissed'
  } catch {
    return false
  }
}

export default function App() {
  const { data, tutorial, handlePlot, handlePest, select, reset, tickPlots } = useFarm()
  const [fertMode, setFertMode] = useState(false)
  const [hintsDismissed, setHintsDismissed] = useState(() => readHintsDismissed())
  // 静音状态：useState 初始化时调用 sfx.loadVolumePref()（内部读 localStorage 并同步 muted 标志 + masterGain.gain）
  const [muted, setMutedState] = useState<boolean>(() => loadVolumePref())
  const [comboFlash, setComboFlash] = useState(false)

  // P2-1：首次访问且未完成引导 → 自动开始
  useEffect(() => {
    if (!loadTutorialDone()) startTutorial()
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

  return (
    <div className="app">
      <Canvas
        shadows="percentage"
        flat
        dpr={[1, 2]}
        camera={{ position: [4.6, 3.6, 5.8], fov: 42, near: 0.1, far: 100 }}
      >
        <FarmScene data={data} onPlot={handlePlot} onPest={handlePest} onTickPlots={tickPlots} />
      </Canvas>

      <header className="hud">
        <span className="hud-title">🧑‍🌾 小满农场</span>
        <span className="hud-badge">Phase 1 · D6</span>
      </header>
      {/* key=coins：数字变化即重挂载，重放 150ms（DUR.fast）跳动 */}
      <div key={data.coins} className="coins">🪙 {data.coins}</div>

      {/* 事件横幅：events.ts 命令式更新（textContent/className），React 不参与 */}
      <div id="event-banner" />

      {/* combo >= 4 时全屏金色 vignette 闪光 */}
      <div id="combo-flash" className={comboFlash ? 'show' : ''} />

      {/* P1-3 教程提示：让用户发现 R 键重置和收获时的镜头推近
          P1-4 P0 补强：补一句"空地发光可播种"，让玩家把空地脉动与播种意图关联
          自动关闭由 R 键 / 收获动效派发 CustomEvent 触发
          主动关闭通过 localStorage 永久记忆 */}
      {!hintsDismissed && (
        <div className="hints" role="status">
          <span>空地发光可播种；收获时镜头自动推近；按 <span className="kbd">R</span> 重置视角</span>
          <button className="hints-never" onClick={closeHintsForever} type="button">
            不再提示
          </button>
          <button className="hints-close" onClick={closeHintsOnce} type="button" aria-label="关闭">
            ×
          </button>
        </div>
      )}

      {/* P2-1 新手引导 overlay：仅在引导进行中（step !== 0 && step !== 'done'）显示 */}
      {tutorial.step !== 0 && tutorial.step !== 'done' && (
        <div className="tutorial-overlay" role="status">
          <span>
            {tutorial.step === 1 && 'Step 1/3: 点这里选胡萝卜种子'}
            {tutorial.step === 2 && 'Step 2/3: 点这里播种到空地'}
            {tutorial.step === 3 && 'Step 3/3: 等待作物成熟后点击收获'}
          </span>
          <button onClick={skipTutorial} type="button">× 跳过</button>
          <button onClick={skipTutorial} type="button">不再提示</button>
        </div>
      )}

      {/* 引导完成后的庆祝提示 */}
      {tutorial.step === 'done' && tutorial.complete && (
        <div className="tutorial-overlay" role="status">
          <span>🎉 太棒了！现在你可以自由探索</span>
        </div>
      )}

      <div className="seedbar">
        {(Object.keys(CROPS) as CropId[]).map((id) => {
          const def = CROPS[id]
          const afford = data.coins >= def.seedPrice
          return (
            <button
              key={id}
              className={`seed ${data.selected === id && !fertMode ? 'active' : ''} ${afford ? '' : 'poor'} ${tutorial.step === 1 && id === 'carrot' ? 'tutorial-target' : ''}`}
              onClick={() => pickSeed(id)}
            >
              <span className="emoji">{def.emoji}</span>
              <span className="name">{def.name}</span>
              <span className="trait">{TRAITS[id]}</span>
              <span className="price">买 {def.seedPrice} · 卖 {def.sellPrice}</span>
            </button>
          )
        })}
        <button
          className={`seed fert ${fertMode ? 'active' : ''} ${data.coins < FERT_COST ? 'poor' : ''}`}
          onClick={pickFert}
          title="选中后点击生长中的作物：生长 +50%，直到收获（5 金币）"
        >
          <span className="emoji">🧪</span>
          <span className="name">施肥</span>
          <span className="trait">加速</span>
          <span className="price">{FERT_COST}🪙 · +50% 速度</span>
        </button>
        <button
          className="mute"
          onClick={toggleMute}
          aria-pressed={muted}
          aria-label={muted ? '取消静音' : '静音'}
          type="button"
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button className="reset" onClick={reset}>
          ↺
        </button>
      </div>

      <div id="float-root" />
    </div>
  )
}
