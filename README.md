# farm-demo

「开心农场」3D 重制：**RN + Three.js** 面试作品项目。2D 原型（Vite + React 19）已迁入 `apps/web`，游戏逻辑抽为共享包 `packages/game`；Phase 1 在 web 端用 react-three-fiber 做 3D 原型，Phase 2 移植到 `apps/mobile`（Expo + expo-gl）。

详细计划见 [docs/PRD.md](docs/PRD.md)，资产清单与授权见 [packages/assets/ASSETS.md](packages/assets/ASSETS.md)。

## 结构

```
farm-demo/
├── apps/web/        # Web 版（Vite + React 19）— Phase 1 改造为 R3F 3D 原型
├── apps/mobile/     # RN 版（Expo SDK 57 + expo-gl）— Phase 2 移植目标
├── packages/game/   # 游戏数值与状态机（纯 TS，双端共享，服务端同构）
├── packages/assets/ # CC0 3D 模型（glTF）+ 授权记录
└── docs/            # PRD
```

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
| three | ~0.185.1 | **双端必须同版本**，npm workspaces hoist 到根，单副本 |
| @react-three/fiber | ~9.7.0 | 同上 hoist 共享 |
| expo-gl | ~57.0.2 | SDK 匹配版（`expo install` 选定） |
| expo-asset | ~57.0.16 | SDK 匹配版 |
| @types/three | ~0.185.0 | |
| typescript | web ^7.0.2 / mobile ~6.0.3 | 各 app 独立 |

已知环境事实：`github.com` 当前可达（历史注释称不通，已过时）；release 大文件走 objects.githubusercontent.com 较慢。

## 架构决策（Phase 0）

1. **两步走**：先 Web（R3F）定手感，再 RN（expo-gl）移植——three 场景代码平台无关，约 90% 可平移，平台差异集中在壳（手势/UI/资产/存储/音频）。
2. **逻辑与渲染零耦合**：`packages/game` 为纯 TS 源码包（无构建产物），web/mobile 直接消费 TS 源；接后端时该包的"时间戳 + 懒计算"模式原样搬服务端。
3. **expo-gl WebGL2 shim**：three r163+ 仅走 WebGL2 路径，RN 无 `WebGL2RenderingContext` 全局，App 入口补空类 shim（见 `apps/mobile/App.tsx`）。
4. **UI 一律 RN overlay**，不依赖 drei 的 DOM 系组件；相机控制 Phase 2 用 gesture-handler 自写。

## expo-gl × three 踩坑实录（Phase 0，iOS 模拟器 + dev build）

 iOS 27 + Xcode 27 + Expo SDK 57 + RN 0.86（bridgeless）+ three 0.185 + expo-gl 57.0.2 实测。

### 环境层

- **iOS 27 强制 UIScene 生命周期**（Apple TN3187）：Expo 57 prebuild 模板未适配，dev build 启动即崩（`UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`，EXC_BREAKPOINT）。修复：`scripts/patch-ios27-scene.sh` 给 Info.plist 注入 `UIApplicationSceneManifest` 并重写 AppDelegate/SceneDelegate；**每次 `expo prebuild` 后必须重跑**。
- **Xcode 27 移除 Simulator.app**：`expo run:ios` 起/osascript 阶段失败；用 `xcrun simctl install/launch` 手动装启绕过。
- **Expo Go 不可用**：iOS 27 模拟器上 idb HID 点击失效（系统弹窗无法关），放弃 Expo Go，全部走 dev build。

### JS 层（apps/mobile/App.tsx）

- **gl 实例是 JSI HostObject**：`in`/`hasOwnProperty` 恒 true，不能当存在性判断；必须 `typeof` 真读且 try/catch（读未知属性可能抛异常）。
- **GL 方法/常量全集（698 个）挂在全局 `WebGLRenderingContext.prototype`**，但 gl 实例的原型链不过它 → `gl.clearColor` 等全 undefined。解法：在替换全局类**之前**捕获真 proto，把方法（绑 this）与常量拷为 gl 实例 own property。
- **three r163+ 的 WebGL1 检查**用 `context instanceof WebGLRenderingContext`，EXGL 的类带品牌式 `Symbol.hasInstance`，改原型无效 → 运行时把全局 `WebGLRenderingContext` 换成哑类使检查落空（EXGL 实为 GLES3，`supportsWebGL2 = true`）。
- **缺的查询函数按语义兜底**：`getExtension→null`、`getSupportedExtensions→[]`、`getShaderPrecisionFormat→{127,127,23}`、`getContextAttributes`。

### 渲染循环层（黑屏根因，最贵的教训）

- **EXGL 命令队列没有背压**：JS 侧每帧 `renderer.render()` + `endFrameEXP()` 只是入队 + `dispatch_async` 到串行 GL 线程；JS 提交快于 GL 消费时 backlog 无界增长，**blit/present 排在队尾永远执行不到 → 永久黑屏**（JS 侧 60fps、getError=0、一切"正常"）。
- 解法：**每帧 `gl.getError()` 做背压屏障**——它是阻塞批（`addBlockingToNextBatch`），JS 等到 GL 线程把队列排空才返回，在途帧恒 ≤2。屏障耗时即单帧真实 GL 成本。
- 循环驱动用**自调度 `setTimeout` 链**（屏障返回后再排下一帧），不用 rAF：RN 的 rAF 在 JS 阻塞后会补发积压回调造成提交突发，把刚压平的队列再次打爆。
- 呈现链路（读 expo-gl 源码得出）：`endFrameEXP` → GL 线程执行批 → `glContextFlushed` → `needsRedraw` → MSAA blit 到 view framebuffer → 主线程 CADisplayLink `presentRenderbuffer`。

### 性能层（iOS 模拟器）

- 模拟器 GLES→Metal 转译层**片元着色极慢**（分层实测：裸 clear 管线 4ms/帧、three 无物体 5ms、Basic 立方体 57ms、Lambert ~160ms、Standard/PBR 534ms）。
- **视图点尺寸减半 = 像素 1/4 = 4 倍提速**（6→22fps，`SIM_DOWNSCALE` 常量控制）；`msaaSamples={1}` 无感（MSAA 非瓶颈）。
- 结论：**低多边形风格配 MeshLambertMaterial**（r155+ Lambert 已逐像素光照，别指望它便宜多少，但比 Standard 便宜 3 倍+）；真机跑原生 GLES 无此瓶颈，上真机恢复全分辨率，预期 60fps（待真机验证）。

### 待办（Phase 2 移植前）

- `packages/game` 的 `load/save` 直连 `localStorage`，RN 无此全局——移植时把存储后端做成参数注入（web=localStorage，RN=AsyncStorage 封装）。

## Phase 1 web 侧踩坑（R3F 原型）

- **poly.pizza/Quaternius 的 GLB 把 `metallicFactor` 统一导出为 0.4**，但场景无环境贴图 → 金属度按 PBR 公式吸走漫反射，模型整体发黑。低模卡通风应在加载时统一 `metalness=0`（见 `apps/web/src/farm3d/gltf.ts` 的归一化管线）。
- R3F 默认开 **ACES tone mapping**，暗色板会再被压暗一档；卡通风直接 `<Canvas flat>` 关掉。
- poly.pizza 模型单位极不统一，入场前必须按目标尺寸归一化（重定标 + XZ 居中 + 底面贴地），且缩放要用 `multiplyScalar`（源节点可能自带缩放，`setScalar` 会丢比例）。
- `trees.glb`（3.3MB）是 5 棵树合集，按节点名（`NormalTree_N`）拆选单体后再归一化；GLB 结构可直接解析 JSON chunk 查看（12 字节头 + 4 字节长度）。
- workspaces + Expo：根 package.json 锁 react 19.2.3（Expo 模板），web 若用不同 react 版本，npm 对 fiber 的 `peerOptional react-dom` 仲裁会失败——**monorepo 里 react/react-dom 必须全仓一个版本**。

