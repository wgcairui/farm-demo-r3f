// 移动优先底部抽屉组件（iOS HIG modal sheet 风格）
// 用法：<BottomSheet open onClose title="...">...</BottomSheet>
// 交互：
//   - 点击遮罩关闭
//   - 按下 handle 下滑关闭（8px 阈值 + velocityY > 0.3）
//   - ESC 关闭（保留键盘可达性）
// 设计目标：与 designTokens.ts / App.css 同源，CSS 类名 sheet-* / sheet-mask

import { useEffect, useRef, type ReactNode } from 'react'

export interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children?: ReactNode
}

export function BottomSheet({ open, onClose, title, subtitle, children }: BottomSheetProps) {
  // drag-to-close：仅 handle 区触发，body 内容滚动不冲突
  const dragRef = useRef<{ startY: number; lastY: number; lastT: number; velY: number } | null>(null)
  const sheetRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const onHandleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragRef.current = { startY: e.clientY, lastY: e.clientY, lastT: performance.now(), velY: 0 }
  }
  const onHandleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    const now = performance.now()
    const dy = e.clientY - d.lastY
    const dt = Math.max(1, now - d.lastT)
    d.velY = dy / dt // px/ms
    d.lastY = e.clientY
    d.lastT = now
    // 视觉跟随：translateY 但 clamp >= 0（避免上滑把 sheet 推走）
    const totalDy = e.clientY - d.startY
    if (totalDy > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${totalDy}px)`
    }
  }
  const onHandleUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    dragRef.current = null
    if (sheetRef.current) sheetRef.current.style.transform = ''
    if (!d) return
    const totalDy = e.clientY - d.startY
    // 关闭阈值：超过 8px 位移 或 向下速度 > 0.3 px/ms
    if (totalDy > 80 || d.velY > 0.3) onClose()
  }

  return (
    <>
      <div className="sheet-mask" onClick={onClose} role="presentation" />
      <div className="sheet" ref={sheetRef} role="dialog" aria-modal="true">
        <div
          className="sheet-handle"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          role="presentation"
        />
        <div className="sheet-body">
          {title && <h2 className="sheet-title">{title}</h2>}
          {subtitle && <p className="sheet-subtitle">{subtitle}</p>}
          {children}
        </div>
      </div>
    </>
  )
}
