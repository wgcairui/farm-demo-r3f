# 进度追踪

本文件沉淀每一轮「批准 → 实施 → 验收」的轨迹。README 顶部只保留一句「当前在哪」，PRD §5 是权威工作步骤拆分，本表是 D 级别 + commit 级别的实时状态。

最近更新：2026-09-06（D7~D10 全部完成 + cc/Vercel 双线部署落地，prod 字节级一致）

---

## 当前状态

**Phase 1 D7~D10 全部完成**，prod 双线部署就位（cc 主站 + Vercel CDN 备用，HTML MD5 + JS bundle 字节级一致）。

- 主站 prod：https://game.ladishb.com/（cc + Docker + nginx 反代）
- Vercel prod：https://farm-demo-gamma.vercel.app

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
