// 微信小游戏全局 API 类型 stub（CLI tsc 校验用）。
// 实际运行时由 wx 全局注入（game.js bootstrap 不需要这个文件）。

declare const wx: {
  createCanvas(): {
    width: number
    height: number
    getContext(type: '2d'): CanvasRenderingContext2D | null
  }
  getSystemInfoSync(): {
    windowWidth: number
    windowHeight: number
    pixelRatio: number
  }
  getStorageSync(key: string): string | undefined
  setStorageSync(key: string, value: string): void
  removeStorageSync(key: string): void
  clearStorageSync(): void
  onTouchStart(cb: (e: { touches: Array<{ clientX: number; clientY: number }> }) => void): void
  onTouchMove(cb: (e: { touches: Array<{ clientX: number; clientY: number }> }) => void): void
  onTouchEnd(cb: (e: { changes: Array<{ clientX: number; clientY: number }> }) => void): void
  onTouchCancel(cb: (e: unknown) => void): void
}
