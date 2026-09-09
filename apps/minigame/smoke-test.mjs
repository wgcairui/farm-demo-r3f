#!/usr/bin/env node
// Smoke test for the wechatgame game loop — exercises AppController end-to-end
// without needing a browser or the 微信开发者工具.
//
// Pattern:
//   1. stub localStorage (in-memory) → create StorageBackend from the stub
//   2. require the compiled game_bundle.js (which auto-runs start() against a stubbed wx)
//   3. drive the controller directly: plant → fast-forward time → harvest
//
// Note: the compiled bundle uses setInterval to tick. We don't need the timer
// to fire — we drive controller.tick() ourselves in deterministic steps.

import { Module } from 'node:module'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const bundle = resolve(__dirname, 'build/wechatgame-preview/game_bundle.js')

// ---------- 1. stub localStorage (in-memory) ----------
const memStore = new Map()
function makeMemBackend() {
  return {
    getItem(k) { return memStore.has(k) ? memStore.get(k) : null },
    setItem(k, v) { memStore.set(k, String(v)) },
  }
}

// ---------- 2. stub wx / canvas / GameGlobal so the bundle can start ----------
// Stub a minimal Canvas 2D context — the game code calls fillRect / fillText etc.
function makeStubCtx() {
  const noop = () => {}
  return new Proxy({
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
    fillRect: noop,
    fillText: noop,
    strokeRect: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    fill: noop,
    stroke: noop,
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
  }, { get(t, k) { return k in t ? t[k] : noop } })
}

const fakeCanvas = {
  width: 0,
  height: 0,
  getContext() { return makeStubCtx() },
}

const stubWx = {
  createCanvas() { return fakeCanvas },
  getSystemInfoSync() { return { windowWidth: 750, windowHeight: 1334, pixelRatio: 1 } },
  getStorageSync(k) { return memStore.has(k) ? memStore.get(k) : undefined },
  setStorageSync(k, v) { memStore.set(k, String(v)) },
  removeStorageSync(k) { memStore.delete(k) },
  clearStorageSync() { memStore.clear() },
  onTouchStart() {},
  onTouchMove() {},
  onTouchEnd() {},
  onTouchCancel() {},
}

globalThis.GameGlobal = globalThis
globalThis.GameGlobal.localStorage = {
  getItem: (k) => memStore.has(k) ? memStore.get(k) : null,
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k),
  clear: () => memStore.clear(),
}
globalThis.wx = stubWx

// Intercept require so esbuild's CommonJS output works inside our ESM context.
// The IIFE bundle doesn't actually need require() at runtime; esbuild emitted
// it as one self-contained script. We import it via a CJS-friendly loader:
import { readFileSync } from 'node:fs'
const code = readFileSync(bundle, 'utf8')
const wrapped = `(function(GameGlobal, wx){ ${code}\n}).call(this, this.GameGlobal, this.wx)`
const fn = new Function('GameGlobal', 'wx', code)
fn(globalThis.GameGlobal, globalThis.wx)

// ---------- 3. drive the controller ----------
// After the bundle runs, globalThis.__farmApp should be set.
const app = globalThis.__farmApp
if (!app) {
  console.error('FAIL: __farmApp not exposed by bundle')
  process.exit(1)
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg)
    process.exit(1)
  }
  console.log('  ✓', msg)
}

function header(s) { console.log('\n— ' + s + ' —') }

header('initial state')
const init = app.getData()
assert(init.coins === 50, `coins = 50 (got ${init.coins})`)
assert(init.plots.length === 6, `6 plots (got ${init.plots.length})`)
assert(init.plots.every((p) => p.state === 'empty'), 'all plots empty')
assert(init.selected === 'carrot', `selected = carrot (got ${init.selected})`)

header('plant on plot 0')
app.handlePlot(0)
let after = app.getData()
assert(after.coins === 40, `coins -= 10 (got ${after.coins})`)
assert(after.plots[0].crop === 'carrot', 'plot 0 crop = carrot')
assert(after.plots[0].state === 'sown', `plot 0 state = sown (got ${after.plots[0].state})`)
assert(after.plots[0].plantedAt !== null, 'plot 0 plantedAt set')

header('select corn and plant on plot 1')
app.select('corn')
assert(app.getData().selected === 'corn', 'selected → corn')
app.handlePlot(1)
after = app.getData()
assert(after.coins === 20, `coins -= 20 (got ${after.coins})`)
assert(after.plots[1].crop === 'corn', 'plot 1 crop = corn')

header('save round-trip')
app.tick()
const stored = memStore.get('farm-demo-v2')
assert(typeof stored === 'string', 'save() wrote to memStore')
const parsed = JSON.parse(stored)
assert(parsed.coins === 20, `persisted coins = 20 (got ${parsed.coins})`)

header('cannot plant on growing plot')
const before = app.getData().coins
app.handlePlot(0)
after = app.getData()
assert(after.coins === before, 'coins unchanged on growing plot')
assert(after.plots[0].state === 'sown', 'plot 0 still sown')

header('cannot plant when broke')
// Spend down to 0 coins
for (let i = 0; i < 3; i++) {
  app.select('corn')
  app.handlePlot(i)
  app.handlePlot(i) // no-op for non-empty
}
after = app.getData()
const coinsBeforePlant = after.coins
const emptyPlots = after.plots.map((p, i) => p.state === 'empty' ? i : -1).filter((i) => i >= 0)
if (emptyPlots.length > 0) {
  // Try planting — should fail because coins < seedPrice
  app.select('corn')
  app.handlePlot(emptyPlots[0])
  after = app.getData()
  assert(after.coins === coinsBeforePlant, `broke check: coins unchanged (got ${after.coins}, before ${coinsBeforePlant})`)
}

header('fast-forward plot 0 to mature')
// Carrot stages: sown 10s + growing 15s = 25s total
const plantedAt = after.plots[0].plantedAt
if (plantedAt !== null) {
  // Monkey-patch Date.now to simulate time passing
  const realNow = Date.now
  const fakeNow = realNow() + 26_000 // > 25s, should be mature
  globalThis.Date.now = () => fakeNow
  // trigger state recompute via tick (which calls stageOf internally)
  app.tick()
  // The actual plantedAt stays the same; the crop is mature because of elapsed time
  // We need to verify by importing @farm/game's stageOf and checking
  // Since we can't easily import from inside this script, we just trust the bundle
  // and check via the controller's tick:
  const data = app.getData()
  // plantingAt + 26s means stageOf should return 'mature'
  // The harvest action returns coins += sellPrice (25)
  globalThis.Date.now = realNow
  // Now click plot 0 to harvest
  app.handlePlot(0)
  app.tick() // flush save
  const after2 = app.getData()
  assert(after2.plots[0].state === 'empty', `plot 0 harvested → empty (got ${after2.plots[0].state})`)
  assert(after2.coins === after.coins + 25, `coins += 25 (got ${after2.coins}, before ${after.coins})`)
}

header('persistence across instances')
// Simulate closing & reopening: clear app reference, re-run the bundle
const savedCoins = app.getData().coins
console.log('  [debug] memStore snapshot:', JSON.stringify(memStore.get('farm-demo-v2')))
delete globalThis.__farmApp
const fn2 = new Function('GameGlobal', 'wx', code)
fn2(globalThis.GameGlobal, globalThis.wx)
const app2 = globalThis.__farmApp
console.log('  [debug] app2.getData() =', JSON.stringify(app2.getData()))
assert(app2 !== app, 'second instance is a different object')
assert(app2.getData().coins === savedCoins, `reloaded coins = ${savedCoins} (got ${app2.getData().coins})`)

console.log('\n✅ all smoke checks passed')

// Explicit exit — bundle started a setInterval loop that would keep node alive.
process.exit(0)
