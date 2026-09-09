// Cocos Creator 入口。挂在 Canvas 节点上，组件启动时建 AppController。
// 注：cc 命名空间由 Cocos Creator 全局注入；编译到 wechatgame 平台后，
// cc.director / cc.Component / cc.Node 都可用。

import { createWxStorageBackend } from './storage'
import { AppController } from './app'

const { ccclass, property } = cc._decorator

@ccclass
export default class Main extends cc.Component {
  app: AppController | null = null

  onLoad() {
    this.app = new AppController(createWxStorageBackend())
    // 暴露到全局方便其他组件访问（与 web useFarm 思路一致：单例状态壳）
    ;(globalThis as unknown as { __farmApp?: AppController }).__farmApp = this.app
  }

  update(_dt: number) {
    this.app?.tick()
  }

  onDestroy() {
    ;(globalThis as unknown as { __farmApp?: AppController }).__farmApp = undefined
  }
}
