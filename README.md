# farm-demo

「开心农场」3D 重制：**RN + Three.js** 面试作品项目。游戏逻辑抽为共享包 `packages/game`（纯 TS，对 2D 基线零 diff——D7 主动破例重构，理由见 PROGRESS.md）。当前进度：**Phase 1 D6 进行中、D7/D8 计划已批准**（土地状态机 + 田园背景装饰）；详细 D 级轨迹见 [PROGRESS.md](PROGRESS.md)，验收勾选见 [docs/PRD.md](docs/PRD.md)。

详细计划见 [docs/PRD.md](docs/PRD.md)，资产清单与授权见 [packages/assets/ASSETS.md](packages/assets/ASSETS.md)。

## 结构

```
farm-demo/
├── apps/web/        # Web 3D 原型（Vite + React 19 + R3F）— Phase 1 D1~D5 完成 + D6 反馈轮
│   └── src/farm3d/  # gltf 资产管线 / motion 动画规范 / effects 特效 / sfx 合成音效
│                    # events 事件系统（雨/旱/虫/施肥，React 外单例） / clickGuard / layout / useFarm / FarmScene
├── apps/mobile/     # RN 版（Expo SDK 57 + expo-gl）— Phase 0 hello-cube 跑通（模拟器 ~20fps），Phase 2 移植目标
├── packages/game/   # 游戏数值与状态机（纯 TS，双端共享，服务端同构；对基线零 diff）
├── packages/assets/ # CC0 3D 模型（glTF，poly.pizza/Quaternius）+ 授权记录
├── scripts/         # patch-ios27-scene.sh（expo prebuild 后必跑）
└── docs/            # PRD（含验收清单勾选进度）
```

## 进度（2026-09-06；D7/D8 已批准待实施）

| 阶段 | 状态 | 说明 |
|---|---|---|
| Phase 0 准备与骨架 | ✅ 完成（当日复验 4/4 + 源码审计清零） | workspaces / game 包零 diff / expo-gl×three 跑通 / 版本表 / gesture-handler 锁定 |
| Phase 1 Web 原型 D1~D5 | ✅ 完成 | R3F 场景 + 核心循环 + 环绕相机 + 生长插值 + juice 四件套 + motion 动画规范（提交 61e0758 → 0cd6398） |
| Phase 1 D6 冻结 | ⏳ 进行中 | ✅试玩反馈第一轮已落地（见下）；待：第二轮试玩、录屏、Chrome Perf 长任务数据 |
| Phase 1 D7 状态机扩展 | ⏸ 已批准待实施 | 6 状态生命周期 + withered 限时自动恢复；破 game 包零 diff 红线（用户批准） |
| Phase 1 D8 田园背景装饰 | ⏸ 已批准待实施 | 狗/路/茅草屋/鱼塘 + 2 个新 CC0 GLB；`farm3d/deco/` 子目录 |
| Phase 2 RN 移植（9/13~） | ⬜ 未开始 | 渲染层 D1 冒烟后定：fiber native vs three 直写（倾向后者，背压循环已验证） |
| Phase 3 / Phase 4 | ⬜ 未开始 | 按 PRD |

### D6 试玩反馈第一轮（2026-09-06）

试玩反馈「没进度条 / 作物没差异 / 缺惊喜」→ 当轮落地：

- **生长进度条**：每块生长中地块头顶 billboard 细条（绿→金色定格→淡出，成熟弹跳接棒），进度直接吃 `packages/game` 预留的 `progressOf()`——原版就预留了这个接口。
- **作物差异化**：🥕 耐旱（干旱半速）· 🌽 怕旱（不浇水冻结）且招虫（虫子权重 ×3）。种子栏带特性标签。
- **惊喜事件系统**（`farm3d/events.ts`，React 外模块单例，零重渲染）：
  - 🌧️ **雨**（15s）：全场生长 ×2，雨丝粒子 + 天空/光照变灰
  - ☀️ **干旱**（20s）：🌽 冻结需点击浇水（橙环→蓝环），🥕 半速照长；天空变暖
  - 🐛 **害虫**（12s 内点击驱赶，+2 金币；超时叶子被啃，收获减产一半）：红环警示环，越接近超时闪越急
  - 🧪 **施肥**（工具按钮，5 金币）：该地块 +50% 速度直到收获（绿环）
- **架构红线不破**：事件不改游戏规则，只改"有效生长时间戳"（bonusMs 偏移），`stageOf/progressOf` 拿到的仍是纯时间戳，服务端同构叙事成立；`packages/game` 零 diff 保持。
- **墙钟补结算**：事件累加按帧间真实间隔（rAF 后台暂停，回前台一帧一次性补齐，且只补到事件 endAt）——切后台躲不掉干旱、也不白丢雨加成，与生长的 Date.now() 墙钟哲学一致。
- 附加状态（偏移/施肥/减产/浇水）存独立 localStorage 键 `farm-demo-extras-v1`，主存档仍归 game 包管。已知限制：多标签页同开时附加层 last-writer-wins（主存档同样如此，demo 范围不处理）。
- 演示/测试钩子：`__farmEvent('rain'|'drought'|'pest')` 强制触发事件（面试现场演示可控），`__farmDebug()` 读内部状态。

## 快速开始

```bash
npm install                 # 根目录，workspaces 一次装完
npm run dev -w @farm/web    # Web 版 http://localhost:5173
npm run start -w @farm/mobile  # Metro（Expo Go / 模拟器）
```

## 版本锁定表（Phase 0，2026-09-05）

组合兼容性依据：fiber 9.7 peer 要求 react 19~19.3 / three ≥0.156 / RN ≥0.78 / expo-gl ≥11。

| 包 | 锁定版本 | 说明 |
|---|---|---|
| node / npm | 26.7.0 / 11.19.0 | bun 1.4.0 可用但不作为主工具链 |
| expo（SDK 57） | ~57.0.20 | mobile 基座 |
| react-native | 0.86.3 | Expo 57 模板锁定 |
| react | 19.2.3 | 双端统一（web 端从 19.2.8 收敛，否则 npm 无法单副本 hoist，ERESOLVE 冲突） |
| three | ^0.185.1 | **双端必须同版本**，npm workspaces hoist 到根，单副本 |
| @react-three/fiber | ~9.7.0 | 同上 hoist 共享 |
| expo-gl | ~57.0.2 | SDK 匹配版（`expo install` 选定） |
| expo-asset | ~57.0.16 | SDK 匹配版 |
| react-native-gesture-handler | ~2.32.0 | expo install 选定（Phase 2 D3 手势用；native 侧随 Phase 2 D1 重建进壳） |
| @types/three | ^0.185.4 | |
| typescript | web ^7.0.2 / mobile ~6.0.3 | 各 app 独立 |

已知环境事实：`github.com` 当前可达（历史注释称不通，已过时）；release 大文件走 objects.githubusercontent.com 较慢。根 `package.json` 显式声明 expo/react/react-native（与 apps/mobile 同版本）：保证 npm hoist 后全仓单副本（web 的 react 已收敛到 19.2.3 同此），升级时根与 mobile 必须同步改，否则会出现双副本破坏单副本不变量。

## 架构决策（Phase 0）

1. **两步走**：先 Web（R3F）定手感，再 RN（expo-gl）移植——three 场景代码平台无关，约 90% 可平移，平台差异集中在壳（手势/UI/资产/存储/音频）。
2. **逻辑与渲染零耦合**：`packages/game` 为纯 TS 源码包（无构建产物），web/mobile 直接消费 TS 源；接后端时该包的"时间戳 + 懒计算"模式原样搬服务端。
3. **WebGL1 拒载绕过**：three r163+ 仅走 WebGL2 路径，但 expo-gl 的 WebGL2 上下文因非规范原型继承对 `instanceof WebGLRenderingContext` 恰好为 true——App 入口把全局 `WebGLRenderingContext` 换成哑类使检查落空（见 `apps/mobile/App.tsx`）。
4. **UI 一律 RN overlay**，不依赖 drei 的 DOM 系组件；相机控制 Phase 2 用 gesture-handler 自写。

## expo-gl × three 踩坑实录（Phase 0，iOS 模拟器 + dev build）

 iOS 27 + Xcode 27 + Expo SDK 57 + RN 0.86（bridgeless）+ three 0.185 + expo-gl 57.0.2 实测。

### 环境层

- **iOS 27 强制 UIScene 生命周期**（Apple TN3187）：Expo 57 prebuild 模板未适配，dev build 启动即崩（`UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`，EXC_BREAKPOINT）。修复：`scripts/patch-ios27-scene.sh` 给 Info.plist 注入 `UIApplicationSceneManifest` 并重写 AppDelegate/SceneDelegate；**每次 `expo prebuild` 后必须重跑**。
- **Xcode 27 移除 Simulator.app**：`expo run:ios` 起/osascript 阶段失败；用 `xcrun simctl install/launch` 手动装启绕过。
- **Expo Go 不可用**：iOS 27 模拟器上 idb HID 点击失效（系统弹窗无法关），放弃 Expo Go，全部走 dev build。

### JS 层（apps/mobile/App.tsx）——已按 expo-gl 57.0.2 源码校准

> **勘误（源码审计）**：本节最初记述的"gl 是裸 JSI HostObject、原型链断裂需手工嫁接 698 个成员、品牌式 `Symbol.hasInstance`、查询函数缺失需兜底"经对照 `node_modules/expo-gl@57.0.2` 源码（EXWebGLRenderer.cpp / EXWebGLMethods.def）**证伪**——那是黑屏排障期间误留下的旧版行为叙事。反证一直躺在运行日志里：`graftGLBindings: copied 0, native-present 698`，嫁接代码复制了 0 个成员，app 一直跑在实例自带的完整原型链上。相关死代码已删，以下为校准后的事实：

- **gl 实例自带完整 GL 链**：expo-gl 用全局 `WebGL2RenderingContext` stub 经 `callAsConstructor` 创建实例，且其 `prototype` 非规范地**继承 `WebGLRenderingContext.prototype`**（全部 698 个方法/常量装在那里，源码注释明说不合规范但故意为之）→ `gl.clearColor` 等直接可用。教训：`copied 0` 这行日志当时就该让我们停下来重读源码，而不是带着无效的"保险"继续走。
- **唯一必须的 hack——哑类替换**：three r163+ 用 `context instanceof WebGLRenderingContext` 判定 WebGL1 并抛错拒载；由于上述非规范继承，EXGL 的 WebGL2 上下文对这个检查**恰好为 true**（普通原型行走，expo-gl 没有自定义 `Symbol.hasInstance`）→ 首次创建 context 时把全局 `WebGLRenderingContext` 换成哑类使检查落空，一次性替换永久生效（EXGL 实为 GLES3/WebGL2 能力）。
- 查询函数（`getExtension`/`getSupportedExtensions`/`getShaderPrecisionFormat`/`isContextLost`）在 57.0.2 全部原生实现，无需兜底。

### 渲染循环层（黑屏根因，最贵的教训）

- **EXGL 命令队列没有背压**：JS 侧每帧 `renderer.render()` + `endFrameEXP()` 只是入队 + `dispatch_async` 到串行 GL 线程；JS 提交快于 GL 消费时 backlog 无界增长，**blit/present 排在队尾永远执行不到 → 永久黑屏**（JS 侧 60fps、getError=0、一切"正常"）。
- 解法：**每帧 `gl.getError()` 做背压屏障**——它是阻塞批（`addBlockingToNextBatch`），JS 等到 GL 线程把队列排空才返回，在途帧恒 ≤2。屏障耗时即单帧真实 GL 成本。
- 循环驱动用**自调度 `setTimeout` 链**（屏障返回后再排下一帧），不用 rAF：RN 的 rAF 在 JS 阻塞后会补发积压回调造成提交突发，把刚压平的队列再次打爆。
- 呈现链路（读 expo-gl 源码得出）：`endFrameEXP` → GL 线程执行批 → `glContextFlushed` → `needsRedraw` → MSAA blit 到 view framebuffer → 主线程 CADisplayLink `presentRenderbuffer`。

### 性能层（iOS 模拟器）

- 模拟器 GLES→Metal 转译层**片元着色极慢**（分层实测：裸 clear 管线 4ms/帧、three 无物体 5ms、Basic 立方体 57ms、Lambert ~160ms、Standard/PBR 534ms）。
- **视图点尺寸减半 = 像素 1/4 = 4 倍提速**（6→22fps，`SIM_DOWNSCALE` 常量控制）；`msaaSamples={1}` 无感（MSAA 非瓶颈）。
- 结论：**低多边形风格配 MeshLambertMaterial**（r155+ Lambert 已逐像素光照，别指望它便宜多少，但比 Standard 便宜 3 倍+）；**真机首测（2026-09-06，用户 iPhone + Expo Go dev + 半分辨率档）：~40-43fps，为模拟器同档 2 倍**——但"真机 60fps"预期未证实，当前数字含 Expo Go dev 模式开销且视图仍是半分辨率档，正式测量环境是 Phase 2 的真机 dev build（D6 性能轮）。

### 待办（Phase 2 移植前）

- `packages/game` 的 `load/save` 直连 `localStorage`，RN 无此全局——移植时把存储后端做成参数注入（web=localStorage，RN=AsyncStorage 封装）。
- `FarmScene.tsx` PlotView 的 hover 光标直连 `document.body.style.cursor`——RN 无 document，Phase 2 手势重写（gesture-handler）时消除，勿照搬。
- `packages/game` 的 `!plot.plantedAt` 会把合法的 epoch-0 时间戳误判为空地块——demo 无影响（零 diff 红线，现不改），接服务端供时时改 `=== null` 判空。

## Phase 1 web 侧踩坑（R3F 原型）

- **poly.pizza/Quaternius 的 GLB 把 `metallicFactor` 统一导出为 0.4**，但场景无环境贴图 → 金属度按 PBR 公式吸走漫反射，模型整体发黑。低模卡通风应在加载时统一 `metalness=0`。**坑中坑：多 primitive 的 GLB（carrot 本体+缨、trees 树干+叶，均 2 primitives）经 GLTFLoader 装成材质数组**，对数组直接赋 `metalness` 是静默无效的 expando，必须 `Array.isArray` 展开处理。review 时才揪出：此前误判"色板偏暗"，实为修复未生效，被 `flat` 的提亮掩盖。
- R3F 默认开 **ACES tone mapping**，暗色板会再被压暗一档；卡通风直接 `<Canvas flat>` 关掉。
- poly.pizza 模型单位极不统一，入场前必须按目标尺寸归一化（重定标 + XZ 居中 + 底面贴地），且缩放要用 `multiplyScalar`（源节点可能自带缩放，`setScalar` 会丢比例）。
- `trees.glb`（3.3MB）是 5 棵树合集，按节点名（`NormalTree_N`）拆选单体后再归一化；GLB 结构可直接解析 JSON chunk 查看（12 字节头 + 4 字节长度）。
- workspaces + Expo：根 package.json 锁 react 19.2.3（Expo 模板），web 若用不同 react 版本，npm 对 fiber 的 `peerOptional react-dom` 仲裁会失败——**monorepo 里 react/react-dom 必须全仓一个版本**。

