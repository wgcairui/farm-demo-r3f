// cap sync 会把 CapApp-SPM/Package.swift 重写回 github URL 依赖，
// 本机到 github.com 不通，跑完 sync 必须恢复成 vendor 本地引用。
import { readFileSync, writeFileSync } from 'node:fs'

const file = 'ios/App/CapApp-SPM/Package.swift'
const src = readFileSync(file, 'utf8')
const out = src.replace(
  /\.package\(url: "https:\/\/github\.com\/ionic-team\/capacitor-swift-pm\.git"[^\n]*\)/,
  '// 本地 vendor，绕过 github.com 不可达问题；npx cap sync 会重写本文件\n        .package(path: "Vendor/capacitor-swift-pm")',
)
if (out === src) {
  console.log('Package.swift 已是 vendor 引用，无需修改')
} else {
  writeFileSync(file, out)
  console.log('已恢复 Package.swift 为 vendor 本地依赖')
}
