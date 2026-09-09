# AGENTS.md

「开心农场」3D 重制面试作品：RN + Three.js，一套游戏逻辑（`packages/game`）跑两个渲染壳（web / mobile）。当前进度见 README「进度」表，验收勾选见 `docs/PRD.md`。

**写码前先读 README 的两段踩坑实录**（expo-gl × three、Phase 1 R3F），大量结论已验证过，别重新踩。

## 结构

- `packages/game/` — 游戏数值与状态机，纯 TS 源码包（`main` 直接指 `src/index.ts`，无构建产物）
- `packages/game-ui/` — 跨端渲染无关辅助 + 视图组件（motion/landState/events/time/forecast/decorations/tutorial/combo）+ RendererAdapter 接口（Cocos/Skia 各实现一次）。M1.5 阶段只含 motion + landState，M2 扩展。
- `packages/assets/` — CC0 glTF 模型 + sprite sheet（CC0 + AI 生成）+ 授权记录（ASSETS.md）
- `apps/web/` — Vite + React 19 + R3F（Phase 1 已完成 D1~D5），另挂 Capacitor 8 壳（**仅 web 3D 演示**）
- `apps/mobile/` — Expo SDK 57 + RN 0.86 + expo-gl（**Phase C 重置为 2D portrait，路线与小游戏一致**）
- `apps/minigame/` — Cocos Creator 3.8.x + 2D 微信小游戏（M1 单场景原型本地编译通过，待编辑器组场景 + 微信开发者工具真机调试；设计见 `docs/MINIGAME.md`，路线见 `docs/ROADMAP.md`）
- ~~`apps/web2d/`~~ — **2026-09-09 废弃删除**（QQ 农场 portrait 跟它 16:9 等距投影不符）
- `scripts/patch-ios27-scene.sh` — iOS 27 UIScene 补丁

## 常用命令

```bash
npm install                    # 根目录执行，workspaces 一次装完
npm run dev -w @farm/web       # web 版 http://localhost:5173
npm run build -w @farm/web     # tsc --noEmit + vite build
cd packages/game-ui && npx tsc --noEmit                # game-ui 包 tsc 校验
cd apps/minigame && npx tsc --noEmit                   # 小游戏 tsc 校验
cd apps/minigame && node ./build-wechat.mjs            # esbuild 预编译 game + game-ui + minigame → assets/scripts/
cd apps/minigame && npm run open                       # 提示在 Cocos Creator Dashboard 里打开
bash scripts/patch-ios27-scene.sh   # 仅 apps/mobile：每次 expo prebuild 后必跑（Phase C 启动后会用到）
```

## 硬性红线

1. **`packages/game` 零 diff 红线**：该包从 2D 基线逐字节抽出，是「逻辑未被 3D 改动污染」的证据。**已知例外清单**（仅以下可动）：
 - M1.5 阶段（2026-09-09）已破：`load/save` 签名加可选 `backend` 参数（向后兼容，web 端不传参走默认 localStorage 零回归）+ 新增 `StorageBackend` 接口 export。
 - M2 阶段（计划中）将破：扩展 `SaveData` 到 v3（新增 `gems` / `level` / `exp` / `inventory` / `quests` 字段）+ 新增 `Inventory` / `Quests` / `PlayerStats` 模块 + 扩 `CROPS` 到 24 项 + `migrateV2toV3()`。**M2 之后** game 包必须零改动直到 M5 结束。
 - 其他改动包括已知毛病（`!plot.plantedAt` 会把 epoch-0 误判为空地块）——未经用户明确要求不许改。
2. **`packages/game-ui` 跨端共享红线**：从 web 端搬迁过来的模块，语义**字节级不变**。新增模块必须做到"小游戏端 + App 端零改动复用"。M2 阶段扩 6 个模块（M1.5 已含 2 个）；M4 阶段加 RendererAdapter + 视图组件。
3. **单副本不变量**：react / react-native / expo 在根 `package.json` 与 `apps/mobile` 必须同版本、同步改；three 与 @react-three/fiber 双端必须同版本（npm hoist 到根单副本）。任何依赖升级别只动一端，否则出现双副本 / ERESOLVE。`apps/minigame` 是 Cocos Creator 自带 runtime，**不走 npm workspaces 单副本规则**，它的依赖通过 `build-wechat.mjs` 走 esbuild 预编译。
4. **不给 `packages/game` 和 `packages/game-ui` 加构建步骤**：web/mobile 直接消费 TS 源码；minigame 通过 `apps/minigame/build-wechat.mjs` 预编译为独立 ESM bundle 放进 `assets/scripts/_game.js` + `_game_ui.js`，包本身仍无构建产物。
5. **iOS 27 UIScene 补丁**：`expo prebuild` 会覆盖 Info.plist/AppDelegate，之后必须重跑 `scripts/patch-ios27-scene.sh`，否则 dev build 启动即崩。
6. **TypeScript 双端版本不同是刻意的**：web ^7.0.2 / mobile ~6.0.3 / minigame ^5.7.3（独立 tsc，各自跟模板走），别「顺手统一」。

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

## Phase 2D（**已废弃** 2026-09-09）

`apps/web2d/` 是 `apps/web` 的平行 2D 实现（QQ 农场风味，单 `<canvas>` + 2:1 等距投影），与 web/minigame/mobile 并列共享 `packages/game`。

**2026-09-09 用户决定废弃**：
- 期望画面是 QQ 农场 portrait（750×1334），而 web2d 是 16:9 等距投影，两者视角模型不一致
- 投入产出比不如走 `apps/minigame/`（Cocos 微信小游戏）+ RN App 路线
- 已删除 `apps/web2d/` + `vercel-2d.json` + `package.json` workspaces 引用

**保留这段作为历史脚注**：如果未来恢复 16:9 等距投影的 web 演示需求，可参照此节规则重新搭一套。

## 共享层抽取（M1.5 阶段，2026-09-09 完成）

`packages/game-ui` 是第三渲染壳（小游戏 + App）的共享层，规则：

1. **从 web 端搬迁的模块语义零变化**：motion / landState（已搬，M2 阶段再搬 events / time / forecast / decorations / tutorial / combo）。**注意路径前缀**（`./farm3d/events` 在 web2d 下要变成 `./state/events`）。
2. **依赖方向**：game-ui 只依赖 `@farm/game`；不允许 game-ui 依赖任何 `apps/*`。
3. **新增模块约束**：跨端复用率 ≥ 80%，否则拆出 game-ui（与 RendererAdapter 一起进 M4 阶段写）。
4. **提交信息格式**：`M{n} {动作}：中文描述`（与 D 系区分），如 `M1.5 phase：抽 packages/game-ui 包 + 合并 2 镜像`。
