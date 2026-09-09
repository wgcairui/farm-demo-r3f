// 微信小游戏存储后端。
// 直接桥 wx.getStorageSync/SetStorageSync 到 StorageBackend 接口，
// 让 @farm/game 的 load/save 用与 web 完全相同的 API 读写持久化。

import type { StorageBackend } from '@farm/game'

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
        // 配额耗尽；M1 静默吞掉
      }
    },
  }
}
