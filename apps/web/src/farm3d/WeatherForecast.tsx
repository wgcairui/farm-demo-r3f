// P2-6 天气预报 HUD：顶部单行药丸，显示日期 / 今日天气 / 未来 5 天 / 快进控件
// 与 event-banner 让位：天气预报在 safe+14~50px，banner 下移到 safe+88px

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

/** 1 秒刷新一次（游戏日 60s，分钟级刷新足够，但小时变化是分钟级） */
const TICK_MS = 1000

export function WeatherForecast() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  const today = getGameDay()
  const { month, day, hour } = getGameDate()
  const todayForecast = getForecast(today)
  const isDrought = getIsDrought()
  const weekdayIdx = (new Date(2024, 2, 1).getDay() + today) % 7 // 3 月 1 日是周五 → weekdayIdx=5
  const weekday = WEEKDAY[weekdayIdx]

  // 未来 5 天（不含今日）
  const future: DailyForecast[] = []
  for (let d = 1; d <= 5; d++) future.push(getForecast(today + d))

  const dateLabel = `${month}月${day}日 ${weekday} ${String(hour).padStart(2, '0')}:00`
  const tempClass = tempColorClass(todayForecast.tempHigh)

  return (
    <header className={`weather-forecast${isDrought ? ' drought' : ''}`}>
      <span className="wf-date">{dateLabel}</span>
      <span className={`wf-today ${tempClass}`}>
        <span className="wf-icon">{WEATHER_ICON[todayForecast.kind]}</span>
        <span className="wf-temp">{todayForecast.tempHigh}°/{todayForecast.tempLow}°</span>
      </span>
      <span className="wf-future">
        {future.map((f, i) => (
          <span key={i} className="wf-future-day">
            <span className="wf-future-icon">{WEATHER_ICON[f.kind]}</span>
            <span className="wf-future-temp">{f.tempHigh}°</span>
          </span>
        ))}
      </span>
      <div className="wf-controls">
        <button onClick={() => fastForward(-7)} title="后退 7 天">⏮</button>
        <button onClick={() => fastForward(-1)} title="后退 1 天">⏪</button>
        <button onClick={() => fastForward(1)} title="前进 1 天">⏩</button>
        <button onClick={() => fastForward(7)} title="前进 7 天">⏭</button>
        <button onClick={() => jumpToNextRain()} title="跳到下一个雨日">💧</button>
        <button onClick={() => jumpToGameDay(0)} title="回到开局（3 月 1 日）">🏠</button>
      </div>
    </header>
  )
}

function tempColorClass(tempHigh: number): string {
  if (tempHigh <= 5) return 'wf-cold'
  if (tempHigh <= 18) return 'wf-cool'
  if (tempHigh <= 28) return 'wf-warm'
  return 'wf-hot'
}