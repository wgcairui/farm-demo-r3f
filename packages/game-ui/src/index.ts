// 跨端共享辅助层（game-ui 包）。
//
// 包边界：
// - packages/game   状态机/数值/类型（game 包红线，零改动）
// - packages/game-ui 渲染无关辅助（motion/landState/events/time/...）
//                  + 跨端视图组件（PlotView/HudTopBar/...）
//                  + RendererAdapter 接口（Cocos/Skia 各实现一次）
// - apps/minigame / apps/web / apps/mobile 各自渲染壳
//
// 当前阶段（M1.5）只导出 motion + landState。
// M2 阶段扩 events / time / forecast / decorations / tutorial / combo
//   + renderer adapter + 视图组件。

export * from './motion'
export * from './landState'