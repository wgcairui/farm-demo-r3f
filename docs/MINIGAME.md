# Cocos Creator 微信小游戏

> 状态：M1 + M1.5 已完成本地编译验证 + 浏览器 E2E 点击验证；M2（期望画面复刻）2026-09-13 启动
> 路线 + 检查点：见 [ROADMAP.md](./ROADMAP.md)
> PRD 范围：见 [PRD.md §9](./PRD.md#9-第三平台--微信小游戏qq-农场风格-2d-portrait)
>
> **2026-09-09 关键决策**：在 Cocos 路径之外新增 **「纯微信小游戏」渲染路径**（`apps/minigame/src-wechatgame/`），用原生 Canvas 2D + esbuild 输出完整 `build/wechatgame/` 目录（game.js + game.json + project.config.json + game_bundle.js），**无需安装 Cocos Creator 编辑器**即可在微信开发者工具中直接打开跑通。M2 会并行推进 Cocos 期望画面版与原生 canvas 版，按 M2 验收结果二选一深入。

## 1. 决策摘要

| 维度 | 选择 | 理由 |
|---|---|---|
| 引擎 | Cocos Creator 3.8.x LTS + 2D 模式 | LTS 稳定；2D 编辑器路径最简；小游戏平台官方支持 |
| 工程目录 | `apps/minigame/`（与 web/mobile 并列） | 第三渲染壳，叙事对齐 |
| 包名 | `@farm/minigame` | 跟随 `@farm/web`、`@farm/mobile` |
| 存储 | 注入式（4 行改 `@farm/game`） | 唯一碰 game 包的红线点，已做向后兼容 |
| 美术 | M1 全部程序化（Graphics 画矩形 + Label emoji） | 不卡美术；CC0 sprite 后续替换 |
| 里程碑 | M1 单场景原型 | 验证技术栈；M2/M3 待办 |

## 2. 触碰 `packages/game` 的唯一红点

`load` / `save` 签名加可选 `backend` 参数；不传时走默认 `localStorage`（web 端现有调用零改动）。

```ts
// packages/game/src/index.ts
export interface StorageBackend {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const defaultBackend: StorageBackend = {
  getItem: (k) => localStorage.getItem(k),
  setItem: (k, v) => localStorage.setItem(k, v),
}

export function load(backend: StorageBackend = defaultBackend): SaveData { /* ... */ }
export function save(d: SaveData, backend: StorageBackend = defaultBackend) { /* ... */ }
```

**diff 统计**：新增 8 行（接口 + 默认 backend）、改 4 行（两个签名 + 两个 getItem + 一个 setItem）。9 个纯函数零改动。web 端 `useFarm.ts:36 / :48` 不传参继续工作。

## 3. 两套并行渲染路径

### 3.1 Cocos 路径（`apps/minigame/src/`）

```
src/
├── main.ts          # Cocos @ccclass Main 入口：建 AppController + update 调 tick
├── app.ts           # AppController：注入 backend → 状态壳镜像 web useFarm
├── storage.ts        # createWxStorageBackend()：wx.getStorageSync/SetStorageSync
├── types.ts         # 跨模块契约：re-export @farm/game + AppControllerLike 接口
├── layout.ts        # 6 块地屏幕坐标（设计分辨率 750×1334）
└── nodes/
    ├── PlotView.ts        # 单地块：Graphics 底色 + Label emoji 作物 + 状态环
    ├── PlotSeedBar.ts     # 底部种子栏：🥕 / 🌽 两个按钮
    └── CoinHud.ts         # 顶部金币 HUD：💰 <coins>
```

> **M1.5 更新**：motion.ts / landState.ts 已从 `apps/minigame/src/` 删掉，改 import 指向 `@farm/game-ui`。

### 3.2 原生 Canvas 2D 路径（`apps/minigame/src-wechatgame/`）— M1 新增

```
src-wechatgame/
├── main.ts                   # 主入口：setInterval 30fps + wx.onTouchStart/End 分发
├── controller.ts             # AppController：纯逻辑层，零渲染依赖
├── storage.ts                # createWxStorageBackend() 桥接 wx.getStorageSync
├── types/wx.d.ts             # 微信 API 全局 stub（CLI tsc 校验用）
└── render/
    ├── types.ts              # AppControllerLike 接口（视图层只引用接口，避开循环）
    ├── layout.ts             # 6 块地 + 2 按钮的屏幕坐标 + hit-test
    └── scene.ts              # drawScene()：每帧 ctx → 6 块地 + 金币 + 种子栏
```

### 3.3 关键设计：不变量

1. **生长呈现仍走时间戳插值**：与 AGENTS.md 第 44 行"plantedAt 是唯一事实源"对齐 — `controller.tick()` 每帧用 `stageOf(plot, now)` 派生当前阶段（sown → growing → mature），并在 `plot.state` 落后于派生时 setState（**这是 P2-7 fix 的同款教训**：state 必须基于事实源推导而不是缓存；见 `events.ts:tickPlotStates` 的注释）。
2. **`__farmApp` 全局单例**：与 web 端 `useState<SaveData>` 镜像；视图节点通过 `globalThis.__farmApp` 访问，循环依赖用 `AppControllerLike` 接口切断。
3. **触摸事件替 clickGuard**：
   - Cocos 路径：PlotView 挂 `Node.EventType.TOUCH_END`，自带按下-抬起抗滑语义。
   - 原生 canvas 路径：`onTouchStart` 记录 lastTouch，`onTouchEnd` 计算位移 ≤20px 才算 click（Cocos `TOUCH_END` 的天然抗滑在原生 canvas 里手写）。
4. **easeOutCubic 镜像**：scale 曲线 `0.4 + 0.6 * easeOutCubic(t)` 与 web 端 `0.08 + 0.92 * ease.outCubic(t)` 思想一致（两端系数不同因 2D 视觉需要更小起点）。

## 4. 构建管道

```
npm install                                          # 根目录 workspaces 同步
npm run typecheck -w @farm/minigame                  # Cocos 路径 tsc
npm run typecheck:wechatgame -w @farm/minigame       # 原生 canvas 路径 tsc
node apps/minigame/build-wechat.mjs                  # Cocos 路径：编译 game + minigame → assets/scripts/
node apps/minigame/build-wechatgame.mjs              # 原生 canvas 路径：编译 → build/wechatgame/ + build/wechatgame-preview/
node apps/minigame/smoke-test.mjs                    # 跑种→收闭环 E2E 验证（13 项断言）
```

### 4.1 原生 canvas 路径产物（用户在微信开发者工具中导入这个）

```
build/wechatgame/
├── game.js              # bootstrap：polyfill localStorage + require game_bundle
├── game_bundle.js       # 业务代码（@farm/game + @farm/game-ui + src-wechatgame/，IIFE 转 CJS）
├── game.json            # { deviceOrientation: "portrait", ... }
└── project.config.json  # 微信开发者工具项目元数据
```

`build/wechatgame-preview/` + `preview/index.html` 是**浏览器预览**用同一份业务代码，方便开发期不打开微信开发者工具也能验证。

## 5. M1 验收标准

- [x] `apps/minigame/` 目录结构清晰（src/ Cocos 路径 + src-wechatgame/ 原生 canvas 路径）
- [x] tsc --noEmit 双套配置 0 错误（Cocos 路径 + wechatgame 路径）
- [x] web 端 build 回归通过（game 包注入式改造零回退）
- [x] esbuild 产物 `build/wechatgame/game_bundle.js` (15kb) 正常输出
- [x] `build/wechatgame/game.json` + `project.config.json` 生成
- [x] **原生 canvas 版浏览器 E2E：种 → 时间推进 → 收 闭环验证通过**（见 `apps/minigame/smoke-test.mjs`，13 项断言全绿）
- [x] **playwright 真点击验证**：点空地 → 扣金币 + 播种；点种子栏 → 切换 selected；点成熟作物 → 收获加金币
- [x] 存档持久化：刷新页面 → 重读 localStorage → state 完整恢复
- [x] 0 console error（favicon 404 忽略）/ 0 未捕获 promise rejection
- [ ] **微信开发者工具真机调试**：需要用户在本地导入 `apps/minigame/build/wechatgame/` 验证（本地编译已完成，开发者工具导入即可）

## 6. M2/M3 待办

### M2 — 全功能 P1 复刻
- 触摸 clickGuard（≤8px 位移阈值，平移视角防误触）
- 商店 + 背包 UI
- 全 6 状态视觉：empty/sown/sprout/growing/mature/withered 各自独立 sprite
- 音效（cc.AudioSource + 微信 InnerAudioContext）
- cc.tween 替换手写逐帧逻辑（收割弹出、倒计时脉动）

### M3 — 1:1 P2 系统复刻
- `forecast.ts` 180 天日历 → 顶部 WeatherForecast HUD（cc.Node + cc.Label 拼装）
- `events.ts` 害虫 / 干旱 / 雨事件
- `decorations.ts` 摆件放置（风车 / 稻草人 / 木桶 / 木栅栏）
- `tutorial.ts` 教程引导
- `combo.ts` 连击系统
- 屏幕震动 cc.view 适配

### 美术替换路线（M2 中段开始）
- CC0 sprite 资源包：opengameart.org 搜 "low poly farm"，授权写入 `packages/assets/ASSETS.md`
- 自绘：按 Explore agent 给的 50 项清单逐张出
- AI 生成：批量 prompt 模板 → 后处理 sprite sheet

## 7. 风险与缓解（已被踩到 / 待踩）

| 风险 | 状态 | 缓解 |
|---|---|---|
| Cocos Creator 编辑器未装 | **未踩** | `npm run typecheck` + `build-wechat.mjs` 走 CLI 通路 |
| Cocos 与 npm workspaces 集成 | **已解决** | esbuild 中间层预编译到 `assets/scripts/` |
| `load/save` 硬编码 localStorage | **已解决** | 4 行注入式改造，签名向后兼容 |
| 时间累积误差 | 未踩 | Cocos update 拿 `Date.now()` 绝对时间，与 web useFrame 同模式 |
| 触摸 vs 鼠标 | 未踩 | M1 不做视角拖拽，TOUCH_END 天然抗滑；M2 再补 clickGuard |
| Cocos 主循环调度 | 未踩 | Cocos `@ccclass Main.update(dt)` 即 R3F `useFrame` 的同构位 |
| 文网文 / 软著 | 未启动 | 上线前再说，M1 只跑技术验证 |

## 8. 不在本次范围（重申）

- `apps/web/`、`apps/mobile/` 任何修改（M2 之前保持稳定）
- iOS 27 UIScene 补丁脚本（仅 mobile）
- `packages/assets/` 任何新增（M1 程序化优先）
- CI / `cc.ladishb.com` 部署（README 的部署链路仅 web）
- 文网文 / 软著 / 上架审核
