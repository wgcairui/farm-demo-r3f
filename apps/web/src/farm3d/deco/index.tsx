// deco/ barrel：田园背景装饰层。
// 挂载到 <Suspense> 内；本文件只负责暴露所有 deco 组件。
import Cottage from './Cottage'
import Dog from './Dog'
import Doghouse from './Doghouse'
import Path from './Path'
import Warehouse from './Warehouse'

export function DecoLayer() {
  return (
    <>
      <Cottage />
      <Doghouse />
      <Dog />
      <Path />
      <Warehouse />
    </>
  )
}

export { Cottage, Dog, Doghouse, Path, Warehouse }
export default DecoLayer
