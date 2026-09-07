// GLB 资产 URL（vite ?url 导入，构建时自动 hash 进产物）。
// 模型本体与授权记录在 packages/assets（全部 CC0，见 ASSETS.md）。
// Dog / Cottage 使用程序化几何体（poly.pizza 模型页 404，GLB 待补充）。
import carrotUrl from '@farm/assets/models/carrot.glb?url'
import cornUrl from '@farm/assets/models/corn.glb?url'
import dirtUrl from '@farm/assets/models/farm-dirt.glb?url'
import fenceUrl from '@farm/assets/models/fence.glb?url'
import dogUrl from '@farm/assets/models/dog.glb?url'
import cottageUrl from '@farm/assets/models/cottage.glb?url'

export const ASSETS = {
  carrot: carrotUrl,
  corn: cornUrl,
  dirt: dirtUrl,
  fence: fenceUrl,
  dog: dogUrl,
  cottage: cottageUrl,
} as const
