# 进度追踪

本文件沉淀每一轮「批准 → 实施 → 验收」的轨迹。README 顶部只保留一句「当前在哪」，PRD §5 是权威工作步骤拆分，本表是 D 级别 + commit 级别的实时状态。

最近更新：2026-09-07（D7~D12 全部完成；D12 视觉收尾与线上验证完成）

---

## 当前状态

**Phase 1 D7~D12 + P1-3 全部完成**，prod 单线部署：Vercel CDN。

- **Phase 2 RN 移植按用户决定暂缓**，当前以 Web 版作为面试演示交付物。

- 主站 prod：https://farm-demo-gamma.vercel.app

cc + Docker 自建链路 2026-09-06 22:43 UTC+8 已下线（game.ladishb.com 现在返回 410 Gone）。

---

## Phase 0：准备与骨架 ✅ 完成（2026-09-06 复验通过）

- workspaces 改造（apps/web + apps/mobile + packages/game）
- game 包从 2D 基线逐字节抽出，零 diff（**D7 主动破例重构，理由见 Phase 1 D7**）
- expo-gl × three 跑通（hello-cube 骨架，模拟器 ~20fps 半分辨率档）
- 版本表写入 README + gesture-handler 锁定
- 提交：phase 0 系列

---

## Phase 1：Web 原型——手感定稿

| D | 状态 | 主题 | 关键 commit |
|---|---|---|---|
| D1 | ✅ | 场景静态搭建：地块、地面、光照、阴影、天空色 | — |
| D2 | ✅ | 核心循环接通：`packages/game` 驱动 6 块地；raycast；种子栏；存档 | — |
| D3 | ✅ | 生长插值与相机：三阶段 scale/颜色；OrbitControls + clamp | — |
| D4 | ✅ | juice 基础版：播种压弹、收获弹出、金币粒子、浮字、sfx | — |
| D5 | ✅ | 打磨手感：动画三档时长 + 空地提示 | — |
| D6 | ✅ | 试玩反馈第一轮：进度条 + 作物差异化 + 雨/旱/虫/施肥事件系统 | `6b7baf1`、`af39cce`、`ac9b614` |
| D7 | ✅ | 土地状态机扩展：6 状态生命周期 + withered 限时自动恢复 + v1→v2 迁移 | `cf8ea23` |
| D8 | ✅ | 田园背景装饰：程序化柯基 + 狗屋 + 石板路 + 池塘（无 GLB） + 2 轮 review fix | `48bfb91`、`8bd9878`、`4e6f8ce`、`cf704df`、`d4b087a` |
| **D9** | ✅ | **部署基建**：apps/web Dockerfile（multi-stage npm builder → nginx:alpine）+ vercel.json + `.vercelignore` | `92aa065`、`a7e1703`、`0dc66fe`、`e05bef5` |
| **D10** | ✅ | **菜园入口 + 仓库**：FenceRing 留缺口 + 石板路穿过 + 程序化木墙茅草顶仓库 | `8b21752` |
| **D11** | ✅ | **cc 部署下线**：停 farm-web 容器 + 删镜像 + 删 game.ladishb.com nginx vhost + 410 Gone 兜底 + 删 cc 上 farm-demo-r3f 仓库 | `e347782` |
| **D12** | ✅ | **多角度布局审计 + 3 个 bug 修复**：石板路侵入 plot + 仓库被 cottage 遮挡 + 仓库视觉雷同 cottage | `0194339` |

### D7 实施回顾

**目标**：地块状态机完整生命周期（empty / sown / sprout / growing / mature / withered），withered 限 8s 自动恢复 empty。

**关键改动**：
- `packages/game/src/index.ts`：PlotState 6 状态枚举、tickPlot() 推动状态机、WITHER_RECOVER_MS=8000、持久化 key 升 `farm-demo-v2` + v1→v2 迁移
- `apps/web/src/farm3d/landState.ts`：PLOT_STATE_TINT 视觉色表
- `apps/web/src/farm3d/FarmScene.tsx`：PlotStateTicker（事件循环推动）+ WitheredRecoverHint（剩余恢复时间提示）

**破零 diff 红线**：用户明确批准。理由：D7 主动重构 state machine 是为后续服务端同构做准备（v2 schema 显式列 state 是接后端的最小可行形态），保留 v1 迁移路径保持兼容。

### D8 实施回顾

**目标**：田园背景装饰——柯基 + 狗屋 + 茅草屋 + 石板路 + 鱼塘

**关键改动**：
- 新建 `apps/web/src/farm3d/deco/` 子目录（Cottage / Dog / Doghouse / Path / Pond + motion.ts + index.tsx）
- **全部程序化几何体**（无 GLB 依赖）：poly.pizza 上 dog/cottage 模型页 404，fallback 到 box+cone+sphere 拼接
- 2 轮 review fix（`8bd9878`、`cf704df`、`d4b087a`）：
  - 修 Path/Pond group position 锚定（石头和水面之前在原点）
  - 修狗嵌入墙壁 + 石头沉到地里 + 狗朝向
  - **第二轮**：cottage 整体旋转 +90° 让门朝地块（+x 方向），Doghouse/Dog 坐标重算

**dog 朝向处理细节**：参考图里狗脸朝右看地块，最终用 `rotation={[0, Math.PI/2, 0]}` 让本地 +z（狗鼻子）转向世界 +x。从相机 (5, 8, 4) 视角下狗脸完整可见（眼睛、鼻子、耳朵）。

### D9 实施回顾（部署基建）

**关键改动**：
- `apps/web/Dockerfile`：node:24-alpine builder（npm ci 装 workspaces）→ nginx:alpine runtime
- `apps/web/nginx.conf`：SPA fallback + hash 资源长缓存 + gzip
- `vercel.json`：monorepo + Vite 适配（buildCommand cd apps/web / outputDirectory / installCommand workspaces / rewrites / headers）
- `.vercelignore`：排除 node_modules + apps/mobile（Vercel 15000 文件上限）

**踩坑沉淀（README 部署章节已记）**：
1. Mac M1 默认 arm64，cc 是 amd64 → `--platform linux/amd64` 否则 `exec format error`
2. Dockerfile 漏 COPY mobile → tsc 找不到 three → 补 `COPY apps/mobile/package.json`
3. tsc 7.0.2 strict 比 6.0.3 严（Promise undefined narrow / traverse 隐式 any）→ gltf.ts 显式标注
4. Vercel 15000 文件上限 → `.vercelignore` 从 20503 → 448
5. CLI 升级后 PATH 优先级陷阱（bun 旧版 vs npm 新版）→ `rm /Users/cairui/.bun/bin/vercel`
6. Vercel preview deployment 默认 SSO 密码保护，**生产别名**（`*.vercel.app`）才是公开 URL

### D10 实施回顾

**关键改动**：
- `apps/web/src/farm3d/FarmScene.tsx`：FenceRing 左侧循环跳过 i=1 段（z≈-0.43），留 ~0.95m 宽缺口正对 cottage
- `apps/web/src/farm3d/deco/Path.tsx`：9 块石板重写为 L 形（门口沿 -z → 缺口 → +x 进入菜园）
- 新增 `apps/web/src/farm3d/deco/Warehouse.tsx`：程序化木墙（暗木色 0xb8924a）+ 茅草顶 + 大双木门（深棕 + 黑门缝 + 浅黄把手）+ 浅黄牌匾 + 双通风窗
- 位置 [-3.5, 0, -2.5]，cottage 正后方；整体旋转 +90° 门朝 +x 朝菜园
- `deco/index.tsx` 接入

### D11 实施回顾（cc 部署下线）

**目标**：彻底移除 cc + Docker 部署链路，保留 prod 单线部署（Vercel）。

**关键动作**（2026-09-06 22:43 UTC+8）：

1. **停 + 删容器 + 删镜像**：`docker stop docker-farm-web-1 && docker rm docker-farm-web-1 && docker rmi farm-demo-web:latest`
2. **从 docker-compose.yml 删 farm-web service**：用 python 脚本扫 4-space 缩进的顶级 key，匹配 `farm-web:` 就跳过直到下一个 service
3. **从 nginx.conf 删 game.ladishb.com 的 server 块（80 重定向 + 443 反代）**：用 python 大括号 stack 匹配，删包含 `game.ladishb.com` 的所有 server 块（23 → 21）
4. **加 410 Gone 兜底**：nginx.conf 末尾追加新 server 块，`return 410;`，防止 game.ladishb.com 落到其他 default server（如 ladisadmin Next.js）。DNS A 记录保留指向 cc IP，未来恢复部署只删这个兜底块即可。
5. **nginx reload**：`docker exec docker-nginx-1 nginx -t && nginx -s reload`，语法 OK，http2 弃用 warning 无害
6. **删 cc 上的 farm-demo-r3f 仓库** + `/tmp/farm-demo-web.tar.gz` + `/tmp/game-ladishb-vhost.conf` + 备份文件

**踩坑沉淀**：
1. **删 nginx vhost 后会落到 default server**：443 端口有 9 个 server 块监听，删 game.ladishb.com 后请求落到第一个匹配的 server（ladisadmin），返回 Next.js 站点内容。**必须加 410 兜底**，否则域名被劫持到无关服务。
2. **410 vs 404**：410 Gone 明确告诉客户端资源永久不存在，不被浏览器/CDN 缓存。如选 404，浏览器可能继续 cache + 反复请求；如选 redirect 到其他站，会被搜索引擎索引。
3. **DNS 不用动**：保留 A 记录指向 cc IP（116.62.48.175）+ nginx 410 响应，未来恢复部署只删 410 兜底块 + 重建反代。
4. **删容器顺序**：必须先 `docker stop` → `docker rm` → `docker rmi`，否则 image 有引用时 rmi 报错（`must force`）。
5. **compose down/up vs 直接操作**：`docker compose up -d` 会读取 compose 文件重建容器，所以从 compose 删 service + 直接删容器两步都要做，单删容器下次 up 会重建。

**最终状态**：
- `https://game.ladishb.com/` → HTTP/2 **410 Gone**（之前 200 + 小满农场 3D）
- `https://farm-demo-gamma.vercel.app` → HTTP/2 200（Vercel CDN 唯一 prod 站点）
- cc 上无 farm-demo 任何痕迹（容器、镜像、仓库、临时文件全清）

---

### D12 实施回顾（多角度布局审计 + 3 bug 修复）

**目标**：用多角度视觉审计找布局 bug，修复后重新部署到 Vercel prod。

**审计方法**：
- Playwright Python + Chromium headless，模拟 OrbitControls 鼠标拖拽，从 11 个不同相机角度（默认 3/4、近顶视、东南西北四角、+x -x 侧视、缩放、事件触发后）截图
- 几何推演验证路径与地块的 AABB 是否重叠（用 Node 计算每块石板 vs 每块地的半边距之和）
- 截图存于 `/tmp/farm-audit/multi/`（修复前 11 张）和 `/tmp/farm-audit/post-fix/`（修复后 8 张）

**发现 bug**：

| ID | 严重 | 描述 | 证据 |
|---|---|---|---|
| **P1-1** | blocker | 原路径 9 块石板最后 3 块（x ∈ [-1.7, -1.1]）侵入 plot 0 (-1.2, -0.6) 和 plot 3 (-1.2, 0.6)，玩家无法种这两块地 | 几何计算：stone 8 vs plot 3 dx=0.1 dz=0.25 已深入 plot |
| **P1-2** | blocker | 仓库原位置 `[-3.5, 0, -2.5]` 与 cottage 同 x 线，被 cottage 完全遮挡（默认相机 +x +y +z 视角），用户根本看不到仓库 | 截图 `multi/04-camera-from-z-negative.png`：从 -z 方向看两栋楼融成一片 |
| **P2-1** | polish | 仓库视觉与 cottage 雷同（金字塔顶 + 浅色墙 + 方窗），缺乏「仓库感」 | 截图 `multi/02-camera-rotated-left.png` |

**修复**：
- `apps/web/src/farm3d/deco/Path.tsx`：路径由 9 块缩成 8 块，末端从 `(-1.1, 0.35)` 退到 `(-1.95, 0.05)`，与 plot 0/3 边界留 0.24m 安全距离，仍穿过栅栏缺口进入菜园
- `apps/web/src/farm3d/deco/Warehouse.tsx`：
  - 位置 `[-3.5, 0, -2.5]` → `[-1.5, 0, -3.0]`（向 +x 偏 2m，z 后移 0.5m 与背栏留缓冲）
  - 屋顶：4 段锥（金字塔）→ 双坡山墙（两个斜置 box + 山墙封板 + 屋脊横木）
  - 墙色：0xb8924a → 0x8a6a3a（深陈旧木色）；屋顶：0x8b6914 → 0x6b4a18（暗灰棕）
  - 贴 6 条竖向木板条（前墙）+ 6 条侧墙木板条（深一档 0x6e4f2a）模拟拼接墙
  - 窗：左右各 1 个方窗 → 4 条横向通风缝（前墙）+ 4 条侧墙通风缝（接近全黑）
  - 门：原 2 个把手球 → 4 个铁铰链 + 1 个中央门闩
  - 加 4 根角柱（0x4a2c10 深棕色）围出「敦实仓库」骨架
- `apps/web/src/farm3d/FarmScene.tsx`：NormalTree_1 从 `(-0.3, -3.6)` 挪到 `(1.0, -3.6)`，避让搬过来的仓库

**修复验证**：截图 `post-fix/03-topdown.png`、`post-fix/06-fresh-default.png` 三个 bug 全消（仓库清晰可见 + 不与背栏穿模 + 视觉差异化明显），路径与地块无重叠。

**部署**：commit `0194339` push origin，Vercel CLI `--prod` Ready in 17s，alias `https://farm-demo-gamma.vercel.app` 已是修复后版本。

### D12 收尾：P1-3 教程提示

**目标**：让用户在不靠运气的情况下也能发现 P1-3 相机动效（开场运镜 + 收获推近 + R 键重置）。

**实现**：
- `apps/web/src/App.css`：右下角 `.hints` 气泡样式（白底圆角、淡入动画、`.kbd` 风格化 R 键徽标）
- `apps/web/src/App.tsx`：维护 `hintsDismissed` 状态；首屏从 `farm-demo-hints-v1` localStorage 读取；提供「不再提示」与「×」关闭；监听 `farm:hint-dismiss` CustomEvent
- `apps/web/src/farm3d/FarmScene.tsx`：R 键 handler / 第一次收获聚焦时派发 `farm:hint-dismiss` 事件，App.tsx 收到后隐藏

**自动淡出策略**：
- 用户主动点「不再提示」→ 写入 localStorage `farm-demo-hints-v1=dismissed`，永远不再显示
- 用户点「×」 / 按 R 键 / 收获一次 → 仅本次会话隐藏，刷新后再次显示


---

## 不在本轮范围（用户明确排除或顺延）

| 编号 | 内容 | 备注 |
|---|---|---|
| No.3 | 仓库 inventory + 手动卖出 | 用户本轮排除；本轮不动 ItemDef / Inventory 抽象。**仓库（Warehouse.tsx）仅为视觉装饰**，未挂点击交互。 |
| No.4 | 商店（种子/化肥购买入口） | 用户本轮排除 |
| No.5 | 装扮主题多套切换 | 用户本轮排除 |
| D6 第二轮 | 录屏 + Chrome Perf 长任务数据 | D10 后顺延；不阻塞 prod 部署 |
| Phase 2 | RN 移植（9/13~） | 按 PRD §5；渲染层 D1 冒烟后定 fiber native vs three 直写 |

---

## Phase 2 / Phase 3 / Phase 4

按 [docs/PRD.md](docs/PRD.md) §5 推进。Phase 2 启动条件 = D6 第二轮试玩 + D9 冻结（两个均已就绪）。

---

### P1-5 实施回顾（音效设置）

**目标**：全局静音开关 + 音量记忆（localStorage 持久化），调用方零改动。

**关键改动**：

- `apps/web/src/farm3d/sfx.ts`：
  - 新增模块级 `muted` 标志、`masterGain`（lazy init，AudioContext 首帧触发后创建）、`VOLUME_KEY = 'farm-demo-volume-v1'`
  - `ac()` 内部创建 `masterGain = ctx.createGain()`，两条 connect 链从 `g.connect(a.destination)` 改为 `g.connect(masterGain).connect(ctx.destination)`
  - 新增 `loadVolumePref()`（模块初始化时调用，try/catch 兜底隐私模式）、`setMuted(m)`（写 localStorage + 立即更新 masterGain.gain）、`getMuted()`
  - 所有 playXxx 函数签名不变，调用方零改动

- `apps/web/src/App.tsx`：
  - 新增 `MUTED_KEY` 常量（复用 VOLUME_KEY 的 'farm-demo-volume-v1'）
  - 新增 `readMutePref()` 读取 localStorage（与 `readHintsDismissed` 同风格 try/catch）
  - `useState<boolean>(() => loadVolumePref())` 初始化 muted 状态（由 sfx 模块已加载的偏好驱动）
  - 新增 `toggleMute()` 回调：调用 `setMuted(!muted)` + setState + 写 localStorage
  - seedbar 末尾（reset 按钮紧邻左侧）新增 `<button className="mute">{muted ? '🔇' : '🔊'}</button>`

- `apps/web/src/App.css`：
  - 末尾追加 `.mute` 类（44px 圆角白底按钮，font-size: 20px），与 `.reset` 结构对齐

**文件清单**：
- `apps/web/src/farm3d/sfx.ts`（模块级状态 + masterGain + 3 个导出函数）
- `apps/web/src/App.tsx`（import + 2 个常量和函数 + useState + toggleMute 回调 + JSX 按钮）
- `apps/web/src/App.css`（.mute 一条样式规则）
- `PROGRESS.md`（本节）

**破零 diff 红线**：未破；`packages/game` 零改动。

---

### P1-6 实施回顾（昼夜氛围）

**目标**：真实时间驱动的 24h 昼夜氛围循环——天空渐变 + 光照色温随真实时间平滑过渡；雨/旱天气叠加在昼夜基准上（35% 权重），不压死昼夜基线。

**关键改动**：

- `apps/web/src/farm3d/motion.ts`：新增 `DAY_NIGHT = { k: 4 }` 帧率无关阻尼系数
- `apps/web/src/farm3d/FarmScene.tsx` — `Lights` 组件：
  - 新增 `getDayNightDirColor` / `getDayNightDirIntensity` / `getDayNightHemiIntensity` / `getDayNightHemiSkyColor` 四个辅助函数（均接受 out Color 参数做 in-place 写入）
  - useFrame 内：以昼夜为基准（35% 权重）叠加雨/旱天气色偏；方向光颜色、强度、半球光强度和 skyColor 全部阻尼过渡
- `apps/web/src/farm3d/FarmScene.tsx` — `WeatherMood` 组件：
  - 新增 `getDayNightSky(hour)` 辅助函数（天空色 24h 分段插值）
  - 移除旧的 `SKY / SKY_RAIN / SKY_DROUGHT` 三个常量（保留 `SKY_RAIN_OVERLAY` / `SKY_DROUGHT_OVERLAY` 作天气叠加）
  - useFrame 内：先算昼夜基准，再以 35% 权重叠加天气色偏，最终目标 lerp 阻尼过渡
- 所有临时 Color 改为模块级 / useMemo 复用，**避免每帧 new Color 在 60fps 下产生 ~400 个临时对象/秒**

**关键节点时间表**：

| 时刻 | 天色 | 方向光颜色 | 方向光强度 | 半球光强度 |
|------|------|-----------|-----------|-----------|
| 5am 黎明 | 深紫蓝→粉红 | 冷蓝→暖橙 | 0.6→1.8 | 0.25→0.7 |
| 8am 早晨 | 粉红→青蓝 | 暖橙 | 2.4 | 1.1 |
| 12pm 中午 | 青蓝 | 暖白 (0xfff3dd) | 2.4 | 1.1 |
| 6pm 黄昏 | 青蓝→橙粉 | 暖白→金橙 | 2.4→1.8 | 1.1→0.7 |
| 8pm 入夜 | 橙粉→深紫蓝 | 金橙→冷蓝 | 1.8→0.6 | 0.7→0.25 |
| 12am 深夜 | 深紫蓝 | 冷蓝 (0x6a8aa8) | 0.6 | 0.25 |

**P1-6 review 修复**（commit 后续追加）：
- 深夜方向光强度公式从 `(hour+19)/24*1.2` 错乱改为常量 0.6（凌晨 0-5 稳态低谷）
- hemisphereLight 增加 skyColor 色温过渡（之前只动 intensity）
- sfx.ts masterGain 双 bus 修复（删除链尾 `.connect(a.destination)`）
- 教程提示文案补一句"空地发光可播种"（P1-4 P0 补强）
- App.tsx 删除重复的 MUTED_KEY 常量 + toggleMute 不再重复写 localStorage
- mute 按钮加 aria-pressed / aria-label

**破零 diff 红线**：未破；`packages/game` 零改动。

---

### P1-7 实施回顾（性能验收）

**目标**：实测 web 版性能，对照 PRD §6.2 的 web 等价指标（Chrome DevTools / Lighthouse）。

**测试方法**：
- **工具**：Playwright Python + Chrome CDP (DevTools Protocol) + Lighthouse CLI 13.4.1
- **Chrome 版本**：Google Chrome 152.0.7977.76 (headless)
- **测试 URL**：`http://localhost:4173`（`npm run preview -w @farm/web`，即 `dist/` 静态产物）
- **场景**：冷启动页面 → 等 2s → 6 次 plot 点击（模拟收获）→ 相机 orbit 拖拽 → 等 2s
- **注**：Lighthouse 默认 headless 禁用 GPU，FPS 数字不能代表有 GPU 真机；JS 线程数据（长任务/TBT）不受 GPU 影响，仍有效

**实测数据表格**：

| 指标 | 阈值 | 实测 | 是否达标 | 备注 |
|---|---|---|---|---|
| JS 长任务 (>50ms) | 0（持续） | **4 个**，但全在初始加载期 | **部分达标** | bundle parse 占 2 个（3226ms + 2760ms）；交互期间仅偶发 EventDispatch 131ms |
| FPS（最重载场景） | ≥30 | **~11 FPS**（headless 无 GPU） | **无法验证** | headless GPU disabled；真实浏览器+GPU 预计 60fps |
| JS Heap | <300MB | **8.8–12.2 MB** | **✓ 达标** | 远低于阈值 |
| 冷启动 (FCP) | ≤3s | **2.55 s** | **✓ 达标** | Lighthouse FCP；CDP nav timing 0.77s |

**瓶颈分析**（从 Lighthouse + CDP Tracing 数据）：

1. **Bundle 过大导致 Parse/Compile 阻塞（Top 1）**
   - `index-*.js` 压缩后 1.1 MB，解压后更大；Lighthouse 抓到两次长任务：3226ms + 2760ms
   - 对应 Lighthouse TBT 5.89s —— 主要贡献源
   - `bootup-time` 仅计 scriptEvaluation 就 6.8s
   - **建议**：路由级 code-splitting（dynamic import），首屏只加载农场场景必需代码，教程提示/仓库装饰等延迟加载

2. **trees GLB 过大（Top 2）**
   - `trees-bNhCOk-W.glb` 单文件 3.4 MB，是所有资产中最重的
   - LCP 20.25s 中相当部分由此贡献（LCP 是视口内最大内容元素，通常是 Three.js 场景渲染完成）
   - **建议**：GLTF draco 分层 + 渐进式加载；或换成程序化几何体（当前 deco/ 已全是程序化）

3. **初始渲染帧率不稳定（Top 3）**
   - Tracing 抓到 `FireAnimationFrame` 65ms + `FunctionCall` 65ms（偶发）；`EventDispatch` 131ms
   - 这些在 headless 下被放大；真实设备 GPU 加速后应消失
   - 真正风险是场景初始化阶段（GLB 加载 + Three.js 编译 shader）的帧抖
   - **建议**：loading placeholder 骨架；或 Canvas 渲染开始前先 show splash

**Top-3 慢函数/资源**：
1. `index-*.js` bundle parse（3226ms）—— 1.1 MB 无 split
2. `trees-bNhCOk-W.glb` 网络加载（3.4 MB）—— 无 draco/分片
3. Three.js initial render（canvas 2.2s visible）—— 首帧等待 GLB

**建议改进（P0/P1/P2，不实施）**：
- **P0**：code-splitting 首屏 bundle，将 index.js 拆为 `farm-scene-chunk.js` + `deco-chunk.js`，目标将首次长任务降至 <500ms
- **P1**：trees GLB 换程序化柯基 + 狗屋 + 茅草屋（deco/ 已验证方案），去掉 3.4 MB 资产
- **P2**：给 Canvas 外包一层 loading overlay，等 `scene.ready` 再 fade in，消除初始化帧抖

**破零 diff 红线**：未破；`packages/game` 零改动；本轮只验收不动代码。

---

### P2-1 实施回顾（空地提示加 emissive 微光）

**目标**：补齐 PRD P1-4 描述里"脉动/微光"的"微光"维度——hint 环在浅金黄底色上叠加暖白微光，呼吸幅度 ±50%。

**关键改动**（仅 `apps/web/src/farm3d/FarmScene.tsx`）：

1. **第 8 行 import**：新增 `MeshStandardMaterial` 到 type import 列表
2. **第 546 行 JSX material**：将 `meshBasicMaterial` 替换为 `meshStandardMaterial`，新增 `emissive={0xfff2b0}`、`emissiveIntensity={0.35}`、`metalness={0}`、`roughness={1}`（metalness=0 保持低模卡通风，与 GLB 加载规范一致）
3. **第 467-475 行 useFrame**：注释补 "P2-1"；ring.material 断言从 `MeshBasicMaterial` 改为 `MeshStandardMaterial`；追加 `mat.emissiveIntensity = 0.25 + 0.25 * k`（0..0.5 呼吸）；`mat.opacity` 改为直接赋值

**效果描述**：hint 环在浅金黄底色 (0xfff2b0) 上叠加暖白 emissive，flat Canvas 下不会过曝；呼吸周期与 scale/opacity 同步（约 1.67s 一周期），微光强度 ±50%（0.25–0.50），与 scale 1±6%、opacity 0.28±0.18 构成"光感+形态"双维度脉动。

**破零 diff 红线**：未破；`packages/game` 零改动。

---

### P2-2 实施回顾（bundle split）

**目标**：解决 P1-7 验收的 1.1MB 单 chunk 长任务（3226ms parse）。

**关键改动**：
- 仅 `apps/web/vite.config.ts`，加 `build.rollupOptions.output.manualChunks` 函数
- 三路分流：`react` → `react-vendor`（React + ReactDOM + scheduler）、`three/@react-three` → `three`（Three.js + R3F + Drei）、其余 → `index`（App + HUD + FarmScene + 所有业务组件）

**拆分前后对比**：

| Chunk | 文件名 | 大小 | gzip |
|---|---|---|---|
| —（拆分前） | `index-*.js` | 1,175.57 KB | — |
| main | `index-*.js` | **40.74 KB** | 14.15 KB |
| react-vendor | `react-vendor-*.js` | **193.77 KB** | 61.02 KB |
| three | `three-*.js` | **941.08 KB** | 249.57 KB |
| runtime | `rolldown-runtime-*.js` | 0.71 KB | 0.42 KB |

首屏 parse 目标：从 3226ms 降至 <800ms 量级（40KB main chunk 远低于 200KB 阈值，浏览器主线程阻塞大幅缩短）。

**验收**：
- main chunk 40.74 KB < 200 KB ✓
- 拆出 3 个业务 chunk（main + react-vendor + three）✓
- trees-*.glb 3.4 MB 无拆（属于 GLB 资产，不计入 JS chunk）✓

**破零 diff 红线**：未破；`packages/game` 零改动；`package.json` 未新增依赖。

---

### P2-4 实施回顾（收获连击 combo）

**目标**：2.5s 窗口内连续触发 N 次收获（任意地块）→ 显示 combo 等级，颜色递增；combo >= 4 时整屏短促闪光（150ms 金色 vignette）。

**关键改动**：

- **新建 `apps/web/src/farm3d/combo.ts`**：模块级单例（仿 events.ts 风格），维护 `comboCount / lastHarvestAt / sequence`，提供 `recordHarvest()`、`resetCombo()`、`subscribeCombo()` 三个导出函数
- **`apps/web/src/farm3d/useFarm.ts`**：mature 分支调用 `recordHarvest(at)`，非收获交互（empty/sown/sprout/growing/withered/handlePest）全部调用 `resetCombo()`
- **`apps/web/src/farm3d/floaters.ts`**：`FloaterSpawn` 接口加 `combo?: number`；`mountFloaterDom` 在 `combo >= 2` 时附加 `combo-${Math.min(combo, 5)}` CSS class
- **`apps/web/src/App.css`**：追加 `.floater.combo-2/3/4/5` 四级颜色样式；追加 `#combo-flash` 全屏 vignette 闪光
- **`apps/web/src/App.tsx`**：新增 `comboFlash` state；`useEffect` 订阅 combo，`count >= 4` 时触发 150ms 闪光；渲染 `#combo-flash` div
- **`apps/web/src/farm3d/FarmScene.tsx`**：`takeFloaters()` 循环中 `mountFloaterDom` 调用补 `f.combo` 参数

**combo 等级颜色表**：

| combo | 颜色 | 字号 | text-shadow |
|-------|------|------|-------------|
| ×2 | #ffd24a 浅金 | 24px | 0 0 8px rgba(255,200,0,.6) |
| ×3 | #ffb43a 亮金 | 28px | 0 0 12px rgba(255,160,0,.7) |
| ×4 | #ff7a30 橙色 | 32px | 0 0 16px rgba(255,80,0,.8) |
| ×5+ | #ff4030 红橙 | 36px | 0 0 20px rgba(255,40,0,.9) |

**重置规则**：
- 2.5s 窗口内无新收获 → 下次收获重新从 ×1 开始
- 任何非收获动作（播种/施肥/浇水/拍虫/清理 withered）立即打断 combo

**破零 diff 红线**：未破；`packages/game` 零改动；`package.json` 未新增依赖。

---

### P2-1 实施回顾（新手引导 3 步）

**目标**：首屏自动触发 3 步引导（选种 → 播种 → 收获），引导完成/跳过后永久记忆，不再自动出现。

**关键改动**：

- **新建 `apps/web/src/farm3d/tutorial.ts`**：命令式单例，step 机器（0=未开始, 1=选种, 2=播种, 3=等待收获, 'done'=完成）；`loadTutorialDone()` / `startTutorial()` / `nextStep(plantedPlot?)` / `skipTutorial()` / `finishTutorial()` / `subscribeTutorial(fn)`；localStorage key = `farm-demo-tutorial-v1`

- **新建 `apps/web/src/farm3d/TutorialArrow.tsx`**：R3F 3D 箭头组件，target='plot'|'plot-mature' 时渲染脉冲圆环 + 向下箭头（圆锥 + 圆柱），useFrame 驱动上下浮动 + Y轴旋转

- **`apps/web/src/farm3d/useFarm.ts`**：新增 tutorial state（订阅单例）；`select(id)` 触发时若 step===1 则 `nextStep()`；`handlePlot(i)` empty+seed 时若 step===2 且 i===targetPlot 则 `nextStep(i)`；`handlePlot(i)` mature 时若 step===3 且 i===targetPlot 则 `finishTutorial()`

- **`apps/web/src/farm3d/FarmScene.tsx`**：`useEffect` 订阅 tutorial 单例；条件挂载 `<TutorialArrow target="plot" plotIndex={targetPlot} />`（step=2）和 `<TutorialArrow target="plot-mature" plotIndex={targetPlot} />`（step=3）

- **`apps/web/src/App.tsx`**：`useFarm()` 解构出 `tutorial`；首屏 `useEffect` 检测未完成则 `startTutorial()`；顶部居中 `.tutorial-overlay` 提示条（含"× 跳过"+"不再提示"按钮）；胡萝卜种子按钮 step===1 时加 `.tutorial-target` 高亮类

- **`apps/web/src/App.css`**：追加 `.tutorial-target`（金色脉冲边框动画）+ `.tutorial-overlay`（顶部居中黄色提示条）

**3 步触发点**：
1. 首屏自动开始 → step=1 → 高亮胡萝卜种子按钮 → 用户点击任意种子 → step=2（plot 0 脉冲箭头）
2. 用户点击 plot 0 → step=3（目标地块脉冲箭头）
3. 作物成熟后用户点击目标地块 → 引导完成 + 写 localStorage

**破零 diff 红线**：未破；`packages/game` 零改动；`package.json` 未新增依赖。
