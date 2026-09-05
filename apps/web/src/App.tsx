import { useEffect, useState } from 'react'
import './App.css'
import { CROPS, type CropId, type SaveData, type Stage, load, progressOf, save, stageOf } from '@farm/game'

interface Float {
  id: number
  plot: number
  text: string
}

export default function App() {
  const [data, setData] = useState<SaveData>(() => load())
  const [now, setNow] = useState(() => Date.now())
  const [floats, setFloats] = useState<Float[]>([])

  // 500ms 心跳驱动 UI 重算生长阶段（数据本身只依赖时间戳）
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    save(data)
  }, [data])

  function handlePlot(i: number) {
    const p = data.plots[i]
    const st = stageOf(p, Date.now())

    if (st === 'empty') {
      const def = CROPS[data.selected]
      if (data.coins < def.seedPrice) return
      setData((d) => {
        const plots = d.plots.slice()
        plots[i] = { crop: d.selected, plantedAt: Date.now() }
        return { ...d, plots, coins: d.coins - def.seedPrice }
      })
      return
    }

    if (st === 'mature' && p.crop) {
      const def = CROPS[p.crop]
      const id = Date.now() + Math.random()
      setFloats((f) => [...f, { id, plot: i, text: `+${def.sellPrice}` }])
      setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 900)
      setData((d) => {
        const plots = d.plots.slice()
        plots[i] = { crop: null, plantedAt: null }
        return { ...d, plots, coins: d.coins + def.sellPrice }
      })
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🧑‍🌾 开心农场</h1>
        <div className="coins">🪙 {data.coins}</div>
      </header>

      <div className="grid">
        {data.plots.map((p, i) => {
          const st: Stage = stageOf(p, now)
          const def = p.crop ? CROPS[p.crop] : null
          return (
            <div key={i} className={`plot ${st}`} onClick={() => handlePlot(i)}>
              {st === 'empty' && <span className="hint">✚</span>}
              {st === 'sprout' && <span className="plant">🌱</span>}
              {st === 'growing' && <span className="plant">🌿</span>}
              {st === 'mature' && def && <span className="plant">{def.emoji}</span>}
              {def && st !== 'empty' && (
                <div className="progress">
                  <i style={{ width: `${progressOf(p, now) * 100}%` }} />
                </div>
              )}
              {floats
                .filter((f) => f.plot === i)
                .map((f) => (
                  <span key={f.id} className="float">
                    {f.text}
                  </span>
                ))}
            </div>
          )
        })}
      </div>

      <p className="tip">选种子 → 点空地播种 → 成熟后点收获</p>

      <div className="seedbar">
        {(Object.keys(CROPS) as CropId[]).map((id) => {
          const def = CROPS[id]
          const afford = data.coins >= def.seedPrice
          return (
            <button
              key={id}
              className={`seed ${data.selected === id ? 'active' : ''} ${afford ? '' : 'poor'}`}
              onClick={() => setData((d) => ({ ...d, selected: id }))}
            >
              <span className="emoji">{def.emoji}</span>
              <span className="name">{def.name}</span>
              <span className="price">买 {def.seedPrice} · 卖 {def.sellPrice}</span>
            </button>
          )
        })}
        <button
          className="reset"
          onClick={() => {
            localStorage.clear()
            location.reload()
          }}
        >
          ↺
        </button>
      </div>
    </div>
  )
}
