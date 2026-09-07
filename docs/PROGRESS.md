# farm-demo 进度记录

## P1-6 实施回顾（昼夜氛围）

### 目标
真实时间驱动的 24h 昼夜氛围循环：天空渐变 + 光照色温随真实时间平滑过渡，雨/旱天气叠加在昼夜基准上（35% 权重），不压死昼夜基线。

### 关键改动

**`apps/web/src/farm3d/motion.ts`**
- 新增 `DAY_NIGHT = { k: 4 }` 常量，帧率无关阻尼系数

**`apps/web/src/farm3d/FarmScene.tsx` — `Lights` 组件**
- 新增 `getDayNightDirColor(hour)` / `getDayNightDirIntensity(hour)` / `getDayNightHemiIntensity(hour)` 三个辅助函数
- useFrame 内：以昼夜为基准（35% 权重）叠加雨/旱天气色偏；方向光颜色和强度均阻尼过渡

**`apps/web/src/farm3d/FarmScene.tsx` — `WeatherMood` 组件**
- 新增 `getDayNightSky(hour)` 辅助函数（天空色 24h 分段插值）
- 移除旧的 `SKY / SKY_RAIN / SKY_DROUGHT` 常量
- useFrame 内：先算昼夜基准，再以 35% 权重叠加天气色偏，最终目标 lerp 阻尼过渡

### 关键节点时间表
| 时刻 | 天色 | 方向光颜色 | 方向光强度 | 半球光强度 |
|------|------|-----------|-----------|-----------|
| 5am 黎明 | 深紫蓝→粉红 | 冷蓝→暖橙 | 0.6→1.8 | 0.25→0.7 |
| 8am 早晨 | 粉红→青蓝 | 暖橙 | 2.4 | 1.1 |
| 12pm 中午 | 青蓝 | 暖白 (0xfff3dd) | 2.4 | 1.1 |
| 6pm 黄昏 | 青蓝→橙粉 | 暖白→金橙 | 2.4→1.8 | 1.1→0.7 |
| 8pm 入夜 | 橙粉→深紫蓝 | 金橙→冷蓝 | 1.8→0.6 | 0.7→0.25 |
| 12am 深夜 | 深紫蓝 | 冷蓝 (0x6a8aa8) | 0.6 | 0.25 |

### 破零 diff 红线
未破；`packages/game` 零改动。
