// GLB 资产 URL（vite ?url 导入，构建时自动 hash 进产物）。
// 模型本体与授权记录在 packages/assets（全部 CC0，见 ASSETS.md）。
import carrotUrl from '@farm/assets/models/carrot.glb?url'
import cornUrl from '@farm/assets/models/corn.glb?url'
import dirtUrl from '@farm/assets/models/farm-dirt.glb?url'
import fenceUrl from '@farm/assets/models/fence.glb?url'
import treesUrl from '@farm/assets/models/trees.glb?url'

export const ASSETS = {
  carrot: carrotUrl,
  corn: cornUrl,
  dirt: dirtUrl,
  fence: fenceUrl,
  trees: treesUrl,
} as const
