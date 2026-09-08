# AGENTS.md

「开心农场」3D 重制面试作品：RN + Three.js，一套游戏逻辑（`packages/game`）跑两个渲染壳（web / mobile）。当前进度见 README「进度」表，验收勾选见 `docs/PRD.md`。

**写码前先读 README 的两段踩坑实录**（expo-gl × three、Phase 1 R3F），大量结论已验证过，别重新踩。

## 结构

- `packages/game/` — 游戏数值与状态机，纯 TS 源码包（`main` 直接指 `src/index.ts`，无构建产物）
- `packages/assets/` — CC0 glTF 模型 + 授权记录（ASSETS.md）
- `apps/web/` — Vite + React 19 + R3F（Phase 1 已完成 D1~D5），另挂 Capacitor 8 壳
- `apps/web2d/` — Vite + React 19 + Canvas2D 俯视等距（Phase 2D，QQ 农场风味；与 web 并列，build 234KB / gzip 74KB）
- `apps/mobile/` — Expo SDK 57 + RN 0.86 + expo-gl（Phase 2 移植目标，当前仅 hello-cube 骨架）
- `apps/minigame/` — Cocos Creator 3.8.x + 2D 微信小游戏（M1 单场景原型本地编译通过，待编辑器组场景 + 微信开发者工具真机调试；设计见 `docs/MINIGAME.md`）
- `scripts/patch-ios27-scene.sh` — iOS 27 UIScene 补丁

## 常用命令

```bash
npm install                    # 根目录执行，workspaces 一次装完
npm run dev -w @farm/web       # web 版 http://localhost:5173
npm run dev -w @farm/web2d     # 2D 版 http://localhost:5174
npm run build -w @farm/web     # tsc --noEmit + vite build
npm run build -w @farm/web2d   # 同上（2D 壳）
npm run start -w @farm/mobile  # Metro（dev build，不走 Expo Go）
cd apps/minigame && npx tsc --noEmit                   # 小游戏 tsc 校验
cd apps/minigame && node ./build-wechat.mjs            # esbuild 预编译 game + minigame → assets/scripts/
cd apps/minigame && npm run open                       # 提示在 Cocos Creator Dashboard 里打开
bash scripts/patch-ios27-scene.sh   # 仅 apps/mobile：每次 expo prebuild 后必跑
```

## 硬性红线

1. **`packages/game` 零 diff 红线**：该包从 2D 基线逐字节抽出，是「逻辑未被 3D 改动污染」的证据。**已知唯一例外**：`load/save` 签名加可选 `backend` 参数（向后兼容，web 端不传参走默认 localStorage 零回归）。其他改动包括已知毛病（`!plot.plantedAt` 会把 epoch-0 误判为空地块）——未经用户明确要求不许改。
2. **单副本不变量**：react / react-native / expo 在根 `package.json` 与 `apps/mobile` 必须同版本、同步改；three 与 @react-three/fiber 双端必须同版本（npm hoist 到根单副本）。任何依赖升级别只动一端，否则出现双副本 / ERESOLVE。`apps/minigame` 是 Cocos Creator 自带 runtime，**不走 npm workspaces 单副本规则**，它的依赖通过 `build-wechat.mjs` 走 esbuild 预编译。
3. **不给 `packages/game` 加构建步骤**：web/mobile 直接消费 TS 源码；minigame 通过 `apps/minigame/build-wechat.mjs` 预编译为独立 ESM bundle 放进 `assets/scripts/_game.js`，game 包本身仍无构建产物。
4. **iOS 27 UIScene 补丁**：`expo prebuild` 会覆盖 Info.plist/AppDelegate，之后必须重跑 `scripts/patch-ios27-scene.sh`，否则 dev build 启动即崩。
5. **TypeScript 双端版本不同是刻意的**：web ^7.0.2 / web2d ^7.0.2 / mobile ~6.0.3 / minigame ^5.7.3（独立 tsc，各自跟模板走），别「顺手统一」。

## 协作节奏

- review / 审计类任务只出报告，不动代码；等用户说「修」再动手。
- 「继续」= 对照 PRD 推进下一阶段任务；完成一项在 PRD.md 勾一项，README「进度」表同步更新。
- 提交信息参照 git log 风格：`phase N Dn：中文描述`、`review 修复 P0-x：...`、`docs：...`。

## 代码风格

- 中文注释，写「为什么」与踩坑结论，不复述代码在做什么。
- web 端逻辑按 `apps/web/src/farm3d/` 的职责模块放（gltf 资产管线 / motion 动画规范 / effects 特效 / sfx 音效 / clickGuard / layout / floaters / useFarm），别往 `FarmScene.tsx` 堆。
- 动画时长与 easing 一律走 `motion.ts` 的 `DUR` / `ease`，不写裸数字。
- 生长呈现不走 React 状态/心跳：`plantedAt` 时间戳是唯一事实源，帧级插值在 `useFrame` 里算（同构服务端的关键模式，移植时保持）。

## Phase 2 移植注意（到时再动手，先别改）

- `packages/game` 的 load/save ~~直连 localStorage~~：**✅ 已注入式改造**（web 不传参走默认，微信小游戏传 `createWxStorageBackend()`）；RN 移植时传 `AsyncStorage` 封装的 backend。
- `FarmScene.tsx` 的 hover 光标直连 `document.body.style.cursor`：RN 无 document，手势层用 gesture-handler 重写，勿照搬。
- RN 渲染循环用背压模式：每帧 `gl.getError()` 屏障 + 自调度 `setTimeout` 链，不用 rAF（原因见 README「渲染循环层」）。
- 低模卡通风：加载时统一 `metalness=0`（注意多 primitive GLB 的材质是数组，要展开处理），Canvas 用 `flat` 关 tone mapping。
- 微信小游戏端的 `@ccclass Main.update(dt)` 即 R3F `useFrame` 的同构位；触摸事件用 `Node.EventType.TOUCH_END`（自带抗滑），M2 再补 ≤8px 位移阈值的 clickGuard。

## Phase 2D（Canvas2D 俯视等距壳，apps/web2d/）

`apps/web2d/` 是 `apps/web` 的平行 2D 实现（QQ 农场风味，单 `<canvas>` + 2:1 等距投影），与 web/minigame/mobile 并列共享 `packages/game`。规则：

1. **`packages/game` 仍零 diff**——2D 壳只读，不改 game 包；`load/save` 走默认 backend（web 端已支持）。
2. **渲染无关模块复用**：`apps/web/src/farm3d/` 下的 events/time/sfx/combo/tutorial/decorations/clickGuard/motion/landState/pestCalendar 是渲染无关逻辑；web2d 直接 copy 到 `apps/web2d/src/state/`，**注意路径前缀**（`./farm3d/events` 在 web2d 下要变成 `./state/events`）。
3. **`useFarm.ts` 复制改写**：web 版的 useFarm.ts import 了 three 专属的 effects/cameraMotion/floaters；web2d 复制后 import 改指向本地 `render/particles` `render/floaters` `state/cameraMotion`。**不要跨 app import**——`apps/web2d` 不应该 import `apps/web/...` 的任何模块。
4. **主循环替换**：web 版用 R3F 的 `useFrame` 驱动，web2d 用 `state/tickLoop.ts` 的 `requestAnimationFrame` 驱动；二者皆「按帧推进状态机 + 事件 + 渲染」，时间源统一 `Date.now()`，与 game 包同语义。**rAF 后台休眠由 game 包 `witheredAt` 比较兜底**（web 版同模式）。
5. **HUD 样式共用**：web 版的 `App.css` + `BottomSheet.tsx` + `WeatherForecast.tsx` 直接复制到 web2d，零改动；canvas 用 `.scene2d-canvas` class 让 `.app canvas` 默认 background `var(--bg)` 不覆盖草地绿。
6. **不引入 2D 引擎**（Phaser/PixiJS/Kaboom 全不要），不引入 three/@react-three/fiber；不加载任何图片资产，所有美术程序化绘制（`render/sprites.ts`）。
7. **提交信息格式**：`phase 2D Dn：中文描述`，与 D 系对齐；进度表（README.md「进度」+ PROGRESS.md）必须同步加行。
8. **部署独立**：`apps/web2d/Dockerfile`（node:24-alpine builder → nginx:alpine runtime，与 web 版同结构）+ `vercel-2d.json`（Vercel 第二项目配置，`buildCommand` 指向 `apps/web2d`）。
