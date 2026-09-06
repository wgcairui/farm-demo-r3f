// GLB 资产加载管线。
// poly.pizza 的模型单位极不统一（同一个包里 0.01 ~ 100 都有），
// 入场前统一"归一化"：按目标高度/宽度重定标、XZ 居中、底面贴 y=0、开阴影。
import { use } from 'react'
import { Box3, Group, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

const loader = new GLTFLoader()
const cache = new Map<string, Promise<GLTF>>()

export function loadGLTF(url: string): Promise<GLTF> {
  const cached = cache.get(url)
  if (cached) return cached
  const p = loader.loadAsync(url)
  cache.set(url, p)
  return p
}

/** Suspense 版读取，全局缓存，多组件共享同一份解析结果 */
export function useGLTF(url: string): GLTF {
  return use(loadGLTF(url))
}

export interface NormalizeOpts {
  /** 目标高度（世界单位） */
  height?: number
  /** 目标最大水平尺寸（世界单位） */
  width?: number
}

/**
 * 从源模型克隆一个"归一化"实例。每次调用都克隆——
 * 同一 Object3D 不能同时挂在场景两个位置，多处摆放必须各自实例化。
 */
export function normalized(src: Object3D, opts: NormalizeOpts): Group {
  const obj = src.clone(true)

  const box = new Box3().setFromObject(obj)
  const size = box.getSize(new Vector3())
  if (opts.height !== undefined || opts.width !== undefined) {
    const target = opts.height ?? opts.width ?? 1
    const current = opts.height !== undefined ? size.y : Math.max(size.x, size.z)
    // multiplyScalar 而非 setScalar：源节点可能自带缩放，直接覆盖会丢比例
    if (current > 1e-6) obj.scale.multiplyScalar(target / current)
  }

  const box2 = new Box3().setFromObject(obj)
  const center = box2.getCenter(new Vector3())
  obj.position.x -= center.x
  obj.position.z -= center.z
  obj.position.y -= box2.min.y

  obj.traverse((o: Object3D) => {
    const m = o as Mesh
    if (m.isMesh) {
      m.castShadow = true
      m.receiveShadow = true
      // Quaternius 导出的 GLB 把 metallicFactor 统一写成 0.4，但没有环境贴图时
      // 金属度会吸走漫反射亮度（画面发黑）。低模卡通风全部按非金属处理。
      // 坑：多 primitive 的 mesh（carrot 本体+缨、trees 树干+叶）material 是数组，
      // 直接对数组赋 metalness 是静默无效的 expando，必须展开。
      const mats = (Array.isArray(m.material) ? m.material : [m.material]) as MeshStandardMaterial[]
      for (const mat of mats) {
        mat.metalness = 0
        mat.roughness = 0.9
      }
    }
  })

  // 包一层 Group：外部对 wrapper 的 position/rotation 不会破坏内部对齐偏移
  const wrapper = new Group()
  wrapper.add(obj)
  return wrapper
}
