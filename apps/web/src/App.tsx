import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { CROPS, type CropId } from '@farm/game'
import './App.css'
import { trackPointerDown } from './farm3d/clickGuard'
import { FERT_COST, setTool } from './farm3d/events'
import FarmScene from './farm3d/FarmScene'
import { useFarm } from './farm3d/useFarm'

/** 作物特性一句话（与 events.ts 的 isThirsty/虫害权重规则对应，只是给玩家看的说明书） */
const TRAITS: Record<CropId, string> = {
  carrot: '耐旱 · 快',
  corn: '怕旱 · 招虫',
}

export default function App() {
  const { data, handlePlot, handlePest, select, reset, tickPlots } = useFarm()
  const [fertMode, setFertMode] = useState(false)

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
        onPointerDown={trackPointerDown}
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
        <button className="reset" onClick={reset}>
          ↺
        </button>
      </div>

      <div id="float-root" />
    </div>
  )
}
