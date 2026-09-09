# ROADMAP：开心农场 2D 路线图（小游戏先行 → App 后续）

> 日期：2026-09-09
> 目标：从 M1（已完成的纯技术骨架）演进到 M5（iOS + Android App 上架），全程共享 game 包 + game-ui 包 + sprite sheet 资产
> 适用范围：取代 PRD.md v1.0 的 §3.2（P1）+ §3.3（P2）部分关于渲染壳的拆解

---

## 0. 战略目标与技术栈锁定

### 0.1 产品定位

「QQ 农场风格 2D 卡通」开心农场。

- **视觉**：750×1334 portrait（手机竖屏），低多边形卡通
- **范围**：单人种田 + 仓库 + 商店 + 任务 + 摆件 + 装扮 + 好友留言
- **交付节奏**：微信小游戏先发布验证 → RN App 双端上架（iOS / Android）

### 0.2 技术栈（一次性锁定，后续不"顺手升级"）

| 层 | 微信小游戏 | App（RN）| 共享 |
|---|---|---|---|
| 引擎 | Cocos Creator 3.8.x + 2D | RN 0.86 + react-native-skia + reanimated | — |
| 语言 | TypeScript | TypeScript | TS |
| 渲染后端 | `cc.Graphics` / `cc.Label` / `cc.Sprite` | Skia `<Rect/>` / `<Text/>` / `<Image/>` | **RendererAdapter 抽象** |
| 动画 | `cc.tween` | Reanimated `useSharedValue + withTiming` | **统一曲线通过** `motion.ts` |
| 存储 | `wx.getStorageSync/SetStorageSync` | `AsyncStorage` | **StorageBackend 注入式**（已实现）|
| 资源 | sprite sheet (plist + png) | 同 sprite sheet（Skia 直接读 plist）| **`packages/assets/sprites/`** |
| 逻辑 | `@farm/game` v3 | 同 | **零改动跨端** |
| 辅助逻辑 | `@farm/game-ui` | 同 | **零改动跨端**（除 input 层）|
| 视图组件 | 在 `game-ui` 内统一用 Adapter API | 同 | **80% 跨端复用** |

### 0.3 不引的依赖

| 不引 | 理由 |
|---|---|
| Laya / Egret / Phaser / PixiJS | 单目标平台，未来 App 阶段还要换引擎，多一份重写 |
| react-native-game-engine | 不活跃，API 风格怪异 |
| Three.js + expo-gl（2D 场景） | 杀鸡用牛刀，且 expo-gl RN 黑屏踩坑（README 写过） |
| 自建跨端抽象（基于 React Native for Web） | 工作量过大、不确定性高 |
| Turborepo / nx | demo 体量不需要，保持 npm workspaces |

### 0.4 与现有架构的关系

**packages/game 现状**（已扩展一次，加了 `load/save` 的 `StorageBackend` 注入）

**apps/minigame 现状**：M1 已交付，本地编译通过，待编辑器组场景 + 微信开发者工具跑通

**apps/web 现状**：保留 3D web 演示（Phase 1 D1~D12），不废弃、不参与小游戏路线

**apps/web2d**：**废弃**（2026-09-09 决定；QQ 农场 portrait 跟它 16:9 等距投影不符）

**apps/mobile**：Phase C 启动，2D portrait 路线，**复用 minigame 视图层代码**

---

## 1. 里程碑全景图

```
M1 ✅       M1.5          M2              M3              M4                M5
─技术骨架─  ─共享层重构─  ─期望画面复刻─  ─装饰 + 完整业务─  ─App 工程启动─  ─商店上架─
 (9/8)      (9/9~9/12)    (9/13~9/22)     (9/23~10/8)      (10/9~10/20)     (10/21~11/5)
                                                                          │
                                                                          ▼
                                                                       iOS App Store +
                                                                       Android 国内商店
                                                                       (微信服务通知已废弃，
                                                                        App push 接 FCM/APNs)
```

每个里程碑**有明确的入口条件 + 出口交付物 + 检查点**。任何一项不过关，下一阶段不启动。

---

## 2. 里程碑 M1（已完成）

> **目标**：Cocos Creator 工程骨架 + game 包注入式 + 单场景最小可玩

### 2.1 工作步骤

1. ✅ 装 Cocos Creator 3.8.8（zip 1.1GB + CoW 拷到 /Applications）
2. ✅ 改 `packages/game` 的 `load/save` 加可选 `StorageBackend` 参数（向后兼容 web 端）
3. ✅ 新建 `apps/minigame/` 骨架（Cocos 项目元数据 + tsconfig + settings）
4. ✅ 写 `apps/minigame/src/{storage, app, main, motion, layout, landState, types}.ts`
5. ✅ 写 3 个 UI 节点：`PlotView` / `PlotSeedBar` / `CoinHud`
6. ✅ esbuild 预编译 `assets/scripts/_game.js` (4.3kb) + `minigame.js` (10.9kb)
7. ✅ 写 `docs/MINIGAME.md`
8. ✅ 更新 README 进度表 + AGENTS.md 结构段

### 2.2 检查点（M1 出口）

| # | 检查项 | 状态 |
|---|---|---|
| C1 | tsc `--noEmit` 0 错误 | ✅ |
| C2 | web 端 `npm run build` 回归通过（game 包注入式改造零回退） | ✅ |
| C3 | esbuild 产物 `_game.js` 与 `minigame.js` 正常输出 | ✅ |
| C4 | Cocos Creator 编辑器能打开 `apps/minigame/` 项目 | ✅ |
| C5 | `apps/web2d/` 标记废弃（**待 M1.5 真正删除**）| ⏸ |
| C6 | 微信开发者工具真机调试跑通（需 GUI 操作，**本环境未跑**）| ⏸ |

### 2.3 M1 未完成项（移交 M1.5 / M2）

- ⚠️ Cocos 编辑器里没组场景（需要 GUI 操作）
- ⚠️ 微信开发者工具未导入项目
- ⚠️ 没真机/模拟器运行截图
- ⚠️ 业务代码只到"种→收"循环，没顶到期望画面的 UI

---

## 3. 里程碑 M1.5 — 共享层抽取

> **目标**：把 minigame/src/motion.ts 与 landState.ts 的两份镜像合并为单一来源

### 3.1 入口条件

- ✅ M1 通过（`apps/minigame/` 工程骨架已就位）

### 3.2 工作步骤

1. 创建 `packages/game-ui` 包（package.json / tsconfig.json / src/index.ts），走 workspaces
2. 迁移 `apps/web/src/farm3d/motion.ts` → `packages/game-ui/src/motion.ts`（字节级镜像，含注释）
3. 迁移 `apps/web/src/farm3d/landState.ts` → `packages/game-ui/src/landState.ts`（PLOT_STATE_TINT 字节级镜像 + 类型导出）
4. 修 `apps/web/src/farm3d/FarmScene.tsx`、`deco/Dog.tsx`、`deco/Pond.tsx` 的 import 路径
5. 修 `apps/minigame/src/nodes/PlotView.ts`、`nodes/PlotSeedBar.ts`、`landState.ts`、`motion.ts` 删除/改 import
6. tsc 三端校验：`packages/game` / `packages/game-ui` / `apps/web` / `apps/minigame`
7. web build + minigame esbuild 双路回归
9. 更新 README 进度表 + AGENTS.md 结构段（`packages/game-ui` 出现位置）

### 3.3 检查点（M1.5 出口）

| # | 检查项 | 通过条件 |
|---|---|---|
| C7 | `packages/game-ui/package.json` 存在 + `npm install` 不报错 | `node_modules/@farm/game-ui` 软链到位 |
| C8 | `packages/game-ui/src/index.ts` 导出 `motion` + `landState` | tsc 通过 |
| C9 | `apps/web/src/farm3d/` 不再包含 `motion.ts` / `landState.ts` | `grep -r "motion.ts\|landState.ts" apps/web/src/farm3d/` 零结果（**deco/motion.ts 除外**，3D 专用）|
| C10 | `apps/minigame/src/motion.ts` / `landState.ts` 已删除或仅做 re-export | 同上 |
| C11 | web `npm run build` 仍过，**视觉零变化**（motion 数值未变）| build OK + 浏览器手动 spot check |
| C12 | minigame `tsc --noEmit` 仍 0 错误 | tsc OK |
| C13 | minigame `node ./build-wechat.mjs` 仍产出 `_game.js` + `minigame.js` | esbuild OK |
| C14 | `packages/game` 仍零逻辑改动（M1.5 不动 game 包）| `git diff packages/game/src/` 仅 M1 那次注入式改动 |

### 3.4 不要做的事

- ❌ 顺手把 `events.ts` / `time.ts` / `forecast.ts` 也搬过来（M2 才搬，避免本步 scope creep）
- ❌ 改 motion 数值（用户说"先小游戏、再 App"，**数值冻结在 M1.5 之后**）
- ❌ 把 `deco/motion.ts`（DOG_WALK / FISH，3D 专用）也搬过来
- ❌ 改 web 端注释风格或拆文件

---

## 4. 里程碑 M2 — 期望画面复刻

> **目标**：在微信小游戏里复刻期望 QQ 农场风格的主屏画面（顶部 HUD + 中央地块 + 底部 Tab + 任务/仓库/商店弹窗）
>
> **范围**（基于用户提供的 5 张参考图）：
> - 顶部：头像 + 等级/经验 + 金币 + 钻石 + 分享/菜单/商城/音乐/任务入口
> - 中央：6 块地块网格（带"已开/未开"绿/棕区分）+ 周围装饰（池塘/木栅栏/树/狗屋/茅草屋）
> - 底部：仓库 / 商店 / 宠物 / 装扮 / 好友 5 个 Tab
> - 任务弹窗：成长任务 + 每日任务（4 列：金币/钻石/经验/小红花）
> - 仓库弹窗：果实 / 超变果实 / 种子 / 道具 tab + 20 格 容量
> - 商店弹窗：种子 / 宠物 / 装扮 tab + 24 个作物网格（解锁等级 + 价格梯度）

### 4.1 入口条件

- ✅ M1.5 通过（game-ui 包就位，2 镜像合并）
- ✅ Cocos Creator 编辑器已装 + 项目已组场景（M1 GUI 操作已完成）
- ✅ 微信开发者工具跑通（M1 GUI 操作已完成）
- ⏸ 第一份 sprite sheet（地块 + 6 作物 + UI 按钮）制作完成（CC0 找不到时 AI 生成）

### 4.2 工作步骤

#### Phase 1：共享层扩展（2 天）

1. 扩 `packages/game` 到 v3：
 - SaveData 加 `gems`、`level`、`exp`、`inventory`、`quests` 字段
 - 新增 `Inventory` 模块（容量 210 + 4 类 slot + 批量锁定 API）
 - 新增 `Quests` 模块（成长任务 / 每日任务 / 4 种奖励槽位）
 - 新增 `PlayerStats` 模块（等级曲线 + 经验值公式）
 - 扩 `CROPS` 到 24 项（白菜/萝卜/玉米/水稻/小麦/大蒜/.../红玫瑰，每项带 `unlockLevel`）
 - 新增 `migrateV2toV3()` 自动升级老存档
2. 抽 `apps/web/src/farm3d/events.ts` / `time.ts` / `forecast.ts` / `decorations.ts` / `tutorial.ts` / `combo.ts` → `packages/game-ui/src/`
3. 修 web 端 import 路径

#### Phase 2：RendererAdapter 抽象（1 天）

4. 在 `packages/game-ui/src/renderer/Adapter.ts` 定义接口：
 - `drawRect` / `drawText` / `drawImage` / `setParent` / `setPosition` / `setScale` / `setOpacity` / `onTap` / `onLongPress` / `tween`
5. 在 `packages/game-ui/src/renderer/cocos/` 写 Cocos 后端（~400 行，复用 `cc.Graphics` / `cc.Label` / `cc.Sprite` / `cc.tween`）
6. 在 `packages/game-ui/src/renderer/index.ts` 写工厂（根据 `process.env.RENDERER` 或显式参数选后端）

#### Phase 3：视图组件迁移（3 天）

7. 把 `apps/minigame/src/nodes/PlotView.ts` / `PlotSeedBar.ts` / `CoinHud.ts` 改写为调用 Adapter API（不再直接 `cc.Graphics`）
8. 新增 `HudTopBar`（头像 + 等级 + 经验条 + 金币/钻石 + 商城/分享/任务/菜单 入口）
9. 新增 `TabBarBottom`（仓库/商店/宠物/装扮/好友 5 个 Tab）
10. 新增 `QuestPanel`（成长任务 + 每日任务弹窗）
11. 新增 `WarehousePanel`（4 tab + 20 格 grid）
12. 新增 `ShopPanel`（3 tab + 24 作物网格 + 解锁等级遮罩）
13. 新增 `Decoration` / `Pond` / `Tree` / `Cottage` / `Doghouse` / `Dog` 程序化装饰组件

#### Phase 4：sprite 接入 + 美术（2 天）

14. 在 `packages/assets/sprites/` 建立 TexturePacker 标准结构（plist + png）
15. 第一份 sprite 包：地块（empty/sown/sprout/growing/mature/withered 6 状态）+ 6 个作物 + UI 按钮基础集
16. 写 `packages/game-ui/src/atlas/loader.ts` 读取 plist + 自动渲染

#### Phase 5：业务接入（2 天）

17. minigame 端 `AppController` 接入 `Inventory` / `Quests` / `PlayerStats`
18. 任务触发链路：播种 → "采摘 1 次" 进度 +1；收获 → "完成 8 次" 进度 +1
19. 商店购买链路：点种子 → 扣金币 → +1 到 inventory slots
20. 仓库展示链路：inventory 内容渲染到 20 格 grid

### 4.3 检查点（M2 出口）

| # | 检查项 | 通过条件 |
|---|---|---|
| C15 | `packages/game` 升级到 v3，v2 存档可自动迁移 | `migrateV2toV3({coins:50,...})` 返回 v3 数据 |
| C16 | `packages/game-ui` 含 9 个模块（motion / landState / events / time / forecast / decorations / tutorial / combo / renderer） | `index.ts` 完整导出 |
| C17 | RendererAdapter 单元测试通过（手写 5 个 fake driver 验证接口契约） | node test runner 跑通 |
| C18 | Cocos 后端所有 RendererAdapter 方法实现 | 调用 `Adapter.cocos()` 不抛 unsupported |
| C19 | 期望画面 5 张参考图全部覆盖：主屏 / 主屏+种下状态 / 任务面板 / 仓库弹窗 / 商店弹窗 | 微信开发者工具截图逐张对 |
| C20 | sprite sheet 第一份包（地块 + 6 作物 + UI 基础）制作完成 + 渲染正确 | 截图 spot check |
| C21 | 任务链路端到端：播种 → 任务进度 +1 → 完成 → 领奖 → 金币增加 | 微信开发者工具实测 |
| C22 | 商店购买链路端到端：点种子 → 扣金币 → +1 到 inventory | 微信开发者工具实测 |
| C23 | 仓库展示链路：inventory 内容渲染到 20 格 grid | 微信开发者工具实测 |
| C24 | tsc 三端校验 0 错误 | tsc OK |
| C25 | web build + minigame esbuild 双路回归 | build OK |
| C26 | **无 console.error / 无未捕获 promise rejection**（微信开发者工具 console）| console clean |

### 4.4 必砍清单（M2 超时按此顺序砍）

按超期天数砍：

1. 砍商城入口的"公益小红花"入口（视觉装饰，不影响循环）
2. 砍装扮系统 Tab（仅放占位 UI + 跳转"敬请期待"）
3. 砍好友 Tab（同上）
4. 砍每日任务的"剩余刷新时间"倒计时（用静态文字）
5. 砍宠物 Tab
6. 砍商店 24 个作物里 3 品及以上的（仅保留 2 品共 8 个）

**任何情况不砍**：核心循环（种/收/金币）、顶部 HUD、底部 5 Tab 入口、任务/仓库/商店 3 个主弹窗、仓库 4 tab 完整结构。

---

## 5. 里程碑 M3 — 装饰系统 + 完整业务

> **目标**：补齐期望画面所有边角 + 把 P2 系统（天气/害虫/装饰摆件/教程）落地

### 5.1 入口条件

- ✅ M2 通过（C19 期望画面 5 张参考图全部覆盖）

### 5.2 工作步骤

1. 180 天天气日历（`forecast.ts` 接入顶部 HUD）
2. 害虫事件（点击驱赶 → +2 金币 + 红环脉动）
3. 干旱事件（点击浇水 → 玉米解冻 + 蓝环脉动）
4. 雨事件（粒子 + 全场 ×2 速度）
5. 摆件放置系统（风车/稻草人/木桶/木栅栏，8×6 网格，参考期望画面狗屋旁的摆件位）
6. 装扮系统（装扮 Tab 实装）
7. 好友留言板（好友 Tab 实装）
8. 新手教程（首次进入 3 步指引）
9. combo 连击系统（连续收获 +1/+2/+3 金币倍率）
11. 音效（种植/收获/浇水/金币/害虫/雨，CC0 找不到 AI 生成）

### 5.3 检查点（M3 出口）

| # | 检查项 | 通过条件 |
|---|---|---|
| C27 | 6 种天气全部落地（晴/多云/阴/小雨/大雨/雷），日历 180 天推进 | 微信开发者工具实测 |
| C28 | 害虫事件可驱赶、奖励正确 | 同上 |
| C29 | 干旱事件可浇水、玉米解冻 | 同上 |
| C30 | 雨事件加成生效（速度 ×2）| 同上 |
| C31 | 摆件可放置/移除，状态持久化 | 同上 |
| C32 | 装扮系统可购买/穿戴 | 同上 |
| C33 | 好友系统可发送/查看留言 | 同上 |
| C34 | 新手教程首次进入强制引导，可关闭 | 同上 |
| C35 | combo 连击触发、UI 显示 | 同上 |
| C36 | 音效 9 种全部就位，可静音 | 同上 |
| C37 | sprite sheet 第 2 份包（装饰 + 天气 + UI 弹窗）| TexturePacker 产出 |
| C38 | 主存档 v2 → v3 → v4（如有） 自动迁移 | unit test |
| C39 | 持续运行 30 分钟零崩溃 | 微信开发者工具性能面板 |

---

## 6. 里程碑 M4 — App 工程启动

> **目标**：把 minigame 的渲染层迁移到 RN App，复用 RendererAdapter + 所有 game-ui 模块

### 6.1 入口条件

- ✅ M3 通过（C39 持续 30 分钟零崩溃）
- ✅ 已有 RN 0.86 + react-native-skia + reanimated 知识储备

### 6.2 工作步骤

1. 在 `apps/mobile/`（已存在 Expo 骨架）里加 react-native-skia + reanimated 依赖
2. 在 `packages/game-ui/src/renderer/skia/` 写 Skia 后端（~500 行）
 - `drawRect` → `<Rect/>` + `<Group/>`
 - `drawText` → `<Text/>`（Skia 内置）
 - `drawImage` → `<Image/>`（Skia sprite 模式 + plist 解析）
 - `onTap` → Reanimated `useAnimatedGestureHandler` + 触摸状态
 - `tween` → Reanimated `useSharedValue + withTiming`
3. 在 `apps/mobile/App.tsx` 接入 game-ui 的视图组件（**90% 直接复用 minigame 端代码**）
4. 配置 expo-skia 的 iOS / Android 编译
5. 适配安全区（刘海 / home indicator）
6. RN 端 Storage backend：`AsyncStorage` 封装成 `StorageBackend` 接口
7. iOS 真机跑通
8. Android 真机跑通

### 6.3 检查点（M4 出口）

| # | 检查项 | 通过条件 |
|---|---|---|
| C40 | `apps/mobile` 装到 iOS 真机可启动 | Expo dev build 跑通 |
| C41 | `apps/mobile` 装到 Android 真机可启动 | 同上 |
| C42 | 主屏画面与小游戏端**像素级一致** | 两端截图 diff ≤ 1% 像素差异 |
| C43 | 所有 9 个 game-ui 模块在 RN 端可调用 | unit test |
| C44 | 触摸事件 ≤ 100ms 反馈 | 真机秒表 |
| C45 | 性能达 PRD §6.2 标准 | 真机 Perf Monitor |
| C46 | 视图组件代码复用率 ≥ 80% | `grep -c "cc\." apps/minigame/src vs apps/mobile/src` |
| C47 | `packages/game` 零改动（M4 阶段不动 game 包）| `git diff packages/game/src/` |

### 6.4 不做的事

- ❌ App 端的 3D 视图（mobile/ 之前 Phase 0~2 是 3D，**M4 路线是 2D portrait 复用 minigame 视图**）
- ❌ 重新实现一套 game-ui 模块（完全复用）
- ❌ 在 mobile/ 写任何业务逻辑（只接 AppController + RendererAdapter）

---

## 7. 里程碑 M5 — 商店上架

> **目标**：iOS App Store + Android 国内商店上架

### 7.1 入口条件

- ✅ M4 通过（C42 像素级一致）
- ✅ Apple Developer 账号已注册（$99/年）
- ✅ 国内安卓市场账号（小米/华为/vivo/oppo/应用宝 等至少 3 家）

### 7.2 工作步骤

1. 完善 App 图标 + 启动屏 + 描述（5 国语言）
2. iOS App Store Connect 配置 + TestFlight 内测 + 正式上架（审核 1~3 天）
3. Android 各家市场逐一上传（审核 1~7 天不等）
4. 推送接 FCM（Android）+ APNs（iOS）
5. 后端最小化：登录 + 存档云同步（用 Supabase 或自建）

### 7.3 检查点（M5 出口）

| # | 检查项 | 通过条件 |
|---|---|---|
| C48 | TestFlight 内部测试可用 | App Store Connect 可下载 |
| C49 | iOS App Store 上架 | 商店搜索可下载 |
| C50 | Android 国内至少 3 家市场上架 | 同上 |
| C51 | push 通知可触达（FCM/APNs）| 真机测 |
| C52 | 存档云同步（断网 1 天后联网自动恢复）| 真机测 |

---

## 8. 跨阶段约束

### 8.1 永远不动 `packages/game` 的红线（仅 M2 阶段破一次）

- M2 升级到 v3 时：仅扩字段 + 加新模块 + 加 `migrateV2toV3`，**不重写已有 9 个纯函数**
- M4 / M5 阶段：`packages/game` **零改动**（仅可能补 `v3→v4` 迁移）
- 已知历史毛病（`!plot.plantedAt` epoch-0 误判）：**永远等用户明确说要改才改**

### 8.2 永远不动 sprite 命名

- `packages/assets/sprites/` 下的所有 sprite 一旦命名，小游戏和 App 两端**永远用同一名字**
- 命名规则：`{category}/{name}_{frame}.png`（如 `crops/craw_sprout.png`）

### 8.3 Adapter API 永远向后兼容

- RendererAdapter 接口新增方法时，必须在 Cocos 后端和 Skia 后端**同时实现**
- 已有的 11 个方法（drawRect / drawText / ...）**不删不改签名**

### 8.4 命名约定

- 包：`@farm/game` / `@farm/game-ui` / `@farm/minigame` / `@farm/web` / `@farm/mobile`
- 文件：渲染相关放 `apps/*/src/render/`，逻辑相关放 `packages/*/src/`
- 类：`AppController`（单例）、`XxxView`（视图节点）、`XxxPanel`（弹窗）

---

## 9. 风险与砍单顺序（汇总）

| 风险 | 概率 | 应对 |
|---|---|---|
| sprite 制作量大 + AI 生图风格不一致 | 高 | 第一份用 AI 出 6 作物 + 6 地块作 seed，后续手动 style match |
| Cocos Creator 编译/打包踩坑（与 Vite 完全不同生态） | 中 | M2 早期强制跑通一次 wechatgame build，避免 M3 才发现 |
| RN + Skia 在低端 Android 设备性能不达标 | 中 | M4 早期就 Android 跑一次，发现不行直接放弃 Android M5，保留 iOS |
| push 通知合规（个保法/隐私政策） | 中 | M5 上架前找法务过一遍 |
| App Store 审核被打回 | 中 | 提前 2 周提交；被打回按反馈快速修 |
| 时间超支 | 高 | 见 §4.4 必砍清单 + §6.4 不做事项 |

---

## 10. 进度追踪

各里程碑进度在看板 + `README.md`「进度」表里维护，格式：

```
| M1 技术骨架              | ✅ 2026-09-08 完成 | 本地编译通过 + 编辑器跑通 + 微信开发者工具导入 |
| M1.5 共享层抽取          | 🟡 2026-09-09 进行 | packages/game-ui 包已建；待迁移 motion + landState |
| M2 期望画面复刻          | ⬜ 2026-09-13 计划 | ... |
| M3 装饰系统 + 完整业务    | ⬜ 2026-09-23 计划 | ... |
| M4 App 工程启动           | ⬜ 2026-10-09 计划 | ... |
| M5 商店上架               | ⬜ 2026-10-21 计划 | ... |
```

每完成一项检查点（CI），在 `PROGRESS.md`（如存在）勾对应行。