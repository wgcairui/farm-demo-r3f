# PRD：3D 农场 Demo 重制版（RN + Three.js）

- 版本：v1.0
- 日期：2026-09-05
- 交付deadline：2026-10-05（含 buffer）
- 作者：cairui

---

## 1. 背景与目标

### 1.1 背景

现有 farm-demo 是 Vite + React 19 + Capacitor 的 2D 农场（emoji + CSS grid，游戏逻辑集中在 `game.ts`，与渲染层零耦合）。目标岗位（智慧农业 App「小满农场」）的核心技术栈是 **React Native + Three.js**，且明确表示缺少"游戏化的建模交互设计"人才，更看重"前端设计 + 产品交互"。

本项目将 farm-demo 重制为 3D 版本，**最终形态跑在 RN 上**，作为面试作品同时补齐两个证据：3D 游戏化交互能力 + RN 客户端独立交付能力。

### 1.2 目标

1. 一个月内交付可在 **iOS 真机**上流畅运行的 RN + Three.js 3D 农场 demo。
2. 完整跑通核心循环：**选种子 → 播种 → 生长 → 收获 → 金币结算**，且有明确的"游戏手感"（动画、粒子、音效反馈）。
3. 产出完整工程痕迹：架构决策、expo-gl 踩坑记录、演示视频——可直接作为面试谈话材料。

### 1.3 非目标（明确不做）

| 不做 | 理由 |
|---|---|
| App Store / 安卓市场上架 | 日历时间不可控（备案/审核），与面试目标无关；TestFlight 内测分发见 P1 |
| 后端服务、登录注册 | demo 定位单机；接后端作为面试话术讲解（`game.ts` 的时间戳+懒计算已同构服务端方案），不实现 |
| 支付、配送、直播/IoT | 同上，超出作品集范围 |
| 自建 3D 建模 | 使用 CC0 低模资产，时间花在交互手感而非美术 |

---

## 2. 用户与使用场景

- **用户**：面试官（技术合伙人/CEO）。
- **场景**：面试现场真机试玩 1~3 分钟；或观看演示视频。
- **体验目标**：30 秒内理解玩法，3 分钟内感受到"种植→收获"循环的爽感（点播即时反馈、成熟可见的期待感、收获的爆发反馈）。

---

## 3. 功能需求

优先级定义：P0 = 没有就不算完成；P1 = 应该有，砍它要先说明；P2 = 锦上添花，时间不够第一批砍。

### 3.1 P0 — 核心循环 + 3D 场景

| # | 需求 | 说明 |
|---|---|---|
| P0-1 | 3D 农场场景 | 6 块耕地（沿用 `PLOT_COUNT=6`），低模风格，地面/围栏/环境装饰，1 个方向光 + 环境光 + 阴影 |
| P0-2 | 相机基础控制 | 默认固定机位俯视 30~45°；支持单指拖拽环绕、双指捏合缩放，有角度/距离边界 clamp |
| P0-3 | 点击地块 raycast | 点地块 = Web 端与 RN 端行为一致（选中/播种/收获） |
| P0-4 | 核心循环 | 选种子 → 空地播种扣币 → 三阶段生长（sprout/growing/mature，时间戳驱动，复用 `stageOf/progressOf`）→ 成熟收获加币 → 地块清空 |
| P0-5 | 生长视觉插值 | 三阶段间用 scale + 颜色/材质渐变过渡，不做跳变 |
| P0-6 | 交互反馈（juice 基础版） | 播种：下压回弹 + 尘土小粒子；收获：作物弹出 + 金币粒子 + 浮动 `+25` 金字 + 音效 |
| P0-7 | 2D UI 层（RN 原生 overlay） | 顶部金币计数、底部种子栏（价格/可负担态/选中态）、重置按钮。全部为 RN 视图盖在 Canvas 上，**不做 3D 内 UI** |
| P0-8 | 本地存档 | AsyncStorage（RN）/ localStorage（Web），schema 校验复用现有 `isSaveData` 逻辑；时钟回拨 clamp 保留 |
| P0-9 | 作物 ×2 | 胡萝卜、玉米（沿用现有数值 10/25、20/55），各 3 阶段模型 |
| P0-10 | iOS 真机运行 | 开发版 build 装入本人 iPhone，可完整试玩 |
| P0-11 | 土地状态机完整生命周期 | `PlotState` 6 态（empty/sown/sprout/growing/mature/withered）；withered 限 8s 自动恢复 empty；状态字段为主事实源；事件偏移/时间计算链路不变；详见 PROGRESS.md D7 |

### 3.2 P1 — 手感升级与双端

| # | 需求 | 说明 |
|---|---|---|
| P1-1 | TestFlight 内测分发 | 面试官可自行安装（需 Apple Developer 账号，走一次内测提审） |
| P1-2 | Android APK | 可分发安装包，至少一台安卓真机验证 |
| P1-3 | 相机动效 | 收获时镜头轻微推近 + 回位（缓动）；进场时开场运镜 |
| P1-4 | 空地呼吸提示 | 可播种的空地块有轻微脉动/微光，引导点击 |
| P1-5 | 音效设置 | 静音开关，音量记忆 |
| P1-6 | 昼夜氛围 | 天空渐变 + 光照色温随真实时间或游戏时间轻微变化（低成本高氛围） |
| P1-7 | 性能达标 | 见 §6.2 性能验收 |

### 3.3 P2 — 有余力再做

| # | 需求 |
|---|---|
| P2-1 | 新手引导：首次进入 3 步指引（选种→播种→收获） |
| P2-2 | 第三种作物或第二块农田区域 |
| P2-3 | 装饰系统：花 30 秒装饰自己的田（摆件，纯视觉） |
| P2-4 | 收获连击 combo 提示 |

---

## 4. 技术方案

### 4.1 仓库结构（Phase 0 改造为 workspaces）

```
farm-demo/
├── package.json          # workspaces: packages/game, apps/web, apps/mobile
├── packages/game/        # game.ts + 数值定义（现有代码平移，零逻辑改动）
├── apps/web/             # 现有 Vite app → Phase 1 改造为 R3F 3D 版
└── apps/mobile/          # Phase 2 新建 Expo app（RN + expo-gl）
```

- `packages/game` 是唯一逻辑源，web/mobile 共同依赖——体现"逻辑与渲染解耦、服务端同构"的架构能力（面试谈话点）。
- 工具用 npm/bun workspaces，**不引入 Turborepo**（demo 规模不需要，保持轻）。

### 4.2 技术栈

| 层 | Web 原型（Phase 1） | RN 版（Phase 2） |
|---|---|---|
| 渲染 | @react-three/fiber（web） | @react-three/fiber/native + expo-gl |
| 场景库 | three（版本 Phase 0 锁定，web/mobile 必须一致） | 同左 |
| 手势 | DOM 事件 / drei OrbitControls | react-native-gesture-handler（自写 orbit + pinch，不用 drei OrbitControls） |
| UI overlay | React DOM | RN Views（absolute 盖在 Canvas 上） |
| 状态 | 沿用 React state（规模小不引 zustand） | 同左 |
| 存档 | localStorage | AsyncStorage（`load/save` 两个函数做平台适配） |
| 音效 | HTMLAudioElement | expo-audio |
| 资产 | CC0 glTF（Kenney/Quaternius farm pack），useGLTF | 同一套 glTF，expo-asset/expo-three 加载 |

### 4.3 两步走策略（核心决策）

**先 Web 定稿，再 RN 移植。** 理由：

1. three.js 场景代码（相机、光照、地块、作物、动画插值）平台无关，可平移约 90%；
2. 平台差异只集中在"壳"上：Canvas 绑定、手势、UI 层、资产加载、存储、音频；
3. Web 端调试迭代速度快一个数量级，"手感"这个最难调的东西先在便宜的环境调好，避免在 expo-gl 里同时排查"代码问题还是平台问题"。

### 4.4 已知技术风险与对策

| 风险 | 对策 |
|---|---|
| expo-gl 的 WebGL2 实现不完整，个别材质/纹理格式翻车 | Web 版始终是保底可演示物；RN 端遇坑降级材质（MeshLambert/MeshStandard 基础用法），踩坑全部记录进 README |
| drei 组件部分 web-only（OrbitControls、HTML 等） | 相机控制自写（gesture-handler），UI 一律 RN overlay，不依赖 drei 环境组件 |
| 浮动金币文字定位 | 方案 A：3D 坐标 `project(camera)` 投影 → RN absolute Text；方案 B（降级）：troika-three-text 做 3D 内文字 |
| RN 新架构 / fiber native reconciler 版本匹配 | Phase 0 锁定 Expo SDK + fiber + three 组合，以官方兼容表为准，锁定后不升级 |
| 性能不达标 | 预算前置：场景 < 50k tris、单张贴图图集、阴影贴图 1024、粒子用 instancing；不达标逐项降级（先砍阴影质量→再砍粒子数） |

---

## 5. 拆分计划与工作步骤

日历：2026-09-06 启动，2026-09-30 主体完成，10-01~10-05 buffer。

### Phase 0：准备与骨架（0.5 天，9/6）✅ 完成（2026-09-06 复验通过 + 源码审计清零）

工作步骤：
1. 收集并选定 CC0 低模资产包（Kenney Farm / Quaternius），确认含：耕地、胡萝卜/玉米各 3 生长阶段（或可缩放的成熟模型 + 通用幼苗）、围栏地面装饰；记录资产来源与授权。
2. 仓库改造：现有代码移入 `apps/web/`，`game.ts` 抽到 `packages/game/`，workspaces 配置跑通 `npm run dev`。
3. 锁定版本组合：Expo SDK、@react-three/fiber、three、react-native-gesture-handler，写入根 README 版本表。
4. 新建 `apps/mobile/` Expo 空壳，跑通 expo-gl 的 hello triangle（提前暴露环境问题）。

验收标准：
- [x] `npm run dev`（web）与 `expo start`（mobile）双端均可启动（2026-09-06 双端重启实测，Metro Bundled 716 modules）
- [x] mobile 端 expo-gl 渲染出一个三角/立方体（证明 GL 上下文可用）（模拟器截图：Lambert 立方体 ~20fps 半分辨率档）
- [x] game 包被双端 import 成功（控制台打印一次 `stageOf` 单测结果即可）（web=vite transform 实链路；mobile=`[smoke]` 日志）
- [x] 版本锁定表提交进 README（2026-09-06 逐行核对 node_modules，复验时补装 gesture-handler@2.32.0）

### Phase 1：Web 原型——手感定稿（9/7 ~ 9/12，6 天）→ D1~D12 已完成（2026-09-07，Web 版线上验证通过）

> 当前执行范围：Phase 1 Web 版已完成并作为面试演示交付物；Phase 2 RN 移植按用户决定暂缓。

工作步骤：
1. **D1 场景静态搭建**：地块、地面、光照、阴影、天空色，固定机位；低模资产入场景。
2. **D2 核心循环接通**：`packages/game` 驱动 6 块地的播种/生长/收获；raycast 点击；种子栏 UI；金币显示；存档。
3. **D3 生长插值与相机**：三阶段 scale/颜色过渡；OrbitControls 环绕 + 缩放 + 边界 clamp。
4. **D4 juice 基础版**：播种压弹、收获弹出、金币粒子（instanced）、浮动金币文字、音效（播种/收获/金币三枚）。
5. **D5 打磨手感**：所有动画统一 easing 曲线与时长规范（如 150ms/300ms/600ms 三档）；空地提示；整体节奏调顺。
6. **D6 冻结**：（已拆为 D6→D9：原 D6 第一轮反馈已完成，第二轮试玩顺延到 D9；中间插入 D7 状态机扩展 + D8 田园背景装饰）录屏对比，自己试玩 10 分钟找别扭点修完；**此后场景与手感设计冻结，Phase 2 只做移植不再改设计**。（反馈第一轮已扩入进度条/差异化/事件系统，冻结顺延至第二轮试玩确认）

7. **D7 土地状态机扩展**：packages/game 重构（破零 diff 红线）+ 平台层适配 + 6 状态生命周期 + withered 限时自动恢复。

8. **D8 田园背景装饰**：新建 farm3d/deco/（狗/路/茅草屋/鱼塘）+ 2 个 CC0 GLB（dog/cottage）。

9. **D9 冻结**：原 D6 第二轮试玩确认顺延至此；D7/D8 完成后做最终冻结，Phase 2 启动条件。

验收标准：
- [x] 完整循环可玩：选种→播种→（缩短时间参数）等待→收获→金币正确增减，全程无需刷新（双作物端到端：胡萝卜 10→25、玉米 20→55，账目全对）
- [x] 刷新页面存档恢复正确；改本地时钟回拨不导致阶段倒退（存档刷新恢复实测；回拨用 node 直载 game 包真源码验证：plantedAt 置于未来 → sprout / progress 0）
- [x] 每次点击交互有 ≤100ms 的视觉反馈（动画启动）（播种压弹/收获弹出由 useFrame 帧级驱动，点击即启动，音效同点触发）
- [x] 收获时刻同时满足：作物动画 + 粒子 + 浮动文字 + 音效，无一遗漏（截图捕获粒子+浮字+弹出；音效与特效同一触发点，headless 无法听音但无 AudioContext 异常）
- [x] Chrome Performance 面板：持续交互场景下无 >50ms 长任务（web 参考线）（已完成 Web 版线上验证）
- [x] D7 验收：6 块地完整走 empty→withered→empty 全流程；v1 存档迁移成功；`tsc --noEmit` 通过
- [x] D8 验收：deco 组件不引 >50ms 长任务；GLB 走 normalized 管线
- [x] tsc --noEmit 通过；`packages/game` 相对原版 diff 为零（仅移动位置）（`git show 60b350f:src/game.ts` 逐字节一致）

### Phase 2：RN 移植（暂缓）

> 按用户决定暂缓 RN 移植；以下步骤与验收项保留为未来恢复 Phase 2 时的执行清单。

工作步骤：
1. **D1 壳搭建**：Expo dev build 装真机；Canvas（fiber native）+ 场景代码平移，先跑通静态场景渲染。
2. **D2 资产管线**：glTF 经 expo-asset 加载（useGLTF 适配），验证材质在 expo-gl 下的表现，翻车材质当场记录并降级。
3. **D3 手势重写**：gesture-handler 实现单指 orbit + 双指 pinch（带边界 clamp、惯性可选）；raycast 点击（区分拖拽 vs 点击的位移阈值）。
4. **D4 UI overlay**：种子栏、金币、重置按钮用 RN 视图实现，安全区适配（刘海/home indicator）。
5. **D5 存档与音频**：AsyncStorage 适配层；expo-audio 三枚音效；浮动文字投影定位实现（失败则走 troika 降级）。
6. **D6 性能第一轮**：真机 Perf Monitor 采数；按 §6.2 预算调优（合批、阴影降级、粒子 instancing）。
7. **D7-D8 兼容性扫雷**：把 Phase 1 全部交互在真机过一遍，expo-gl 差异逐条记录进 README 踩坑清单。

验收标准：
- [ ] iOS 真机完整可玩，功能与 Web 版对齐（对照 Phase 1 验收清单逐项过）
- [ ] 手势可用性：orbit/pinch 不与点击冲突（拖拽 8px 内判定为点击）；边界 clamp 生效，相机不会钻地/翻转
- [ ] 冷启动（点图标→可交互）≤ 3s（iPhone 真机秒表）
- [ ] 性能达 §6.2 指标
- [ ] 踩坑清单 ≥ 5 条实质内容（这是面试弹药，不是凑数）
- [ ] Android 若进度允许则装一 台真机冒烟（否则顺延到 Phase 3）

### Phase 3：打磨与双端（9/21 ~ 9/27，7 天）

工作步骤：
1. P1 项逐个落地：镜头动效 → 空地呼吸提示 → 昼夜氛围 → 音效开关（按此顺序，做多少算多少）。
2. Android 真机适配（手势差异、厂商 WebView/GL 差异、APK 出包）。
3. TestFlight 上传与内测提审（与开发并行，等审核不吃工作时间）。
4. 异常兜底：存档损坏走全新档（复用现有校验逻辑）；后台切前台时间跳变处理（生长照常推进，正在播放的动画重置）。
5. 真机长时间试玩（≥20 分钟），修完所有"感觉不对"清单。

验收标准：
- [ ] P1 至少完成 4/7（TestFlight、Android、镜头动效、空地提示为必保）
- [ ] TestFlight 状态进入"等待审核/可内测"
- [ ] Android 真机完整跑通核心循环
- [ ] 20 分钟试玩零崩溃、零卡死；杀进程重开存档完好
- [ ] 后台 1 小时后回前台：生长状态与服务端同构的时间计算一致（成熟即成熟）

### Phase 4：验收与交付物（9/28 ~ 9/30，3 天）

工作步骤：
1. 按 §6 验收清单全量过一遍，问题分级（阻断/瑕疵），阻断清零。
2. 录制演示视频 60~90s：真机横竖屏各一段 + Web 端一段，含完整循环 + 特写 juice。
3. README 定稿：架构图（workspaces + 两步走决策）、技术选型理由、expo-gl 踩坑记录、"如何接后端"的一节（时间戳方案如何服务端化）。
4. 面试话术文档（私有，不入库）：3 分钟讲述线 + 5 个预设追问的答案。

验收标准：
- [ ] §6 全部勾完
- [ ] 演示视频成片（两版）
- [ ] README 完整可读，陌生人 10 分钟能跑起来项目
- [ ] 交付 tag：`v1.0-demo`

---

## 6. 整体验收标准（DoD）

### 6.1 功能（全部 P0 + ≥4 个 P1）

- [ ] 核心循环 6 块地全流程可玩，数值与 `CROPS` 定义一致（播种扣 10/20，收获加 25/55）
- [ ] 存档跨启动恢复；损坏存档不白屏（走全新档）
- [ ] 时钟回拨不倒退；离线放置后回来生长状态正确（懒计算生效）
- [ ] 双指/单指手势与点击互不干扰

### 6.2 性能（iPhone 真机，Dev Menu Perf Monitor；最重载场景 = 6 块全成熟 + 收获粒子 + 相机运动同时发生）

- [ ] 帧率 ≥ 30fps 稳定，目标 60fps（中端机型下限 30，波动 < 5fps）
- [ ] JS 线程无持续 >16ms 帧（交互瞬间允许偶发）
- [ ] 内存 < 300MB
- [ ] 冷启动 ≤ 3s

### 6.3 工程质量

- [ ] `tsc --noEmit` 全仓通过
- [ ] `packages/game` 零逻辑改动（这是架构声明，必须守住）
- [ ] 无 console.log 残留；资产全部有来源与授权记录（CC0）
- [ ] README 含：结构图、版本锁定表、选型理由、踩坑清单、后端化路线

### 6.4 交付物清单

| 交付物 | 形式 |
|---|---|
| 可玩 demo | iOS 真机（现场）+ TestFlight 链接 + Android APK + Web URL（保底） |
| 演示视频 | 60~90s，真机为主 |
| README | 架构 + 决策 + 踩坑 + 后端化路线 |
| 面试话术 | 私有文档，不入库 |

---

## 7. 风险与砍单顺序

| 风险 | 概率 | 应对 |
|---|---|---|
| expo-gl 兼容坑超预期 | 中 | Web 版保底可演示；降级材质；必要时 UI overlay 承担更多表现（粒子改 RN 端 Lottie 替代是最后手段） |
| RN 客户端经验不足导致 D1-D5 拖期 | 中 | Phase 2 每天有明确可验收物；卡壳超半天就降级该条实现（先能用再好看） |
| 性能不达标 | 低 | §4.4 预算前置 + 逐项降级顺序（阴影→粒子→装饰物面数） |
| 时间超支 | 中 | 砍单顺序：P2 全砍 → P1-6 昼夜 → P1-3 镜头动效 → P1-2 Android（保 iOS + TestFlight 底线）；**任何情况不砍 Phase 1 D6 的设计冻结和 §6.3 的架构声明** |
| TestFlight 审核拖延 | 中 | 不阻塞主线：现场演示用真机 dev build，TestFlight 只是加分项 |

---

## 8. 与目标岗位的对位说明（自用，README 不放）

| 交付物/设计 | 对位 |
|---|---|
| RN + expo-gl 移植本身 | "精通 RN 能独立双端打包"的实证 + expo-gl 经验正好是对方栈 |
| juice 打磨（Phase 1 D4-D5 单独占 2 天） | 对方聊天原话"更看重前端设计以及产品交互" |
| `packages/game` 解耦 + 后端化路线章节 | JD 第 3 条"把核心链路工程化" |
| 两步走策略、砍单顺序、性能预算 | "能主动提技术方案、顶住早期不确定性"的现场素材 |
