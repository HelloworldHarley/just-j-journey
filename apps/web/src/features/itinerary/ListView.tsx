import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  MoveRight,
  Scissors,
  Sunrise as SunriseIcon,
  Sunset as SunsetIcon,
} from 'lucide-react'
import { CATEGORIES, formatMinutes, type Day, type Trip } from '@jjj/schema'
import { DayTimeline, type CardModules } from '../../components/DayTimeline.tsx'
import { Markdown } from '../../components/Markdown.tsx'
import { daySpan } from '../../lib/layout.ts'
import { dedupIds, rentalModuleMap, stayModuleMap } from '../../lib/derive.ts'
import { todayIso } from '../../lib/time.ts'
import { useFavorites } from '../../data/useFavorites.ts'
import { DayRail } from '../../components/DayRail.tsx'
import { RailLayout } from '../../components/RailLayout.tsx'
import { useScrollSpy } from '../../lib/useScrollSpy.ts'
import { FilterBar, type EventFilter } from './FilterBar.tsx'

const DETAIL_KEY = 'jjj:detail'

export function ListView({ trip }: { trip: Trip }) {
  const places = useMemo(() => new Map(trip.places.map((p) => [p.id, p])), [trip.places])
  const favorites = useFavorites(trip.id)
  const today = todayIso(trip.timezone)
  const spy = useScrollSpy(trip.days.length)
  const [filter, setFilter] = useState<EventFilter>('all')
  // 全局详略。默认「详」；选择记住，下次打开还是你上次的读法
  const [detail, setDetail] = useState(() => localStorage.getItem(DETAIL_KEY) !== 'brief')
  const setDetailPersist = (d: boolean) => {
    setDetail(d)
    localStorage.setItem(DETAIL_KEY, d ? 'full' : 'brief')
  }

  // 信息模块的归属：住宿区间挂在首晚入住卡上、租车区间挂在取车卡上。
  // dup = 住/行视图里该藏起来的重复卡（回酒店、还车）
  const { modules, dup } = useMemo(() => {
    const stay = stayModuleMap(trip)
    const rental = rentalModuleMap(trip)
    return {
      modules: { stay, rental } satisfies CardModules,
      dup: dedupIds(trip, stay, rental),
    }
  }, [trip])

  // 筛选是「过滤事件」而不是「过滤天」：玩/吃保留天的骨架，只隐藏不匹配的卡片。
  // 住/行额外去重 —— 同一家酒店 / 同一辆租车只留最开始那张卡。
  const matches = (e: Trip['days'][number]['events'][number]): boolean => {
    if (filter === 'all') return true
    if (filter === 'faved') return favorites.has(e.id)
    if (CATEGORIES[e.category].kind !== filter) return false
    if ((filter === 'stay' || filter === 'move') && dup.has(e.id)) return false
    return true
  }
  /** 住/行是「订好的东西一览」：极简眉头、去时间列、没货的天直接不出现 */
  const bookingView = filter === 'stay' || filter === 'move'

  // 「今天」智能定位：当前日期落在行程区间内就自动滚过去。
  // 旅行中最常见的动作是「我现在该干嘛」，不该让人每次都自己找。
  useEffect(() => {
    const i = trip.days.findIndex((d) => d.date === today)
    if (i >= 0) spy.jumpTo(i)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id])

  return (
    <div className="pb-24">
      <FilterBar
        value={filter}
        onChange={setFilter}
        detail={detail}
        onDetailChange={setDetailPersist}
      />

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
        {trip.days.map((day, i) => {
          const visible = day.events.filter(matches)
          if (bookingView && visible.length === 0) return null
          return (
            <section key={day.index} ref={spy.register(i)} className="scroll-mt-[6.5rem] pt-11">
              <DayHeader
                day={day}
                isToday={day.date === today}
                events={visible}
                detail={detail}
                minimal={bookingView}
              />
              <DayTimeline
                day={filter === 'all' ? day : { ...day, events: visible, legs: [] }}
                places={places}
                favorites={favorites}
                connectors={filter === 'all'}
                showTime={!bookingView}
                detail={detail}
                modules={modules}
              />
              {!bookingView && filter !== 'all' && visible.length === 0 && (
                <p className="py-3 text-[12.5px] text-graphite">这天没有匹配的安排。</p>
              )}
              {filter === 'all' && day.fallbackOrder.length > 0 && <FallbackNote day={day} />}
            </section>
          )
        })}
      </RailLayout>
    </div>
  )
}

/** 事件快速跳转链上的极简标签：取「·」前的第一段，不复制整条标题 */
function shortLabel(title: string): string {
  return (title.split('·')[0] ?? title).trim()
}

/**
 * 每日眉头，四行结构：
 *
 *   1  Day n · 日期 · 周几            …右侧: 日升日落
 *   2  当天主题（给这一天起的名字）
 *   3  行程时间范围 · 事件快速跳转链   ← 详略开关控制
 *   4  当天导语（介绍/注意/亮点）      ← 详略开关控制
 *
 * 简态收起 3/4 行，留「详情」单独展开。
 * minimal（住/行视图）：只留第一行 —— 那是订单一览，不是行程叙事。
 */
function DayHeader({
  day,
  isToday,
  events,
  detail,
  minimal = false,
}: {
  day: Day
  isToday: boolean
  /** 当前筛选下可见的事件 —— 快速跳转链只指向看得见的卡片 */
  events: Day['events']
  detail: boolean
  minimal?: boolean
}) {
  const [open, setOpen] = useState(false)
  const expanded = detail || open
  const span = daySpan(day)
  const foldable = !minimal && (Boolean(span) || events.length > 0 || Boolean(day.intro))

  return (
    <header className={minimal ? 'mb-3' : 'mb-5'}>
      {/* 第一行：定位锚 + 日升日落 */}
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="signage text-[15px] text-ink">Day {day.index}</span>
          <span className="tnum text-[14px] text-soft">{day.date.slice(5).replace('-', '/')}</span>
          <span className="text-[14px] text-graphite">{day.weekday}</span>
          {!minimal && isToday && (
            <span className="rounded-full bg-ink px-2 py-[2px] text-[11px] font-medium text-paper">
              今天
            </span>
          )}
        </div>
        {!minimal && (day.sunrise || day.sunset) && (
          <div className="flex shrink-0 items-center gap-3 text-[12px] text-graphite">
            {day.sunrise && (
              <span className="tnum inline-flex items-center gap-1">
                <SunriseIcon size={12} aria-hidden />
                {day.sunrise}
              </span>
            )}
            {day.sunset && (
              <span className="tnum inline-flex items-center gap-1">
                <SunsetIcon size={12} aria-hidden />
                {day.sunset}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 第二行：当天主题 */}
      {!minimal && day.theme && (
        <h3 className="display mt-1.5 text-[26px] leading-[1.25] tracking-[-0.02em] text-ink sm:text-[30px]">
          {day.theme}
        </h3>
      )}

      {!minimal && expanded && (
        <>
          {/* 第三行：时间范围 + 事件快速跳转链（点一下滚到那张卡） */}
          {(span || events.length > 0) && (
            <div
              className="mt-3 flex items-center gap-2 overflow-x-auto text-[12px] text-graphite
                         [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {span && (
                <span className="tnum shrink-0 rounded-md bg-sunken px-2 py-[3px] text-soft">
                  {formatMinutes(span.from)}–{formatMinutes(span.to)}
                </span>
              )}
              {events.map((e, i) => (
                <span key={e.id} className="flex shrink-0 items-center gap-2">
                  {i > 0 && <MoveRight size={11} className="text-graphite/60" aria-hidden />}
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById(e.id)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                    className="max-w-[8rem] truncate transition-colors hover:text-ink"
                    title={e.title}
                  >
                    {shortLabel(e.title)}
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* 第四行起：当天导语 */}
          {day.intro && <Markdown className="mt-2.5">{day.intro}</Markdown>}
        </>
      )}
      {foldable && !detail && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={expanded}
          className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-graphite
                     transition-colors hover:text-ink"
        >
          <ChevronDown
            size={12}
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden
          />
          {expanded ? '收起' : '详情'}
        </button>
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
