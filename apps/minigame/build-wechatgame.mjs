#!/usr/bin/env node
// 把 src-wechatgame/ + @farm/game + @farm/game-ui 打包成两套产物：
//
// 1. build/wechatgame/   — 真正的微信小游戏目录（导入微信开发者工具）
//    ├── game.js         — bootstrap：polyfill localStorage + require game_bundle
//    ├── game_bundle.js  — 业务代码（@farm/game + @farm/game-ui + src-wechatgame/）
//    ├── game.json
//    └── project.config.json
//
// 2. build/wechatgame-preview/ — 浏览器预览（同套业务代码 + IIFE bundle）
//    供浏览器里手动验证玩法；与微信开发者工具打开的是同一份代码。

import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..', '..')
const gameSrc = resolve(repoRoot, 'packages/game/src/index.ts')
const gameUiSrc = resolve(repoRoot, 'packages/game-ui/src/index.ts')
const srcDir = resolve(__dirname, 'src-wechatgame')
const wxOutDir = resolve(__dirname, 'build/wechatgame')
const previewOutDir = resolve(__dirname, 'build/wechatgame-preview')
mkdirSync(wxOutDir, { recursive: true })
mkdirSync(previewOutDir, { recursive: true })

const alias = {
  '@farm/game': gameSrc,
  '@farm/game-ui': gameUiSrc,
}

// 1) 微信小游戏 bundle（CJS，require('./game_bundle') 走 GameGlobal 注入）
console.log('→ Compiling [wechatgame] bundle → build/wechatgame/game_bundle.js')
await build({
  entryPoints: [resolve(srcDir, 'main.ts')],
  bundle: true,
  format: 'cjs',
  target: 'es2020',
  outfile: resolve(wxOutDir, 'game_bundle.js'),
  platform: 'neutral',
  alias,
  sourcemap: false,
  logLevel: 'info',
})

// 2) 浏览器预览 bundle（IIFE，浏览器里直接 <script src>)
console.log('→ Compiling [preview] bundle → build/wechatgame-preview/game_bundle.js')
await build({
  entryPoints: [resolve(srcDir, 'main.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: resolve(previewOutDir, 'game_bundle.js'),
  platform: 'browser',
  alias,
  sourcemap: false,
  logLevel: 'info',
})

// 2b) 同样的 bundle 拷一份到 preview/ 旁边，方便本地打开 index.html
import { copyFileSync } from 'node:fs'
copyFileSync(
  resolve(previewOutDir, 'game_bundle.js'),
  resolve(__dirname, 'preview/game_bundle.js'),
)
console.log('  ↳ copied → preview/game_bundle.js (本地双击 index.html 也能跑)')

// 3) game.js bootstrap (wechatgame only)
const bootstrap = `// bootstrap: localStorage polyfill + require game_bundle
GameGlobal.localStorage = {
  getItem(k) {
    try {
      const v = wx.getStorageSync(k)
      return typeof v === 'string' ? v : null
    } catch { return null }
  },
  setItem(k, v) {
    try { wx.setStorageSync(k, String(v)) } catch {}
  },
  removeItem(k) {
    try { wx.removeStorageSync(k) } catch {}
  },
  clear() {
    try { wx.clearStorageSync() } catch {}
  },
}

require('./game_bundle.js')
`
writeFileSync(resolve(wxOutDir, 'game.js'), bootstrap)

// 4) game.json
const gameJson = {
  deviceOrientation: 'portrait',
  showStatusBar: false,
  networkTimeout: 60000,
}
writeFileSync(resolve(wxOutDir, 'game.json'), JSON.stringify(gameJson, null, 2) + '\n')

// 5) project.config.json
const projectConfig = {
  description: '开心农场 2D（M1 微信小游戏版本，本地编译验证）',
  appid: 'touristappid',
  projectname: 'farm-minigame-m1',
  compileType: 'game',
  libVersion: '3.0.0',
  setting: {
    urlCheck: false,
    es6: true,
    enhance: true,
    postcss: false,
    minified: false,
    useApiHook: true,
    useApiHostProcess: true,
    babelSetting: {
      ignore: [],
      disablePlugins: [],
      outputPath: '',
    },
  },
  condition: {},
}
writeFileSync(resolve(wxOutDir, 'project.config.json'), JSON.stringify(projectConfig, null, 2) + '\n')

console.log('✓ wechatgame build complete →', wxOutDir)
console.log('✓ preview build complete →', previewOutDir)
