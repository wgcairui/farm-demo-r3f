// Cocos Creator 全局类型 stub（CLI tsc 校验用）。
// 真实工程由 Cocos Creator 编辑器提供完整 .d.ts（creator.d.ts / cc.d.ts）。
// 这里只声明视图层实际用到的最小子集，避免代码假阳性出错。

declare module 'cc' {
  export const _decorator: {
    ccclass: (...args: any[]) => any
    property: (...args: any[]) => any
    executeInEditMode: (...args: any[]) => any
  }

  export class Color {
    r: number
    g: number
    b: number
    a: number
    constructor(r?: number, g?: number, b?: number, a?: number)
  }

  export class Vec3 {
    x: number
    y: number
    z: number
    constructor(x?: number, y?: number, z?: number)
  }

  export class UITransform extends Component {
    setContentSize(width: number, height: number): UITransform
  }

  export class Graphics extends Component {
    fillColor: Color
    strokeColor: Color
    lineWidth: number
    fill(): void
    stroke(): void
    clear(): void
    rect(x: number, y: number, w: number, h: number): void
    roundRect(x: number, y: number, w: number, h: number, r: number): void
  }

  export enum HorizontalAlign { LEFT, CENTER, RIGHT }
  export enum VerticalAlign { TOP, CENTER, BOTTOM }

  export namespace Label {
    export const HorizontalAlign: typeof HorizontalAlign
    export const VerticalAlign: typeof VerticalAlign
  }
  export class Label extends Component {
    string: string
    fontSize: number
    color: Color
    horizontalAlign: HorizontalAlign
    verticalAlign: VerticalAlign
    isBold: boolean
  }

  export namespace Node {
    namespace EventType {
      const TOUCH_END: string
      const TOUCH_START: string
      const TOUCH_MOVE: string
    }
  }
  export class Node {
    name: string
    parent: Node | null
    active: boolean
    constructor(name?: string)
    setPosition(x: number, y: number, z?: number): void
    setScale(x: number, y: number, z?: number): void
    addComponent<T extends Component>(ctor: new (...args: any[]) => T): T
    getComponent<T extends Component>(ctor: new (...args: any[]) => T): T | null
    getChildByName(name: string): Node | null
    on(type: string, cb: (...args: any[]) => void, target?: any): void
    off(type: string, cb?: (...args: any[]) => void, target?: any): void
    static EventType: typeof Node.EventType
  }

  export class Component {
    node: Node
    enabled: boolean
    addComponent<T extends Component>(ctor: new (...args: any[]) => T): T
    getComponent<T extends Component>(ctor: new (...args: any[]) => T): T | null
    onLoad?(): void
    onDestroy?(): void
    update?(dt: number): void
    start?(): void
    setPosition(x: number, y: number, z?: number): void
    setScale(x: number, y: number, z?: number): void
  }

  export class EventTouch {
    getCurrentTarget(): Node | null
  }

  const _cc: {
    Component: typeof Component
    Node: typeof Node
    Color: typeof Color
    Graphics: typeof Graphics
    Label: typeof Label
    UITransform: typeof UITransform
    _decorator: typeof _decorator
    view: {
      getDesignResolutionSize(): { width: number; height: number }
      setDesignResolutionSize(width: number, height: number, policy?: number): void
    }
  }
  export default _cc
}

// Cocos 在脚本里也用 `const { ccclass, property } = cc._decorator` 这种解构
declare const cc: {
  _decorator: {
    ccclass: (...args: any[]) => any
    property: (...args: any[]) => any
  }
  Component: any
  Node: any
}
