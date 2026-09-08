// P2-6 天气预报：
//   - 顶部 inline：只显示今日 icon + 温度，点击触发 onOpen 展开完整 sheet
//   - <WeatherSheetBody>：sheet 抽屉内的完整内容（日期 / 5 天 / 6 个快进控件）
// 设计：iPhone 15 顶部 44pt 内只塞一个 32pt 高的药丸，详细内容全部走底部 sheet

import { useEffect, useState } from 'react'
import {
  fastForward,
  getGameDate,
  getGameDay,
  jumpToGameDay,
  jumpToNextRain,
} from './time'
import { getForecast, getIsDrought, type DailyForecast, type WeatherKind } from './forecast'

const WEATHER_ICON: Record<WeatherKind, string> = {
  sunny: '☀️',
  cloudy: '🌤️',
  overcast: '☁️',
  lightRain: '🌧️',
  heavyRain: '⛈️',
  thunder: '⚡',
}

const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 1 秒刷新一次（游戏日 60s，但小时变化是分钟级） */
const TICK_MS = 1000

export interface WeatherForecastProps {
  /** 点击顶部药丸时触发，由 App 接到底部 sheet */
  onOpen: () => void
}

export function WeatherForecast({ onOpen }: WeatherForecastProps) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  const today = getGameDay()
  const todayForecast = getForecast(today)
  const isDrought = getIsDrought()

  return (
    <button
      type="button"
      className={`weather-pill${isDrought ? ' drought' : ''}`}
      onClick={onOpen}
      aria-label="查看天气预报"
    >
      <span className="wf-icon">{WEATHER_ICON[todayForecast.kind]}</span>
      <span className={`wf-temp ${tempColorClass(todayForecast.tempHigh)}`}>
        {todayForecast.tempHigh}°
      </span>
    </button>
  )
}

export function WeatherSheetBody({ onClose }: { onClose: () => void }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  const today = getGameDay()
  const { month, day, hour } = getGameDate()
  const todayForecast = getForecast(today)
  // 3 月 1 日是周五（getDay()=5），用 2024-03-01 锚定 weekdayIdx
  const weekdayIdx = (new Date(2024, 2, 1).getDay() + today) % 7
  const weekday = WEEKDAY[weekdayIdx]

  // 未来 5 天（不含今日）
  const future: DailyForecast[] = []
  for (let d = 1; d <= 5; d++) future.push(getForecast(today + d))

  const dateLabel = `${month}月${day}日 ${weekday} ${String(hour).padStart(2, '0')}:00`
  const tempClass = tempColorClass(todayForecast.tempHigh)

  const runAndClose = (fn: () => void) => () => {
    fn()
    onClose()
  }

  return (
    <>
      <div className="wf-row">
        <span className="wf-day-label">{dateLabel}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="wf-icon" style={{ fontSize: 18 }}>
            {WEATHER_ICON[todayForecast.kind]}
          </span>
          <span className={`wf-day-temp ${tempClass}`}>
            {todayForecast.tempLow}° / {todayForecast.tempHigh}°
          </span>
        </span>
      </div>
      {future.map((f, i) => {
        const wd = WEEKDAY[(weekdayIdx + i + 1) % 7]
        return (
          <div key={i} className="wf-row">
            <span className="wf-day-label">+{i + 1} 天 · {wd}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="wf-icon" style={{ fontSize: 18 }}>
                {WEATHER_ICON[f.kind]}
              </span>
              <span className="wf-day-temp">{f.tempLow}° / {f.tempHigh}°</span>
            </span>
          </div>
        )
      })}
      <div className="sheet-divider" />
      <div className="wf-controls-sheet">
        <button type="button" onClick={runAndClose(() => fastForward(-7))} title="后退 7 天">⏮</button>
        <button type="button" onClick={runAndClose(() => fastForward(-1))} title="后退 1 天">⏪</button>
        <button type="button" onClick={runAndClose(() => fastForward(1))} title="前进 1 天">⏩</button>
        <button type="button" onClick={runAndClose(() => fastForward(7))} title="前进 7 天">⏭</button>
        <button type="button" onClick={runAndClose(() => jumpToNextRain())} title="跳到下一个雨日">💧</button>
        <button type="button" onClick={runAndClose(() => jumpToGameDay(0))} title="回到开局">🏠</button>
      </div>
    </>
  )
}

function tempColorClass(tempHigh: number): string {
  if (tempHigh <= 5) return 'wf-cold'
  if (tempHigh <= 18) return 'wf-cool'
  if (tempHigh <= 28) return 'wf-warm'
  return 'wf-hot'
}
