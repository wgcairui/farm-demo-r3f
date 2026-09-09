// 微信小游戏存储后端适配。
// Cocos Creator 编译到 wechatgame 平台后，全局对象 `wx` 由引擎注入。
// 这里只做"读/写"的最小封装，给 @farm/game 的 load/save 注入。
//
// 同步 API 选择：wx.getStorageSync 返回值就是 string | undefined，
// 强制返回 string | null 让 StorageBackend 契约更干净。

import type { StorageBackend } from '@farm/game'

declare const wx: {
  getStorageSync(key: string): string | undefined
  setStorageSync(key: string, data: string): void
}

export function createWxStorageBackend(): StorageBackend {
  return {
    getItem(key) {
      try {
        const v = wx.getStorageSync(key)
        return typeof v === 'string' ? v : null
      } catch {
        return null
      }
    },
    setItem(key, value) {
      try {
        wx.setStorageSync(key, value)
      } catch {
        // 写入失败一般是因为存储配额；M1 阶段静默吞掉即可
      }
    },
  }
}
