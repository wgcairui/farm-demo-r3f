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
| react | 19.2.3 | mobile；web 端 19.2.8 各自独立 |
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
