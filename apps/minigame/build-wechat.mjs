#!/usr/bin/env node
// 把 @farm/game + 本地 src/ 编译并拷贝到 assets/scripts/，Cocos Creator 资源系统能识别。
// 运行前确保在 apps/minigame/ 目录内已 `npm install`（让 @farm/game 通过 workspaces 软链进来）。
//
// 用法：
//   node ./build-wechat.mjs           # 编译并拷贝
//   node ./build-wechat.mjs --watch   # watch 模式（开发用）
//
// 产物路径：
//   assets/scripts/_game.js           # @farm/game 编译后（独立 bundle，避免与 Cocos runtime 冲突）
//   assets/scripts/minigame.js        # 本地 src/ 编译聚合入口
//
// Cocos Creator 3.8 加载脚本约定：
//   - 放在 assets/scripts/ 下的 .js 会被识别为脚本资源
//   - 在编辑器里新建 cc.Component 类时 import from './...' 即可

import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdirSync, copyFileSync, existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..', '..')
const gameSrc = resolve(repoRoot, 'packages/game/src/index.ts')
const gameUiSrc = resolve(repoRoot, 'packages/game-ui/src/index.ts')
const minigameSrc = resolve(__dirname, 'src/main.ts')
const outDir = resolve(__dirname, 'assets/scripts')
mkdirSync(outDir, { recursive: true })

const watch = process.argv.includes('--watch')

// @farm/game 必须打成独立 ESM 文件，不能打包进 minigame.js —— 否则 Cocos runtime 全局冲突。
// Cocos 把所有 assets/scripts/*.js 视作独立模块，但会去重 import，所以模块级 const 都得各自封闭。

console.log('→ Compiling @farm/game → assets/scripts/_game.js')
await build({
  entryPoints: [gameSrc],
  bundle: true,
  format: 'esm',
  target: 'es2020',
  outfile: resolve(outDir, '_game.js'),
  platform: 'browser',
  sourcemap: true,
  logLevel: 'info',
})

console.log('→ Compiling src/main.ts → assets/scripts/minigame.js')
await build({
  entryPoints: [minigameSrc],
  bundle: true,
  format: 'esm',
  target: 'es2020',
  outfile: resolve(outDir, 'minigame.js'),
  platform: 'browser',
  alias: {
    '@farm/game': gameSrc,
    '@farm/game-ui': gameUiSrc,
  },
  sourcemap: true,
  logLevel: 'info',
  external: [],
})

// 拷贝一份 _game.js 到 src/ 同级，方便 Cocos 资源路径解析（可选）
copyFileSync(
  resolve(outDir, '_game.js'),
  resolve(__dirname, '_game.bundled.js'),
)
console.log('✓ build complete →', outDir)

if (watch) {
  console.log('⚠ Watch mode 暂未实现，请在 Cocos Creator 编辑器内做实时预览')
}
