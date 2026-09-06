import { Canvas } from '@react-three/fiber'
import { CROPS, type CropId } from '@farm/game'
import './App.css'
import { trackPointerDown } from './farm3d/clickGuard'
import FarmScene from './farm3d/FarmScene'
import { useFarm } from './farm3d/useFarm'

export default function App() {
  const { data, handlePlot, select, reset } = useFarm()

  return (
    <div className="app">
      <Canvas
        shadows="percentage"
        flat
        dpr={[1, 2]}
        camera={{ position: [4.6, 3.6, 5.8], fov: 42, near: 0.1, far: 100 }}
        onPointerDown={trackPointerDown}
      >
        <FarmScene data={data} onPlot={handlePlot} />
      </Canvas>

      <header className="hud">
        <span className="hud-title">🧑‍🌾 小满农场</span>
        <span className="hud-badge">Phase 1 · D4 juice</span>
      </header>
      <div className="coins">🪙 {data.coins}</div>

      <div className="seedbar">
        {(Object.keys(CROPS) as CropId[]).map((id) => {
          const def = CROPS[id]
          const afford = data.coins >= def.seedPrice
          return (
            <button
              key={id}
              className={`seed ${data.selected === id ? 'active' : ''} ${afford ? '' : 'poor'}`}
              onClick={() => select(id)}
            >
              <span className="emoji">{def.emoji}</span>
              <span className="name">{def.name}</span>
              <span className="price">买 {def.seedPrice} · 卖 {def.sellPrice}</span>
            </button>
          )
        })}
        <button className="reset" onClick={reset}>
          ↺
        </button>
      </div>

      <div id="float-root" />
    </div>
  )
}
