// 设计 tokens：移动优先（iPhone 15）iOS HIG + Linear 风
// 双轨：CSS :root 同步同名变量（见 App.css），TS 端用这里。
// 未来 RN 移植可直接搬这套常量，省一次设计稿翻译。

export const COLOR = {
  /** iOS 系统灰偏暖一档（#F2F2F7 偏暖） */
  bg: '#F7F7F5',
  /** 卡片 / 药丸底色 */
  surface: '#FFFFFF',
  /** 1px hairline（iOS 标准 0.5pt 等价） */
  border: 'rgba(60, 60, 67, 0.12)',
  /** 主要文字：iOS label */
  textPrimary: '#1C1C1E',
  /** 次要文字：iOS labelSecondary */
  textSecondary: 'rgba(60, 60, 67, 0.6)',
  /** 品牌色：深森林绿，比当前 #4caf50 暗一档，更成熟 */
  accent: '#2E7D32',
  /** active state 背景 */
  accentSoft: 'rgba(46, 125, 50, 0.08)',
  /** 金币色 */
  gold: '#B8860B',
  /** withered / pest */
  danger: '#C62828',
  /** rain 事件 */
  info: '#1565C0',
} as const

export const FONT = {
  family:
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif',
  monoFamily:
    '"SF Mono", ui-monospace, "Roboto Mono", "Helvetica Neue", monospace',
} as const

/** 6 档字阶（SF Pro iOS 风格） */
export const TYPE = {
  caption: 11, // t11
  small: 13, // t13 - 按钮副文、weather 文本
  body: 15, // t15
  button: 17, // t17 - iOS 标准按钮字号
  title: 22, // t22
  display: 34, // t34 - 金币大数字
} as const

/** 4 网格 */
export const SPACE = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s7: 32,
  s8: 48,
} as const

/** 圆角 */
export const RADIUS = {
  sm: 8, // r8
  md: 12, // r12 - 卡片
  lg: 16, // r16 - 抽屉、模态
  pill: 9999,
} as const

/** HUD 尺寸（iPhone 15 portrait = 393×852pt） */
export const HUD = {
  topBarHeight: 44,
  bottomBarHeight: 58,
  /** 最小命中区（HIG） */
  hitTarget: 44,
  /** 按钮间最小间距（防误触） */
  buttonGap: 12,
} as const

/** z-index 栈 */
export const Z = {
  canvas: 0,
  decoGrid: 4,
  comboFlash: 4,
  floatRoot: 5,
  hints: 6,
  weatherTop: 7,
  eventBanner: 7,
  tutorial: 7,
  sheetMask: 90,
  sheetContent: 100,
} as const
