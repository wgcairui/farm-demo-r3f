import { Canvas } from '@react-three/fiber'
import './App.css'
import FarmScene from './farm3d/FarmScene'

export default function App() {
  return (
    <div className="app">
      <Canvas
        shadows
        flat
        dpr={[1, 2]}
        camera={{ position: [4.6, 3.6, 5.8], fov: 42, near: 0.1, far: 100 }}
      >
        <FarmScene />
      </Canvas>
      <header className="hud">
        <span className="hud-title">🧑‍🌾 小满农场</span>
        <span className="hud-badge">Phase 1 · D1 静态场景</span>
      </header>
    </div>
  )
}
