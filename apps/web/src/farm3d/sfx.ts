// Web Audio 合成音效。Phase 2 RN 换 expo-audio 样本文件；
// 本模块固化的是"何时响 + 什么感觉"：播种低频噗、收获上升滑音、金币金属叮。

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let muted = false
const VOLUME_KEY = 'farm-demo-volume-v1'

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  // lazy init master gain（首帧用户交互后才建，避免 autoplay 策略拦截）
  if (!masterGain) {
    masterGain = ctx.createGain()
    masterGain.gain.value = muted ? 0 : 1
    masterGain.connect(ctx.destination)
  }
  return ctx
}

export function loadVolumePref(): boolean {
  try {
    const v = localStorage.getItem(VOLUME_KEY)
    muted = v === 'muted'
    if (masterGain) masterGain.gain.value = muted ? 0 : 1
    return muted
  } catch {
    return false
  }
}

export function setMuted(m: boolean): void {
  muted = m
  try {
    localStorage.setItem(VOLUME_KEY, m ? 'muted' : 'unmuted')
  } catch {
    // 隐私模式写不进去：忽略
  }
  if (masterGain) masterGain.gain.value = m ? 0 : 1
}

export function getMuted(): boolean {
  return muted
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
  // masterGain 在 ac() 已 connect 到 destination；这里只接 masterGain 即可，不要再接 a.destination
  // 否则双 bus 叠加 +6dB，音量比预期响
  osc.connect(g).connect(masterGain!)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

interface NoiseOpts {
  dur: number
  gain: number
  freq: number
  kind?: BiquadFilterType
  delay?: number
}

/** 白噪声 + 滤波：雨沙沙、风呜呜、水花哗，振荡器合成不出来的"质感"都走这里 */
function noise({ dur, gain, freq, kind = 'lowpass', delay = 0 }: NoiseOpts) {
  const a = ac()
  const t0 = a.currentTime + delay
  const len = Math.max(1, Math.ceil(a.sampleRate * dur))
  const buf = a.createBuffer(1, len, a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = a.createBufferSource()
  src.buffer = buf
  const f = a.createBiquadFilter()
  f.type = kind
  f.frequency.value = freq
  const g = a.createGain()
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  src.connect(f).connect(g).connect(masterGain!)
  src.start(t0)
  src.stop(t0 + dur + 0.02)
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

// —— D6 事件音效：同一套"何时响"标准——事件开始一响、玩家动作即时一响 ——

/** 雨：高频沙沙 + 低频闷鸣两层 */
export function playRain() {
  noise({ dur: 1.6, gain: 0.09, freq: 2800, kind: 'highpass' })
  tone({ type: 'sine', f0: 220, f1: 170, dur: 0.7, gain: 0.05 })
}

/** 干旱：低频风声，空和燥 */
export function playDrought() {
  noise({ dur: 1.4, gain: 0.06, freq: 300 })
}

/** 害虫登场：三短促方波颤音 */
export function playPest() {
  tone({ type: 'square', f0: 190, f1: 240, dur: 0.09, gain: 0.045 })
  tone({ type: 'square', f0: 190, f1: 240, dur: 0.09, gain: 0.045, delay: 0.13 })
  tone({ type: 'square', f0: 190, f1: 240, dur: 0.09, gain: 0.045, delay: 0.26 })
}

/** 拍死：短促下坠噗 */
export function playSquash() {
  tone({ type: 'triangle', f0: 320, f1: 90, dur: 0.12, gain: 0.25 })
}

/** 虫害得逞：下坠锯齿，"坏了"的听感 */
export function playDamage() {
  tone({ type: 'sawtooth', f0: 260, f1: 110, dur: 0.32, gain: 0.11 })
}

/** 浇水：窄带噪声水花 */
export function playSplash() {
  noise({ dur: 0.18, gain: 0.14, freq: 1100, kind: 'bandpass' })
}

/** 施肥：两连上升软音，比金币温和 */
export function playFertilize() {
  tone({ type: 'sine', f0: 520, f1: 780, dur: 0.12, gain: 0.12 })
  tone({ type: 'sine', f0: 780, f1: 1040, dur: 0.12, gain: 0.08, delay: 0.09 })
}
