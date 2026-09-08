# farm-demo

「开心农场」3D 重制：**RN + Three.js** 面试作品项目。游戏逻辑抽为共享包 `packages/game`（纯 TS，对 2D 基线零 diff——D7 主动破例重构，理由见 PROGRESS.md）。当前进度：**Phase 1 D1~D12 已完成，Web 版已部署并验证；Phase 2 RN 移植按用户决定暂缓；新增第三渲染壳 `apps/minigame`（Cocos Creator 微信小游戏），M1 单场景原型已跑通本地编译**；详细 D 级轨迹见 [PROGRESS.md](PROGRESS.md)，验收勾选见 [docs/PRD.md](docs/PRD.md)，小游戏移植设计见 [docs/MINIGAME.md](docs/MINIGAME.md)。

详细计划见 [docs/PRD.md](docs/PRD.md)，资产清单与授权见 [packages/assets/ASSETS.md](packages/assets/ASSETS.md)。

## 结构

```
farm-demo/
├── apps/web/        # Web 3D 原型（Vite + React 19 + R3F）— Phase 1 D1~D5 完成 + D6 反馈轮
│   └── src/farm3d/  # gltf 资产管线 / motion 动画规范 / effects 特效 / sfx 合成音效
│                    # events 事件系统（雨/旱/虫/施肥，React 外单例） / clickGuard / layout / useFarm / FarmScene
├── apps/mobile/     # RN 版（Expo SDK 57 + expo-gl）— Phase 0 hello-cube 跑通（模拟器 ~20fps），Phase 2 移植目标（暂缓）
├── apps/minigame/   # Cocos Creator 微信小游戏（M1 本地编译通过，待编辑器组场景 + 真机调试）
├── packages/game/   # 游戏数值与状态机（纯 TS，三端共享，服务端同构；对基线零 diff，仅 load/save 加可选 backend 注入点）
├── packages/assets/ # CC0 3D 模型（glTF，poly.pizza/Quaternius）+ 授权记录
├── scripts/         # patch-ios27-scene.sh（expo prebuild 后必跑）
└── docs/            # PRD / MINIGAME（含验收清单勾选进度）
```

## 进度（2026-09-08；Phase 1 D1~D12 + P1-3 + P2-5 ~ P2-7 全部完成，Vercel 单线部署）

| 阶段 | 状态 | 说明 |
|---|---|---|
| Phase 0 准备与骨架 | ✅ 完成（当日复验 4/4 + 源码审计清零） | workspaces / game 包零 diff / expo-gl×three 跑通 / 版本表 / gesture-handler 锁定 |
| Phase 1 Web 原型 D1~D5 | ✅ 完成 | R3F 场景 + 核心循环 + 环绕相机 + 生长插值 + juice 四件套 + motion 动画规范（提交 61e0758 → 0cd6398） |
| Phase 1 D6 反馈轮 | ✅ 完成 | 生长进度条 + 作物差异化 + 雨/旱/虫/施肥事件系统（提交 6b7baf1） |
| Phase 1 D7 状态机扩展 | ✅ 完成 | 6 状态生命周期 + withered 8s 自动恢复 + v1→v2 存档迁移 |
| Phase 1 D8 田园背景装饰 | ✅ 完成 | 程序化柯基 + 狗屋 + 石板路 + 仓库等装饰；鱼塘组件保留但当前不挂载 |
| Phase 1 D9 部署基建 | ✅ 完成 | Dockerfile + vercel.json + `.vercelignore`（cc 链路 2026-09-06 下线） |
| Phase 1 D10 菜园入口 + 仓库 | ✅ 完成 | FenceRing 留缺口 + 石板路穿过 + 程序化木墙茅草顶仓库 |
| Phase 1 D11 cc 部署下线 | ✅ 完成 | cc 容器、镜像、nginx vhost 清理，Vercel 作为唯一生产站点 |
| Phase 1 D12 布局审计与视觉收尾 | ✅ 完成 | 收获点击、仓库方向/高度、石板路/树木布局、Toon 材质描边、树木贴图与线上验证 |
| Phase 3 P1-3 相机动效 | ✅ 完成 | 开场运镜（更远更高机位 outCubic 滑入默认视角）+ 收获时目标地块推近与回位，R 键 reset 仍可中断 |
| Phase 2 P2-5 天气系统加固 | ✅ 完成 | 三处修复（时钟统一 / RNG 注入 / bonusMs 运行中钳位）+ 视觉氛围（lerp 权重 0.35→0.65 变天感 + 雨粒子风向）；reviewer 三条反馈同步落地；packages/game 零 diff（提交 dd1c494） |
| Phase 2 P2-6 宠物狗定点踱步 | ✅ 完成 | D8 静态蹲姿升级为门口 6s 一来回定点踱步 + 四腿错相步态 + 躯干微浮 + cos 驱动的摆头；所有振幅/周期走 `deco/motion.ts` 的 `DOG_WALK`；packages/game 零 diff |
| Phase 2 P2-7 春季日历天气系统 | ✅ 完成 | 180 天 / 60s/天；6 种天气按月动态概率 + 连雨约束 + 自动涌现干旱；顶部 WeatherForecast HUD（今日 + 未来 5 天 + ⏮⏪⏩⏭💧🏠）；天气/干旱由 forecast 派生（events.ts 移除瞬时随机）；packages/game 零 diff |
| Phase 3 移动优先重做（iPhone 15） | ✅ 完成 | web 端 iOS HIG + Linear 风重做：TopBar/BottomBar 二分（44pt + 58pt）；种子栏缩为 3 颗 pill（🥕🌽🧪，价格 badge）+ 工具按钮（🏠🔇↺，↺ 长按 1s 防误触）；新增 `BottomSheet` iOS 抽屉承载天气/种子详情/摆件/教程；相机 FOV 52→48、距离收窄适配 portrait；deco 网格避让 HUD；`packages/game` 仍零 diff |
| Phase 2 RN 移植（9/13~） | ⏸ 暂缓 | 按用户决定暂不移植，Web 版作为当前面试演示交付物 |
| 微信小游戏 M1 单场景原型（9/8） | ✅ 本地编译通过 | `apps/minigame/` + Cocos Creator 3.8.x + 2D；6 块地 + 种子栏 + 金币 HUD + 种/收循环；`packages/game` load/save 加可选 backend 注入（向后兼容，web 端零改动，diff 11 行）；esbuild 预编译 game 包 + minigame 入口到 `assets/scripts/`（4.3kb + 10.9kb）；待 Cocos 编辑器组场景 + 微信开发者工具真机调试 |
| 微信小游戏 M2/M3 | ⬜ 未开始 | 全功能 P1 复刻 / P2 系统（天气/害虫/摆件）复刻，见 `docs/MINIGAME.md` §6 |
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
- 演示/测试钩子：P2-7 起日历事件派生自 forecast，`__farmEvent` 仅保留 `__farmEvent('pest')` 触发虫害；日历推进用 `__farmTime.fastForward(n)` / `jumpToGameDay(d)` / `jumpToNextRain()`；`__farmDebug()` 读内部状态。

## D6 试玩反馈第一轮（2026-09-06）

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
- 演示/测试钩子：P2-7 起日历事件派生自 forecast，`__farmEvent` 仅保留 `__farmEvent('pest')` 触发虫害；日历推进用 `__farmTime.fastForward(n)` / `jumpToGameDay(d)` / `jumpToNextRain()`；`__farmDebug()` 读内部状态。

## 部署

**当前 prod 站点（单线部署）**：https://farm-demo-gamma.vercel.app （Vercel CDN）

曾双线部署（cc 自建 + Vercel），2026-09-06 下线 cc 一侧（详见末尾「cc 部署历史」）。当前所有部署链路相关命令、踩坑沉淀都围绕 Vercel。

### Vercel（一键部署，当前主站）

```bash
# 首次
npm i -g vercel@latest        # CLI ≥ 50 即可，59.x 是当前最新
vercel login                   # 浏览器 OAuth 授权
vercel                         # 首次创建 project + 部署到 preview
vercel --prod                  # 部署到 prod
```

`vercel.json` 已配置：

- `buildCommand`: `cd apps/web && npm run build`（让 tsc 用 web 局部 ^7.0.2）
- `outputDirectory`: `apps/web/dist`
- `installCommand`: `npm install --workspaces --include-workspace-root`（workspaces 单副本）
- `rewrites`: SPA fallback → `/index.html`
- `headers`: `/assets/*` 长缓存 + `/index.html` 不缓存

`.vercelignore` 已配（关键）：

```
node_modules
**/node_modules
.git
.playwright-cli
.zcode
.expo
apps/mobile/ios
apps/mobile/android
apps/web/ios
apps/web/dist
```

**Vercel 踩坑**：
1. **15000 文件上传上限**：默认全仓库上传含 `node_modules`（expo 等 transitive 依赖动辄 2 万+ 文件），报 `Invalid request: files should NOT have more than 15000 items, received 20503`。`.vercelignore` 排除 node_modules + apps/mobile 后从 20503 降到 **448** 个文件。
2. **上传不需要 node_modules**：Vercel 云端自己 `npm install`，只传源码 + lockfile + vercel.json 即可。云端 install 16s 装 557 包 + tsc + vite build 30s 出 dist。
3. **preview deployment 密码保护**：`farm-demo-<hash>-cairuis-projects.vercel.app` 这种带 hash 的原始 URL 默认开启 Vercel SSO 302 重定向（避免 preview abuse）。**production 别名**（项目级 `farm-demo-gamma.vercel.app`）才是公开 URL，分享链接用别名。
4. **CLI 升级陷阱**：旧 CLI（`/Users/cairui/.bun/bin/vercel` 50.18.2）PATH 优先级可能高于 npm 全局新版。升级后 `which vercel` 仍指向旧版 → 删 bun 旧符号链接 `rm /Users/cairui/.bun/bin/vercel` 让 `/opt/homebrew/bin/vercel`（npm 全局）接管。

---

### cc 部署历史（2026-09-06 已下线）

cc + Docker 部署链路曾是主站，2026-09-06 用户决定下线。保留本节作为踩坑档案，**未来如需恢复 cc 部署**，可参照此流程反推。

#### 完整清理动作记录

```bash
# 本地：构建 amd64 镜像
docker buildx build --no-cache --platform linux/amd64 \
  -f apps/web/Dockerfile -t farm-demo-web:latest --load .

# 推送到 cc
docker save farm-demo-web:latest | gzip > /tmp/farm-demo-web.tar.gz
scp /tmp/farm-demo-web.tar.gz cc:/tmp/

# cc：加载 + 启动
ssh cc 'docker load -i /tmp/farm-demo-web.tar.gz && \
  cd ~/Web/docker && docker compose up -d farm-web'
```

#### 下线清理动作（实际执行，2026-09-06 22:43 UTC+8）

```bash
# 1. 停 + 删容器 + 删镜像
ssh cc 'docker stop docker-farm-web-1 && docker rm docker-farm-web-1 && docker rmi farm-demo-web:latest'

# 2. 从 docker-compose.yml 删除 farm-web service block
ssh cc 'cd ~/Web/docker && python3 -c "..."'   # 见 commit diff

# 3. 从 nginx.conf 删除 game.ladishb.com 的 server 块（80 重定向 + 443 反代）
ssh cc 'cd ~/Web/docker && python3 -c "..."'

# 4. nginx.conf 末尾追加 410 Gone 兜底（防止 game.ladishb.com 落到其他 default server）
ssh cc 'cat >> /home/cc/Web/docker/nginx.conf << EOF
server { listen 80; listen 443 ssl http2; server_name game.ladishb.com; ...; return 410; }
EOF'
ssh cc 'docker exec docker-nginx-1 nginx -s reload'

# 5. 删除 cc 上的 farm-demo-r3f 仓库 + 临时文件
ssh cc 'rm -rf ~/Web/farm-demo-r3f /tmp/farm-demo-web.tar.gz /tmp/game-ladishb-vhost.conf'

# 6. 验证
curl -Ik https://game.ladishb.com/   # HTTP/2 410 Gone
```

**为什么 410 不是 404**：410 Gone 明确告诉客户端资源永久不存在，不会被浏览器/CDN 缓存。`game.ladishb.com` 的 DNS A 记录仍指向 cc IP（116.62.48.175），未来如恢复 cc 部署只需删除 410 server 块 + 重建反代即可，DNS 不用动。

#### cc 链路踩坑沉淀（保留供参考）

1. **平台错位**：Mac M1 默认 `docker build` 出 arm64，cc 是 amd64 → 容器 `exec format error`。强制 `--platform linux/amd64`。
2. **Dockerfile 漏 COPY mobile**：原 Dockerfile 只 COPY `apps/web/package.json`，npm ci 漏装 `@react-three/fiber` / `three` / `@types/three`，tsc 7 strict 报 `Cannot find module 'three'` + `Property 'mesh' does not exist on JSX.IntrinsicElements`。修复：补 `COPY apps/mobile/package.json ./apps/mobile/`。
3. **tsc 7.0.2 strict-only 错误**：本地 tsc 6.0.3 不报、docker 里 tsc 7 会报：`Promise<GLTF> | undefined` narrow、`traverse(o)` 隐式 any。Dockerfile `cd apps/web && npm run build` 让 tsc 用 apps/web 局部 7.0.2；剩余 4 个错误在 `apps/web/src/farm3d/gltf.ts` 显式标注类型。
4. **`tsc` 失败但 dist 仍存在**：buildkit 把 `npm run build` 的 stderr/stdout 一起 tail，tsc exit code 1 被 `&&` 后的 `vite build` 覆盖前 dist 已被缓存——曾导致 prod 跑旧版。**判断 deploy 成功必须看 container status healthy + 浏览器加载新 bundle**，不能只看 build log。
5. **nginx.conf vhost 位置**：cc 上 nginx 跑在 `docker-nginx-1` 容器内，配置通过 volume 挂载 `/home/cc/Web/docker/nginx.conf` → 容器内 `/etc/nginx/conf.d/default.conf`。改完必须 `docker exec docker-nginx-1 nginx -s reload`。

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

- `packages/game` 的 `load/save` ~~直连 `localStorage`~~ — **✅ 2026-09-08 已注入式改造**（`StorageBackend` 可选参数；web 端不传参走默认 localStorage 零回归；小游戏端传 `createWxStorageBackend()`）。
- `FarmScene.tsx` PlotView 的 hover 光标直连 `document.body.style.cursor`——RN 无 document，Phase 2 手势重写（gesture-handler）时消除，勿照搬。
- `packages/game` 的 `!plot.plantedAt` 会把合法的 epoch-0 时间戳误判为空地块——demo 无影响（零 diff 红线，现不改），接服务端供时时改 `=== null` 判空。

## Phase 1 web 侧踩坑（R3F 原型）

- **poly.pizza/Quaternius 的 GLB 把 `metallicFactor` 统一导出为 0.4**，但场景无环境贴图 → 金属度按 PBR 公式吸走漫反射，模型整体发黑。低模卡通风应在加载时统一 `metalness=0`。**坑中坑：多 primitive 的 GLB（carrot 本体+缨、trees 树干+叶，均 2 primitives）经 GLTFLoader 装成材质数组**，对数组直接赋 `metalness` 是静默无效的 expando，必须 `Array.isArray` 展开处理。review 时才揪出：此前误判"色板偏暗"，实为修复未生效，被 `flat` 的提亮掩盖。
- R3F 默认开 **ACES tone mapping**，暗色板会再被压暗一档；卡通风直接 `<Canvas flat>` 关掉。
- poly.pizza 模型单位极不统一，入场前必须按目标尺寸归一化（重定标 + XZ 居中 + 底面贴地），且缩放要用 `multiplyScalar`（源节点可能自带缩放，`setScalar` 会丢比例）。
- `trees.glb`（3.3MB）是 5 棵树合集，按节点名（`NormalTree_N`）拆选单体后再归一化；GLB 结构可直接解析 JSON chunk 查看（12 字节头 + 4 字节长度）。
- workspaces + Expo：根 package.json 锁 react 19.2.3（Expo 模板），web 若用不同 react 版本，npm 对 fiber 的 `peerOptional react-dom` 仲裁会失败——**monorepo 里 react/react-dom 必须全仓一个版本**。

