// 田园装饰动画参数：狗巡逻椭圆、鱼游动振幅。
// 这些参数驱动 Dog.tsx 与 Pond.tsx 的 useFrame 动画逻辑。

/** 狗巡逻椭圆参数（相对 cottage 中心） */
export const DOG_PATH = {
  centerX: -3.5,
  centerZ: 2.5,
  radiusX: 1.4,
  radiusZ: 0.7,
  /** 一圈秒数 */
  periodS: 12,
  /** 朝向切线方向 */
  faceTangent: true,
} as const

/** 鱼塘鱼游动振幅 */
export const FISH = {
  count: 4,
  /** 鱼塘中心 */
  centerX: 3.2,
  centerZ: -1.8,
  /** 鱼塘半径 */
  radius: 0.55,
  periodS: 8,
  /** 朝向切线 */
  faceTangent: true,
} as const
