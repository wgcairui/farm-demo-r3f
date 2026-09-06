// Web Audio 合成音效。Phase 2 RN 换 expo-audio 样本文件；
// 本模块固化的是"何时响 + 什么感觉"：播种低频噗、收获上升滑音、金币金属叮。

let ctx: AudioContext | null = null

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

interface ToneOpts {
  type: OscillatorType
  f0: number
  f1?: number
  dur: number
  gain: number
  delay?: number
}

function tone({ type, f0, f1, dur, gain, delay = 0 }: ToneOpts) {
  const a = ac()
  const t0 = a.currentTime + delay
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(f0, t0)
  if (f1) osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur)
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  osc.connect(g).connect(a.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

export function playPlant() {
  tone({ type: 'triangle', f0: 190, f1: 70, dur: 0.14, gain: 0.3 })
}

export function playHarvest() {
  tone({ type: 'triangle', f0: 330, f1: 660, dur: 0.16, gain: 0.22 })
  tone({ type: 'sine', f0: 660, f1: 990, dur: 0.14, gain: 0.12, delay: 0.06 })
}

export function playCoin() {
  tone({ type: 'sine', f0: 1319, dur: 0.4, gain: 0.16 })
  tone({ type: 'sine', f0: 1979, dur: 0.3, gain: 0.08 })
  tone({ type: 'sine', f0: 2637, dur: 0.18, gain: 0.04 })
}
