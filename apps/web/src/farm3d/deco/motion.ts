// 田园装饰动画参数：鱼游动振幅 + 狗定点踱步振幅/周期。

/** 鱼塘鱼游动振幅 */
export const FISH = {
  count: 2,
  /** 鱼塘中心 */
  centerX: 3.2,
  centerZ: -1.8,
  /** 鱼塘半径（降为背景装饰尺寸） */
  radius: 0.2,
  periodS: 8,
  /** 朝向切线 */
  faceTangent: true,
} as const

/**
 * 狗定点踱步：门口附近 ±ampX 范围来回走，6s 一个往返。
 * 复用现有 useFrame + traverse 模式（与 FISH 同构）。
 * - 位置用 sin：cos>0 走 +x、cos<0 走 -x
 * - 朝向用 cos 微转：cos 切线方向近似 lookAt，避免真切换 rotation.y 造成的硬翻
 * - 腿用错相 π：标准四足 walk 步态（前腿抬时后腿落）
 */
export const DOG_WALK = {
  /** 沿朝向轴的来回幅度（世界单位，对应 ±0.4） */
  ampX: 0.4,
  /** 一个完整往返周期（顺心慢悠悠） */
  periodS: 6,
  /** 前/后腿错相 π（标准四足 walk） */
  legPhaseOffset: Math.PI,
  /** 腿 y 摆幅 */
  legSwingY: 0.025,
  /** 躯干 y 浮幅（同步步频 2×） */
  bodyBobY: 0.012,
  /** 摆头幅度（cos 驱动，叠加在 Math.PI/2 基础朝向上） */
  bodyYaw: 0.35,
  /** 摇尾频率（参数化原 Dog.tsx 的 Math.sin(t*6)） */
  tailHz: 6,
} as const
