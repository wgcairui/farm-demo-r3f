// deco/ barrel：田园背景装饰层。
// D7 agent 完成 FarmScene 改造后，会将此 barrel 挂载到 <Suspense> 内。
// 本文件不负责挂载，只负责暴露所有 deco 组件。
import Cottage from './Cottage'
import Dog from './Dog'
import Path from './Path'
import Pond from './Pond'

export function DecoLayer() {
  return (
    <>
      <Cottage />
      <Dog />
      <Path />
      <Pond />
    </>
  )
}

export { Cottage, Dog, Path, Pond }
export default DecoLayer
