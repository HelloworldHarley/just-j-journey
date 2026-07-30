import { useEffect, useMemo, useState } from 'react'
import { Scissors, Sunset as SunsetIcon } from 'lucide-react'
import { CONSTRAINTS, formatMinutes, type Day, type Trip } from '@jjj/schema'
import { DayTimeline } from '../../components/DayTimeline.tsx'
import { Markdown } from '../../components/Markdown.tsx'
import { iconFor } from '../../lib/icons.tsx'
import { daySpan } from '../../lib/layout.ts'
import { todayIso } from '../../lib/time.ts'
import { useFavorites } from '../../data/useFavorites.ts'
import { DayRail } from '../../components/DayRail.tsx'
import { RailLayout } from '../../components/RailLayout.tsx'
import { useScrollSpy } from '../../lib/useScrollSpy.ts'
import { FilterBar, type EventFilter } from './FilterBar.tsx'
import { StayView } from './StayView.tsx'
import { TransportView } from './TransportView.tsx'
import { CATEGORIES } from '@jjj/schema'

export function ListView({ trip }: { trip: Trip }) {
  const places = useMemo(() => new Map(trip.places.map((p) => [p.id, p])), [trip.places])
  const favorites = useFavorites(trip.id)
  const today = todayIso(trip.timezone)
  const spy = useScrollSpy(trip.days.length)
  const [filter, setFilter] = useState<EventFilter>('all')

  // 筛选是「过滤事件」而不是「过滤天」：天的骨架（日头/导语）保留，
  // 只隐藏不匹配的事件卡片 —— 这样时间上下文不丢，跳天导航也照常工作。
  const matches = (e: Trip['days'][number]['events'][number]): boolean => {
    switch (filter) {
      case 'faved':
        return favorites.has(e.id)
      case 'play':
      case 'food':
        return CATEGORIES[e.category].group === filter
      default:
        return true
    }
  }

  // 「今天」智能定位：当前日期落在行程区间内就自动滚过去。
  // 旅行中最常见的动作是「我现在该干嘛」，不该让人每次都自己找。
  useEffect(() => {
    const i = trip.days.findIndex((d) => d.date === today)
    if (i >= 0) spy.jumpTo(i)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id])

  return (
    <div className="pb-24">
      <FilterBar value={filter} onChange={setFilter} />

      {filter === 'stay' || filter === 'move' ? (
        /* 「住」「行」是派生视图 —— 聚合区间/票务卡，不保留按天流水账 */
        <div className="mx-auto max-w-3xl px-4">
          {filter === 'stay' ? <StayView trip={trip} /> : <TransportView trip={trip} />}
        </div>
      ) : (
        <RailLayout
          rail={
            <DayRail
              days={trip.days}
              activeIndex={spy.active}
              todayDate={today}
              onJump={spy.jumpTo}
            />
          }
        >
          {trip.days.map((day, i) => (
            <section key={day.index} ref={spy.register(i)} className="scroll-mt-[6.5rem] pt-11">
              <DayHeader
                day={day}
                isToday={day.date === today}
                constraints={trip.constraints.filter((c) => c.date === day.date)}
              />
              {filter === 'all' && day.intro && <Markdown className="mb-5">{day.intro}</Markdown>}
              <DayTimeline
                day={filter === 'all' ? day : { ...day, events: day.events.filter(matches), legs: [] }}
                places={places}
                favorites={favorites}
                connectors={filter === 'all'}
              />
              {filter !== 'all' && day.events.filter(matches).length === 0 && (
                <p className="py-3 text-[12.5px] text-graphite">这天没有匹配的安排。</p>
              )}
              {filter === 'all' && day.fallbackOrder.length > 0 && <FallbackNote day={day} />}
            </section>
          ))}
        </RailLayout>
      )}
    </div>
  )
}

function DayHeader({
  day,
  isToday,
  constraints,
}: {
  day: Day
  isToday: boolean
  constraints: Trip['constraints']
}) {
  const span = daySpan(day)

  return (
    <header className="mb-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          {/* 大号日号是这一屏的定位锚 —— 长页面滚动时靠它知道自己在哪天 */}
          <span className="signage text-[15px] text-ink">Day {day.index}</span>
          <span className="tnum text-[14px] text-soft">{day.date.slice(5).replace('-', '/')}</span>
          <span className="text-[14px] text-graphite">{day.weekday}</span>
          {isToday && (
            <span className="rounded-full bg-ink px-2 py-[2px] text-[11px] font-medium text-paper">
              今天
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[12px] text-graphite">
          {span && (
            <span className="tnum hidden sm:inline">
              {formatMinutes(span.from)}–{formatMinutes(span.to)}
            </span>
          )}
          {day.sunset && (
            <span className="tnum inline-flex items-center gap-1">
              <SunsetIcon size={12} aria-hidden />
              {day.sunset}
            </span>
          )}
        </div>
      </div>
      {day.theme && (
        <h3 className="display mt-1.5 text-[26px] leading-[1.25] tracking-[-0.02em] text-ink sm:text-[30px]">
          {day.theme}
        </h3>
      )}
      {day.weatherNote && <p className="mt-1.5 text-[12.5px] text-graphite">{day.weatherNote}</p>}
      {/* 当天的硬截止钉在日头下 —— 顶栏位置让给了筛选，但截止不能消失 */}
      {constraints.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {constraints.map((c, i) => {
            const Icon = iconFor(CONSTRAINTS[c.kind].icon)
            return (
              <span
                key={i}
                title={c.note}
                /* 红色只留给「今天」—— 两个月后的截止每天挂红牌，红色就没有意义了 */
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11.5px] ${
                  isToday
                    ? 'border-[var(--tight)]/45 text-[var(--tight)]'
                    : 'border-[var(--hairline)] text-soft'
                }`}
              >
                <Icon size={12} aria-hidden />
                <span className="tnum">{formatMinutes(c.minute)}</span>
                <span className="whitespace-nowrap">{c.label}</span>
              </span>
            )
          })}
        </div>
      )}
      <div className="mt-4 h-px bg-[var(--hairline)]" />
    </header>
  )
}

/** 「赶不上时的砍站顺序」—— 原文里最实用的一段，值得单独成块而不是埋在正文 */
function FallbackNote({ day }: { day: Day }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg
                    bg-[var(--paper-sunken)] px-3.5 py-2.5 text-[12.5px]">
      <Scissors size={13} className="text-graphite" aria-hidden />
      <span className="text-graphite">赶不上时按此顺序砍</span>
      {day.fallbackOrder.map((name, i) => (
        <span key={name} className="text-soft">
          {i > 0 && <span className="mr-2 text-graphite">→</span>}
          {name}
        </span>
      ))}
    </div>
  )
}
