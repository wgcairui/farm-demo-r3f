// D5 动画规范：过渡动画只用三档时长 + 浮字可读档，easing 统一从这里取。
// 例外：生长是持续过程不是过渡，走自己的全程 outCubic（也收口在此，保证全项目只有一个 easing 来源）。
export const DUR = {
  /** 微反馈：金币收尾、数字跳动 */
  fast: 150,
  /** 常规过渡：播种压弹、成熟弹跳 */
  base: 300,
  /** 大动作：收获弹出 */
  slow: 600,
  /** 浮动文字：要留给玩家读出来的时长 */
  linger: 900,
} as const

export const CAMERA = {
  /** 首次进入时的开场运镜时长 */
  introMs: 600,
  /** 收获聚焦的推近与回位总时长 */
  harvestMs: 600,
  /** 收获时相机距离缩短比例 */
  harvestZoom: 0.88,
} as const

export const ease = {
  clamp01: (t: number) => Math.min(1, Math.max(0, t)),
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  /** 0→1→0 钟形：压下去再回来、弹一下再落回，都用它 */
  sinPing: (t: number) => Math.sin(ease.clamp01(t) * Math.PI),
}

// P1-6 昼夜氛围：帧率无关阻尼系数，越小越柔
export const DAY_NIGHT = {
  k: 4,
} as const
