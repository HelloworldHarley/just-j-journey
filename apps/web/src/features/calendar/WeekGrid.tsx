import type React from 'react'
import { formatMinutes, type Day, type Rental } from '@jjj/schema'
import { computeWeekAxis, minuteToPct, rentalBandsForWeek } from '../../lib/week-axis.ts'
import { kindVars } from '../../components/CategoryChip.tsx'
import { packLanes } from '../../lib/lanes.ts'
import { shortDate } from '../../lib/format.ts'

/**
 * 周视图 —— 把几天并排，纵轴是时间。
 *
 * 这是**唯一按时长成比例**的视图：方块多高就是这件事占多久。
 * 列表刻意不这么做（`lib/layout.ts` 的文档字符串写明了为什么），
 * 「这天有多满、哪里有大空档」这类问题只有在轴上才答得出来。
 *
 * 通勤不画。试过按真实时长铺灰块，一天二三十段路把每一列都填成了斑马纹，
 * 反而看不出空档在哪 —— 路上耗时归列表的连接线，那里有地点、方式和导航。
 */

const PX_PER_HOUR = 56
/**
 * 时间点事件（时长 0）的固定高度 —— 高度不按时长撒谎，
 * 但保留族色粉彩底：全透明会被读成「这块漏画了」。
 */
const POINT_H = 18
/** POINT_H 换算成分钟 —— 分道时按屏幕上真正占的高度算，而不是名义时长 0 */
const POINT_MIN = Math.round((POINT_H / PX_PER_HOUR) * 60)
const GUTTER_W = 44

export function WeekGrid({
  days,
  todayDate,
  nowMinute,
  rentals,
  rentalBand,
  onOpen,
}: {
  days: Day[]
  todayDate: string
  /** 目的地当地的此刻（分钟）。不在行程里时为 null */
  nowMinute: number | null
  rentals: Rental[]
  /** 租车期间铺底色。开关在设置里，默认关 */
  rentalBand: boolean
  /**
   * 下钻到列表的某个锚点。**不能用 `href="#id"`** ——
   * HashRouter 把整个 hash 当路由，写锚点会把地址栏改成一个不存在的路由。
   */
  onOpen: (anchorId: string) => void
}) {
  const axis = computeWeekAxis(days)
  const height = ((axis.to - axis.from) / 60) * PX_PER_HOUR
  const hours: number[] = []
  for (let m = axis.from; m <= axis.to; m += 60) hours.push(m)

  const columns = days.map((d) => d.date)
  const bands = rentalBand
    ? rentals.flatMap((r) => rentalBandsForWeek(r, columns, axis).map((b) => ({ ...b, r })))
    : []

  // 全天事件不占轴 —— 一个全天事件糊满整列会把这一天的形状抹掉
  const alldayRows = Math.max(...days.map((d) => d.events.filter(isAllday).length), 0)

  return (
    <div className="overflow-x-auto pb-4 [scrollbar-width:thin]">
      <div className="flex min-w-full">
        <div
          className="sticky left-0 z-10 shrink-0 bg-paper"
          style={{ width: GUTTER_W }}
          aria-hidden
        >
          <div style={{ height: HEADER_H + alldayBandH(alldayRows) }} />
          <div className="relative" style={{ height }}>
            {hours.map((m) => (
              <span
                key={m}
                className="tnum absolute right-1.5 -translate-y-1/2 text-[10.5px] text-graphite"
                style={{ top: `${minuteToPct(m, axis)}%` }}
              >
                {formatMinutes(m % 1440)}
              </span>
            ))}
          </div>
        </div>

        {days.map((day) => (
          <Column
            key={day.date}
            day={day}
            axis={axis}
            height={height}
            hours={hours}
            alldayRows={alldayRows}
            isToday={day.date === todayDate}
            nowMinute={day.date === todayDate ? nowMinute : null}
            bands={bands.filter((b) => columns[b.col] === day.date)}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  )
}

const HEADER_H = 46
const ALLDAY_ROW_H = 20
const alldayBandH = (rows: number): number => (rows === 0 ? 0 : rows * ALLDAY_ROW_H + 8)

const isAllday = (e: Day['events'][number]): boolean => e.timeKind === 'allday'

function Column({
  day,
  axis,
  height,
  hours,
  alldayRows,
  isToday,
  nowMinute,
  bands,
  onOpen,
}: {
  day: Day
  axis: { from: number; to: number }
  height: number
  hours: number[]
  alldayRows: number
  isToday: boolean
  nowMinute: number | null
  bands: { band: { topPct: number; bottomPct: number }; r: Rental }[]
  onOpen: (anchorId: string) => void
}) {
  const timed = day.events.filter((e) => !isAllday(e))
  const allday = day.events.filter(isAllday)

  /*
    撞在一起的事件并排摊开（Apple Calendar 的做法）。
    不摊的话「下午某时逛锦市场」这种模糊时段块会把压在它上面的
    「15:00 清水寺」整个盖住 —— 确定的那件事反而看不见了。
    按视觉占位算重叠：时间点事件本身时长为 0，但它在屏幕上仍占 POINT_H。
  */
  const lanes = packLanes(
    timed.map((e) => ({ from: e.startMin, to: Math.max(e.endMin, e.startMin + POINT_MIN) })),
  )

  return (
    <div className="min-w-[88px] flex-1 border-l border-[var(--hairline)]">
      <button
        type="button"
        onClick={() => onOpen(`day-${day.index}`)}
        className="flex h-[46px] w-full flex-col items-center justify-center gap-0.5
                   transition-colors hover:bg-sunken"
      >
        <span className="signage text-[10.5px] text-graphite">Day {day.index}</span>
        <span className="flex items-baseline gap-1.5">
          <span
            className={`tnum text-[13px] ${
              isToday
                ? 'rounded-full bg-ink px-1.5 font-medium text-paper'
                : 'font-medium text-ink'
            }`}
          >
            {shortDate(day.date)}
          </span>
          <span className="text-[11.5px] text-graphite">{day.weekday}</span>
        </span>
      </button>

      {alldayRows > 0 && (
        <div
          className="space-y-[2px] border-b border-[var(--hairline)] px-[3px] pb-2"
          style={{ height: alldayBandH(alldayRows) }}
        >
          {allday.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onOpen(e.id)}
              className="grp-chip block w-full truncate rounded px-1.5 text-left text-[10.5px] leading-[18px]"
              style={blockVars(e.category)}
              title={e.title}
            >
              {e.title}
            </button>
          ))}
        </div>
      )}

      <div className="relative" style={{ height }}>
        {hours.map((m, i) => (
          <div
            key={m}
            className="absolute inset-x-0 border-t border-[var(--hairline)]"
            style={{ top: `${minuteToPct(m, axis)}%`, opacity: i === 0 ? 0 : 0.6 }}
            aria-hidden
          />
        ))}

        {/* 租车底色压在所有事件之下 —— 它是「这段时间有车」的背景态，不是事件 */}
        {bands.map(({ band, r }, i) => (
          <div
            key={`${r.what}-${i}`}
            className="band-move-tint absolute inset-x-0"
            style={{ top: `${band.topPct}%`, height: `${band.bottomPct - band.topPct}%` }}
            aria-hidden
          />
        ))}

        {timed.map((e, i) => {
          const top = minuteToPct(e.startMin, axis)
          const point = e.endMin <= e.startMin
          const fuzzy = e.timeKind === 'period'
          const { lane, lanes: n } = lanes[i]!
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onOpen(e.id)}
              className={`cal-block ${fuzzy ? 'cal-block-fuzzy' : ''}
                          absolute overflow-hidden rounded-[4px] border-l-[3px]
                          px-1 text-[10.5px] leading-[13px] text-ink ${point ? '' : 'py-[2px]'}`}
              style={{
                ...blockVars(e.category),
                left: `calc(${(lane / n) * 100}% + 3px)`,
                width: `calc(${100 / n}% - 6px)`,
                top: `${top}%`,
                height: point ? POINT_H : `${minuteToPct(e.endMin, axis) - top}%`,
                minHeight: point ? undefined : POINT_H,
              }}
              title={`${formatMinutes(e.startMin)} ${e.title}`}
            >
              {/* 时间点只有 18px 高，两行会被拦腰切断 —— 那种情况单行省略 */}
              <span className={`block text-left ${point ? 'truncate' : 'line-clamp-2 break-all'}`}>
                {e.title}
              </span>
            </button>
          )
        })}

        {nowMinute !== null && nowMinute >= axis.from && nowMinute <= axis.to && (
          <div
            className="absolute inset-x-0 z-[1] border-t-2 border-[var(--tight)]"
            style={{ top: `${minuteToPct(nowMinute, axis)}%` }}
            aria-hidden
          />
        )}
      </div>
    </div>
  )
}

/**
 * 族色注入走 kindVars（--grp/--grp-dark 成对，深色模式靠 CSS 类切换）。
 * misc 无色 —— kindVars 返回空对象，这里补中性兜底，深浅两档都指向 --fog。
 */
const NEUTRAL = {
  ['--grp' as string]: 'var(--fog)',
  ['--grp-dark' as string]: 'var(--fog)',
}
function blockVars(category: Day['events'][number]['category']): React.CSSProperties {
  return { ...NEUTRAL, ...kindVars(category) }
}
