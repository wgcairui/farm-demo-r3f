# 进度追踪

本文件沉淀每一轮「批准 → 实施 → 验收」的轨迹。README 顶部只保留一句「当前在哪」，PRD §5 是权威工作步骤拆分，本表是 D 级别 + commit 级别的实时状态。

最近更新：2026-09-07（D7~D12 全部完成；D12 视觉收尾与线上验证完成）

---

## 当前状态

**Phase 1 D7~D12 全部完成**，prod 单线部署：Vercel CDN。

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
