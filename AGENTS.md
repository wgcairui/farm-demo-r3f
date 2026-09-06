# AGENTS.md

「开心农场」3D 重制面试作品：RN + Three.js，一套游戏逻辑（`packages/game`）跑两个渲染壳（web / mobile）。当前进度见 README「进度」表，验收勾选见 `docs/PRD.md`。

**写码前先读 README 的两段踩坑实录**（expo-gl × three、Phase 1 R3F），大量结论已验证过，别重新踩。

## 结构

- `packages/game/` — 游戏数值与状态机，纯 TS 源码包（`main` 直接指 `src/index.ts`，无构建产物）
- `packages/assets/` — CC0 glTF 模型 + 授权记录（ASSETS.md）
- `apps/web/` — Vite + React 19 + R3F（Phase 1 已完成 D1~D5），另挂 Capacitor 8 壳
- `apps/mobile/` — Expo SDK 57 + RN 0.86 + expo-gl（Phase 2 移植目标，当前仅 hello-cube 骨架）
- `scripts/patch-ios27-scene.sh` — iOS 27 UIScene 补丁

## 常用命令

```bash
npm install                    # 根目录执行，workspaces 一次装完
npm run dev -w @farm/web       # web 版 http://localhost:5173
npm run build -w @farm/web     # tsc --noEmit + vite build
npm run start -w @farm/mobile  # Metro（dev build，不走 Expo Go）
bash scripts/patch-ios27-scene.sh   # 仅 apps/mobile：每次 expo prebuild 后必跑
```

## 硬性红线

1. **`packages/game` 零 diff 红线**：该包从 2D 基线逐字节抽出，是「逻辑未被 3D 改动污染」的证据。未经用户明确要求不许改任何一行，包括已知毛病（`!plot.plantedAt` 会把 epoch-0 误判为空地块）——那要等服务端供时版一起改。
2. **单副本不变量**：react / react-native / expo 在根 `package.json` 与 `apps/mobile` 必须同版本、同步改；three 与 @react-three/fiber 双端必须同版本（npm hoist 到根单副本）。任何依赖升级别只动一端，否则出现双副本 / ERESOLVE。
3. **不给 `packages/game` 加构建步骤**：双端直接消费 TS 源码，tsconfig 产物、bundler 配置都不要加。
4. **iOS 27 UIScene 补丁**：`expo prebuild` 会覆盖 Info.plist/AppDelegate，之后必须重跑 `scripts/patch-ios27-scene.sh`，否则 dev build 启动即崩。
5. **TypeScript 双端版本不同是刻意的**：web ^7.0.2 / mobile ~6.0.3（跟随 Expo 模板），别「顺手统一」。

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

- `packages/game` 的 load/save 直连 localStorage：移植时把存储后端做成参数注入（web=localStorage，RN=AsyncStorage 封装），别在 RN 里伪造 localStorage 全局。
- `FarmScene.tsx` 的 hover 光标直连 `document.body.style.cursor`：RN 无 document，手势层用 gesture-handler 重写，勿照搬。
- RN 渲染循环用背压模式：每帧 `gl.getError()` 屏障 + 自调度 `setTimeout` 链，不用 rAF（原因见 README「渲染循环层」）。
- 低模卡通风：加载时统一 `metalness=0`（注意多 primitive GLB 的材质是数组，要展开处理），Canvas 用 `flat` 关 tone mapping。
