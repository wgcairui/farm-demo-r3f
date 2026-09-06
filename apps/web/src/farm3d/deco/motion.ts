// 田园装饰动画参数：鱼游动振幅。
// D8 polish 后 Dog 改为静态蹲姿，不再巡逻，故删 DOG_PATH。

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
