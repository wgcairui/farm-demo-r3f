import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { CROPS, type CropId } from '@farm/game'
import './App.css'
import { FERT_COST, setTool } from './farm3d/events'
import FarmScene from './farm3d/FarmScene'
import { useFarm } from './farm3d/useFarm'
import { setMuted, loadVolumePref } from './farm3d/sfx'

/** 作物特性一句话（与 events.ts 的 isThirsty/虫害权重规则对应，只是给玩家看的说明书） */
const TRAITS: Record<CropId, string> = {
  carrot: '耐旱 · 快',
  corn: '怕旱 · 招虫',
}

const HINTS_KEY = 'farm-demo-hints-v1'
const HINT_DISMISS_EVENT = 'farm:hint-dismiss'
const MUTED_KEY = 'farm-demo-volume-v1'

/** localStorage 读失败（隐私模式、SSR、塞满）时一律视为「未关闭过」 */
function readHintsDismissed(): boolean {
  try {
    return localStorage.getItem(HINTS_KEY) === 'dismissed'
  } catch {
    return false
  }
}

/** 读静音偏好：与 sfx.ts 的 VOLUME_KEY 保持一致 */
function readMutePref(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === 'muted'
  } catch {
    return false
  }
}

export default function App() {
  const { data, handlePlot, handlePest, select, reset, tickPlots } = useFarm()
  const [fertMode, setFertMode] = useState(false)
  const [hintsDismissed, setHintsDismissed] = useState(() => readHintsDismissed())
  const [muted, setMutedState] = useState<boolean>(() => loadVolumePref())

  useEffect(() => {
    const onDismiss = () => setHintsDismissed(true)
    window.addEventListener(HINT_DISMISS_EVENT, onDismiss)
    return () => window.removeEventListener(HINT_DISMISS_EVENT, onDismiss)
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

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    setMutedState(next)
    try {
      localStorage.setItem(MUTED_KEY, next ? 'muted' : 'unmuted')
    } catch {
      // 隐私模式写不进去：忽略
    }
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

      {/* P1-3 教程提示：让用户发现 R 键重置和收获时的镜头推近
          自动关闭由 R 键 / 收获动效派发 CustomEvent 触发
          主动关闭通过 localStorage 永久记忆 */}
      {!hintsDismissed && (
        <div className="hints" role="status">
          <span>收获时镜头会自动推近；按 <span className="kbd">R</span> 重置视角</span>
          <button className="hints-never" onClick={closeHintsForever} type="button">
            不再提示
          </button>
          <button className="hints-close" onClick={closeHintsOnce} type="button" aria-label="关闭">
            ×
          </button>
        </div>
      )}

      <div className="seedbar">
        {(Object.keys(CROPS) as CropId[]).map((id) => {
          const def = CROPS[id]
          const afford = data.coins >= def.seedPrice
          return (
            <button
              key={id}
              className={`seed ${data.selected === id && !fertMode ? 'active' : ''} ${afford ? '' : 'poor'}`}
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
        <button className="mute" onClick={toggleMute}>
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
