// 全局卡通材质工具：toon gradient texture、MeshToonMaterial 工厂、inverted-hull 描边。
//
// D12 第五轮：web 端升级到卡通渲染（面试 demo 不再走 Phase 2 移植，
// 故不考虑 mobile 性能约束）。三件套：
//   1. toon gradient texture（3 色阶柔和，gradientMap 给 MeshToonMaterial）
//   2. toon(opts) 工厂：等价 MeshLambertMaterial + color, transparent, opacity
//   3. attachOutline(mesh, scale?)：复制 mesh 反向法线 + BackSide 黑色描边
//
// 描边算法是 inverted hull：原始 mesh 用 FrontSide，复制品用 BackSide，
// 沿法线 scale 1.03。box 几何的顶点法线方向不一致时会出现"接缝"，
// 但本场景所有 box 都是轴对齐（无旋转几何），实际效果稳定。
import {
  BackSide,
  DataTexture,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshToonMaterial,
  NearestFilter,
  RGBAFormat,
  UnsignedByteType,
} from 'three'

/** 3 色阶柔和 toon gradient：暗 0.4 / 中 0.75 / 亮 1.0 */
const GRADIENT_DATA = new Uint8Array([
  100, 100, 100, 255,    // 暗 (idx 0)
  190, 190, 190, 255,    // 中 (idx 1)
  255, 255, 255, 255,    // 亮 (idx 2)
])

let _gradientTex: DataTexture | null = null

/** 共享 toon gradient texture，3 色阶柔和（NearestFilter 保留硬边感） */
export function toonGradient(): DataTexture {
  if (_gradientTex) return _gradientTex
  // 3x1 RGBA：暗/中/亮三色阶
  const tex = new DataTexture(GRADIENT_DATA, 3, 1, RGBAFormat, UnsignedByteType)
  tex.minFilter = NearestFilter
  tex.magFilter = NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  _gradientTex = tex
  return tex
}

export interface ToonOpts {
  color?: number | string
  transparent?: boolean
  opacity?: number
  /** emissive 颜色，常亮（hint ring / hover 高亮等需要无视光照的元素） */
  emissive?: number | string
  emissiveIntensity?: number
  /** 保留与 Lambert 完全相同的视觉（无 gradientMap）—— 给 flat 装饰元素用 */
  flat?: boolean
}

/** 等价 MeshLambertMaterial + toon gradient 的快捷工厂 */
export function toon(opts: ToonOpts = {}): MeshToonMaterial {
  const mat = new MeshToonMaterial({
    color: opts.color ?? 0xffffff,
    gradientMap: opts.flat ? null : toonGradient(),
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  })
  if (opts.emissive !== undefined) {
    mat.emissive.set(opts.emissive)
    mat.emissiveIntensity = opts.emissiveIntensity ?? 1
  }
  return mat
}

// —— Inverted Hull 描边 ——
//
// 每个需要描边的 mesh 复制一份原始几何 + 应用纯黑 BackSide material，
// 沿原 mesh 的局部坐标 scale 1.03 形成"外扩黑色壳"——从相机看就是轮廓线。
//
// 限制：
//   - 必须传原始 mesh（带 .geometry 引用），不能传 Group；需要在 traverse 调用
//   - 复制品会随原 mesh 的 transform（position/rotation/scale）一起变换——
//     我们直接 addChild 到原 mesh，附加的轮廓跟随原 mesh 移动
//   - 棱角分明 box 在 scale 后会出现"对角线缝隙"，但本场景所有 box 都是轴对齐，
//     几何顶点法线方向一致，无此问题
//   - 描边颜色：纯黑 0x111111（与卡通风格匹配）
const OUTLINE_MAT = new MeshBasicMaterial({
  color: 0x111111,
  side: BackSide,
  // 不写 depth offset，因为内壳本身就是 BackSide 渲染，会被正壳挡住
})

/**
 * 给一个 mesh 附加 inverted-hull 描边壳。
 * 直接 addChild 到 mesh 上，返回新增的轮廓 mesh（也方便上层 traverse 找到）。
 * scale 默认 1.03（外扩 3%，细描边）。
 */
export function attachOutline(mesh: Mesh, scale = 1.03): Mesh {
  const shell = new Mesh(mesh.geometry, OUTLINE_MAT)
  shell.scale.setScalar(scale)
  shell.castShadow = false
  shell.receiveShadow = false
  mesh.add(shell)
  return shell
}

/**
 * 批量给 Group / Mesh 子树附加描边。
 * 跳过已有 _outlined 标记的 mesh（避免重复）。
 * 跳过 transparent/opacity<1 的 mesh（描边会盖住透明部分）。
 */
export function attachOutlineDeep(root: { traverse: (cb: (o: object) => void) => void }, scale = 1.03) {
  root.traverse((obj) => {
    const m = obj as Mesh & { _outlined?: boolean }
    if (!m.isMesh) return
    if (m._outlined) return
    const mat = m.material as MeshLambertMaterial | MeshToonMaterial | undefined
    if (mat && ('transparent' in mat) && mat.transparent) return
    if (m.geometry && m.geometry.attributes.position) {
      attachOutline(m, scale)
      m._outlined = true
    }
  })
}

/** 测试/调试用：判断当前 toon 模块是否已被加载 */
export const _internals = { GRADIENT_DATA, OUTLINE_MAT }