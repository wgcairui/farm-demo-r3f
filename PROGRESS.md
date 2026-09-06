# 进度追踪

本文件沉淀每一轮「批准 → 实施 → 验收」的轨迹。README 顶部只保留一句「当前在哪」，PRD §5 是权威工作步骤拆分，本表是 D 级别 + commit 级别的实时状态。

最近更新：2026-09-06（D7/D8 计划批准，待实施）

---

## 进行中

无。

---

## Phase 0：准备与骨架 ✅ 完成（2026-09-06 复验通过）

- workspaces 改造（apps/web + apps/mobile + packages/game）
- game 包从 2D 基线逐字节抽出，零 diff
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
| D6 | ⏳ 进行中 | 试玩反馈第一轮已落地（进度条/差异化/事件系统）；待第二轮试玩、录屏、Chrome Perf 长任务 | `6b7baf1`、`af39cce`、`ac9b614` |
| **D7** | ⏸ 已批准待实施 | **土地状态机扩展**：PlotState 重构 + 6 状态生命周期 + withered 限时自动恢复；破 `packages/game` 零 diff 红线 | （待） |
| **D8** | ⏸ 已批准待实施 | **田园背景装饰**：狗/路/茅草屋/鱼塘 + 2 个新 CC0 GLB；`farm3d/deco/` 子目录 | （待） |
| D9 | ⬜ 未开始 | 冻结（原 D6 第二轮试玩确认，顺延至此） | — |

### D7 详细计划（已批准，待实施）

**目标**：地块状态机完整生命周期（empty / sown / sprout / growing / mature / withered），withered 限 8s 自动恢复 empty。

**改动**：

1. `packages/game/src/index.ts` 完全重构
   - `Stage` → `PlotState`，新增 `withered`
   - `Plot` 加 `state: PlotState` 与 `witheredAt: number | null`
   - `stageOf()` 改读 `state`（保留时间戳计算路径）
   - 新增 `tickPlot(plot, now)` 推动状态机（withered → empty）
   - 新增 `WITHER_RECOVER_MS = 8_000`
   - 持久化 key 升 `farm-demo-v2`，加 v1 迁移
2. `apps/web/src/farm3d/landState.ts` 新增（视觉色表 + isRecoverable）
3. `apps/web/src/farm3d/events.ts` 新增 `tickPlotStates(plots, now)`
4. `apps/web/src/farm3d/useFarm.ts` `handlePlot` 改 `switch (plot.state)`；收获后 state → withered
5. `apps/web/src/farm3d/FarmScene.tsx` `PlotView` 视觉按 state 分支；新增 `PlotStateTicker` + `WitheredRecoverHint`
6. PRD §3 补 P0-11；README 进度表追加 D7/D8

**自测清单**：

- [ ] 6 块地全流程：empty → sown → sprout → growing → mature → withered → empty（自动 8s）
- [ ] 时钟回拨：withered 计时不倒退（与 stageOf 同一 clamp 哲学）
- [ ] 离线 1 小时回来：地块按时间正确推进，withered 已恢复的不会卡死
- [ ] v1 存档迁移：刷新后地块正常显示
- [ ] `tsc --noEmit` 全仓通过
- [ ] `packages/game` 文档注释更新（破零 diff 红线说明段）

**预计 commit 序列**：

1. `phase 1 D7：packages/game 状态机重构 + web 平台适配 + withered 自动恢复`
2. （如有 v1 迁移回归）单独 fixup

### D8 详细计划（已批准，待实施）

**目标**：田园背景装饰——狗/路/茅草屋/鱼塘，体现「田园生活」氛围。

**改动**：

1. 下载 2 个 CC0 GLB 到 `packages/assets/models/`（poly.pizza / Quaternius 候选：dog + cottage）
2. `packages/assets/ASSETS.md` 补 2 条新资产 + 授权记录
3. `apps/web/src/farm3d/assets.ts` 加 `dog`、`cottage` url
4. 新建 `apps/web/src/farm3d/deco/` 子目录：
   - `Dog.tsx`：沿椭圆 path 巡逻（useGLTF + normalized 管线）
   - `Path.tsx`：程序化石板路（boxGeometry 拼接 + 灰白 lambert）
   - `Cottage.tsx`：单 GLB 模型 `normalized({ width: 2.2 })`，放 `[-3.5, 0, 2.5]`
   - `Pond.tsx`：圆环 ring + 半透明水面 circle + instanced 鱼
   - `index.ts`：`DecoLayer` barrel
   - `motion.ts`：狗巡逻椭圆参数、鱼游动振幅
5. `FarmScene.tsx` 在 `<Suspense>` 内挂载 `<DecoLayer />`
6. PRD §5 加 D8；README 进度表追加

**自测清单**：

- [ ] 狗绕茅草屋巡逻流畅（无帧率抖动）
- [ ] 鱼塘鱼游动（碰到边界反弹）
- [ ] 路面整齐、茅草屋阴影正常
- [ ] 不引 >50ms 长任务（Chrome Perf 复测）
- [ ] 新 GLB 加载走 normalized 管线，metalness=0 / flat tone mapping 兼容
- [ ] `tsc --noEmit` 全仓通过

**预计 commit 序列**：

1. `phase 1 D8：田园背景装饰——狗/路/茅草屋/鱼塘（deco/ 子目录）`

---

## 不在本轮范围（用户明确排除）

| 编号 | 内容 | 备注 |
|---|---|---|
| No.3 | 仓库 inventory + 手动卖出 | 用户本轮排除；本轮不动 ItemDef / Inventory 抽象 |
| No.4 | 商店（种子/化肥购买入口） | 用户本轮排除 |
| No.5 | 装扮主题多套切换 | 用户本轮排除 |

---

## Phase 2 / Phase 3 / Phase 4

按 [docs/PRD.md](docs/PRD.md) §5 推进。Phase 2 启动条件 = D9 冻结。
