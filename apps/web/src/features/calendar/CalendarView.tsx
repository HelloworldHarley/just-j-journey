import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Trip } from '@jjj/schema'
import { shortDate } from '../../lib/format.ts'
import { todayIso } from '../../lib/time.ts'
import { updateSettings, useSettings } from '../../lib/settings.ts'
import { WeekGrid } from './WeekGrid.tsx'
import { MonthGrid } from './MonthGrid.tsx'

/**
 * 日历 —— 三级下钻的中间两级。
 *
 *   月：这趟旅行的结构（哪几天在哪、有没有车、哪天满哪天松）
 *   周：每件事占多长时间、多少时间在路上、哪里有大空档
 *   列表：这件事是什么、有什么坑、怎么订
 *
 * 点月格子 → 周视图定位到那天；点周方块 → 列表对应卡片（列表卡片自带 id 锚点）。
 * 没有日视图：一天的细节归列表，日历再切一层只是重复。
 */

const MODE_KEY = 'jjj:calmode'
/** 一页放几天。按**行程顺序**分页，不按自然周边界切 —— 见下方注释 */
const PAGE = 7

export function CalendarView({ trip }: { trip: Trip }) {
  const navigate = useNavigate()
  const { rentalBand } = useSettings()
  const [mode, setMode] = useState<'week' | 'month'>(() =>
    localStorage.getItem(MODE_KEY) === 'month' ? 'month' : 'week',
  )
  const today = todayIso(trip.timezone)
  const todayPage = Math.max(0, Math.floor(trip.days.findIndex((d) => d.date === today) / PAGE))
  const [page, setPage] = useState(todayPage)

  const setModePersist = (m: 'week' | 'month'): void => {
    setMode(m)
    localStorage.setItem(MODE_KEY, m)
  }

  /*
    列模型用「行程周」而不是 Apple 的固定周一–周日：
    西雅图 10/01（周四）–10/05（周一）会被自然周切成两页，
    第一页空 4 格、第二页空 6 格 —— 一趟 5 天的行程看起来像散落在两周里。
  */
  const pages = Math.max(1, Math.ceil(trip.days.length / PAGE))
  const current = Math.min(page, pages - 1)
  const days = trip.days.slice(current * PAGE, current * PAGE + PAGE)

  const jumpToWeek = (date: string): void => {
    const i = trip.days.findIndex((d) => d.date === date)
    if (i < 0) return
    setModePersist('week')
    setPage(Math.floor(i / PAGE))
  }

  return (
    <div className="pb-24">
      <div className="sticky top-[var(--nav-h)] z-20 border-b border-[var(--hairline)] bg-paper/92 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2">
          <div role="radiogroup" aria-label="日历粒度" className="flex gap-0.5 rounded-full bg-sunken p-0.5">
            {(
              [
                ['week', '周'],
                ['month', '月'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={mode === key}
                onClick={() => setModePersist(key)}
                className={`rounded-full px-3 py-[3px] text-[12.5px] transition-colors ${
                  mode === key
                    ? 'bg-raised font-medium text-ink shadow-sm'
                    : 'text-graphite hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 租车底色是周视图专属的显示开关，就住在它作用的地方 —— 不进首页设置 */}
          {mode === 'week' && trip.rentals.length > 0 && (
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[12px] text-graphite">
              租车底色
              <Toggle
                checked={rentalBand}
                onChange={(v) => updateSettings({ rentalBand: v })}
                label="租车底色"
              />
            </label>
          )}
          <span
            className={`tnum text-[12.5px] text-graphite ${
              mode === 'week' && trip.rentals.length > 0 ? '' : 'ml-auto'
            }`}
          >
            {mode === 'week' && days.length > 0
              ? `${shortDate(days[0]!.date)} – ${shortDate(days[days.length - 1]!.date)}`
              : `${shortDate(trip.dates.start)} – ${shortDate(trip.dates.end)}`}
          </span>

          {mode === 'week' && pages > 1 && (
            <div className="flex shrink-0 gap-0.5">
              <PageButton
                dir="prev"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              />
              <PageButton
                dir="next"
                disabled={current >= pages - 1}
                onClick={() => setPage(current + 1)}
              />
            </div>
          )}
        </div>
      </div>

      {mode === 'week' ? (
        <div className="mx-auto max-w-3xl px-2 pt-2 sm:px-4">
          <WeekGrid
            days={days}
            todayDate={today}
            nowMinute={nowMinuteIn(trip.timezone)}
            rentals={trip.rentals}
            rentalBand={rentalBand}
            onOpen={(anchorId) => navigate('../list', { state: { focus: anchorId } })}
          />
        </div>
      ) : (
        <MonthGrid trip={trip} todayDate={today} onPickDay={jumpToWeek} />
      )}
    </div>
  )
}

function PageButton({
  dir,
  disabled,
  onClick,
}: {
  dir: 'prev' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'prev' ? '上一页' : '下一页'}
      className="rounded-full p-1 text-graphite transition-colors hover:text-ink
                 disabled:cursor-default disabled:opacity-30"
    >
      <Icon size={16} aria-hidden />
    </button>
  )
}

/** 迷你开关 —— 工具栏尺寸的 iOS 胶囊。「开」用固定蓝，不随主题与自定义配色变。 */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[20px] w-[34px] shrink-0 rounded-full transition-colors ${
        checked ? 'bg-[#2963d6]' : 'bg-fog'
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-[2px] h-4 w-4 rounded-full bg-white shadow transition-[left] ${
          checked ? 'left-[16px]' : 'left-[2px]'
        }`}
      />
    </button>
  )
}

/** 目的地当地此刻的分钟数。取不到时区就返回 null，不画那条红线。 */
function nowMinuteIn(timeZone: string): number | null {
  try {
    const [h, m] = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(new Date())
      .split(':')
      .map(Number)
    return (h ?? 0) * 60 + (m ?? 0)
  } catch {
    return null
  }
}
