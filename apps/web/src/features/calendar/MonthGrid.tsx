import { TRANSPORTS, type Day, type Rental, type Stay, type Trip } from '@jjj/schema'
import { dayComposition } from '@jjj/tripmd'
import {
  assignLanes,
  buildMonthGrid,
  clipSpanToGrid,
  reservationToTimed,
  tripCalendarRange,
  type RowSegment,
} from '../../lib/calendar-grid.ts'
import { buildBudget } from '../../lib/budget.ts'
import { fmtMoney } from '../../lib/format.ts'
import { iconFor } from '../../lib/icons.tsx'

/**
 * 月视图 —— 回答「这趟旅行长什么样」：哪几天在哪、有没有车、哪天满哪天松。
 * 具体几点是周视图和列表的事，这里一概不答。
 *
 * 两条固定泳道：住在上、行在下。住是「背景态」，行是「事件态」，
 * 各自独立通道不互相挤占。**区间带按真实时刻占格子的比例** ——
 * 一整格实心会说「你那天整天都有房」，而换酒店那天其实是上午退、晚上入。
 */

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const LANE_H = 13
const LANE_GAP = 4
/** 日期数字那一行 */
const HEAD_H = 22
/** 格子的上内边距。带层的绝对定位偏移要用它 —— 藏在 pt-* 类里两边会对不上账 */
const CELL_PT = 6
/** 日期行与第一条区间带之间的呼吸空隙 —— 带贴着日期数字会显得整格顶得很满 */
const LANE_TOP = 8
/**
 * 长途换乘（航班/火车/轮渡）固定占一行 —— **空着也保留**。
 * 没有这一行时，有换乘的格子会把主题往下推一截，
 * 一排格子扫过去主题忽高忽低；行高固定后主题永远落在同一条线上。
 */
const TRANSFER_H = 20

export function MonthGrid({
  trip,
  todayDate,
  onPickDay,
}: {
  trip: Trip
  todayDate: string
  onPickDay?: (date: string) => void
}) {
  const reservations = [...trip.stays, ...trip.rentals]
  const range = tripCalendarRange(trip.dates, reservations)
  const grid = buildMonthGrid(range.start, range.end)
  const budget = buildBudget(trip)
  const dayByDate = new Map(trip.days.map((d) => [d.date, d]))
  const budgetByDate = new Map(budget.byDay.map((b) => [b.date, b.total]))

  // 住和行各占一个外层槽位；槽位内部再按重叠分道
  // （住由构造保证不重叠；租车可能重叠 —— 两人各租一辆）
  const stayLanes = assignLanes(trip.stays.map(reservationToTimed))
  const rentalLanes = assignLanes(trip.rentals.map(reservationToTimed))
  const stayDepth = Math.max(0, ...stayLanes.map((l) => l + 1))
  const rentalDepth = Math.max(0, ...rentalLanes.map((l) => l + 1))
  const laneAreaH = (stayDepth + rentalDepth) * (LANE_H + LANE_GAP)

  const bars = [
    ...trip.stays.map((s, i) => ({
      res: s as Stay | Rental,
      lane: stayLanes[i]!,
      accent: 'stay' as const,
    })),
    ...trip.rentals.map((r, i) => ({
      res: r as Stay | Rental,
      lane: stayDepth + rentalLanes[i]!,
      accent: 'move' as const,
    })),
  ].flatMap(({ res, lane, accent }) =>
    clipSpanToGrid(grid, reservationToTimed(res)).map((seg) => ({ seg, res, lane, accent })),
  )

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-4">
      <div className="grid grid-cols-7 border-b border-[var(--hairline)] pb-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[11px] text-graphite">
            {w}
          </div>
        ))}
      </div>

      {grid.weeks.map((week, wi) => (
        <div
          key={week.start}
          className="relative border-b border-[var(--hairline)]"
          style={{ opacity: week.outside ? 0.26 : 1 }}
        >
          <div className="grid grid-cols-7">
            {week.dates.map((date) => (
              <Cell
                key={date}
                date={date}
                day={dayByDate.get(date)}
                compact={week.outside}
                isToday={date === todayDate}
                laneAreaH={laneAreaH}
                budget={budgetByDate.get(date)}
                currency={budget.currency}
                onPick={onPickDay}
              />
            ))}
          </div>

          {/*
            区间带层：跨格必须绝对定位，但只落在每格预留出来的泳道区里 ——
            月视图没有任何覆盖在文字之上的效果。
          */}
          <div className="pointer-events-none absolute inset-x-0" style={{ top: CELL_PT + HEAD_H + LANE_TOP }}>
            {bars
              .filter((b) => b.seg.weekIndex === wi)
              .map(({ seg, res, lane, accent }, i) => (
                <Bar key={`${res.what}-${i}`} seg={seg} lane={lane} accent={accent} what={res.what} />
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Bar({
  seg,
  lane,
  accent,
  what,
}: {
  seg: RowSegment
  lane: number
  /** 语义键，.band-* 类负责深浅两套底色和配套文字色 */
  accent: 'stay' | 'move'
  what: string
}) {
  return (
    <div
      className={`band-${accent} absolute overflow-hidden px-1 text-[9.5px] font-medium leading-[13px]`}
      style={{
        left: `${seg.leftPct}%`,
        width: `${seg.widthPct}%`,
        top: lane * (LANE_H + LANE_GAP),
        height: LANE_H,
        // 圆角只在区间真正的起止处；被周行边界切断的那端齐平
        borderTopLeftRadius: seg.capStart ? 999 : 0,
        borderBottomLeftRadius: seg.capStart ? 999 : 0,
        borderTopRightRadius: seg.capEnd ? 999 : 0,
        borderBottomRightRadius: seg.capEnd ? 999 : 0,
      }}
      title={what}
    >
      {/* 名字只写在区间首段（跨周的后半段接着上一行，不重复报一遍名）；
          手机上格子只有 50px 宽，写不下就不写，条本身仍在 */}
      {seg.capStart && <span className="hidden truncate sm:block">{what}</span>}
    </div>
  )
}

function Cell({
  date,
  day,
  compact,
  isToday,
  laneAreaH,
  budget,
  currency,
  onPick,
}: {
  date: string
  day?: Day
  compact: boolean
  isToday: boolean
  laneAreaH: number
  budget?: number
  currency?: string
  onPick?: (date: string) => void
}) {
  const dayNum = Number(date.slice(8, 10))
  const comp = day ? dayComposition(day) : null
  const total = comp ? comp.play + comp.food + comp.other : 0
  // 长途换乘点：带票面时间轴的那种事件。取/还车没有 transport 块，天然不在其中
  const transfer = day?.events.find((e) => e.transports.length > 0)
  // 全局唯一表示「你得做点什么」的数字，和首页卡片上那个是同一个口径
  const todo = day?.events.filter((e) => e.flags.includes('needs-booking')).length ?? 0
  const TransferIcon = iconFor(TRANSPORTS[transfer?.transports[0]?.mode ?? 'flight'].icon)

  return (
    <button
      type="button"
      disabled={!day}
      onClick={() => onPick?.(date)}
      className={`flex flex-col border-l border-[var(--hairline)] px-2 pb-2
                  text-left first:border-l-0 ${day ? 'hover:bg-sunken' : 'cursor-default'}`}
      /*
        行程周的格子按 1:2 纵横比拉高 —— 跟着列宽自适应，不写死像素：
        桌面约 105×210，手机约 55×110，正文再多也只会把格子撑得更高不会溢出。
        渐隐周不参与：它压到只剩日期 + 泳道（区间照常绘制，但不占正文的高度）。
      */
      style={{
        paddingTop: CELL_PT,
        ...(compact ? { minHeight: CELL_PT + HEAD_H + laneAreaH + 8 } : { aspectRatio: '1 / 2' }),
      }}
    >
      <div className="flex items-baseline justify-between gap-1" style={{ height: HEAD_H }}>
        <span
          className={`tnum text-[13px] ${
            isToday
              ? 'rounded-full bg-ink px-1.5 font-semibold text-paper'
              : day
                ? 'font-semibold text-ink'
                : 'text-graphite'
          }`}
        >
          {dayNum}
        </span>
        {!compact && budget !== undefined && budget > 0 && (
          <span className="tnum tint-faved hidden text-[10px] sm:inline">
            {fmtMoney(budget, currency)}
          </span>
        )}
      </div>

      {/* 泳道预留区。带层绝对定位落在这里，文字从它下面开始 —— 永不互相压 */}
      <div style={{ height: laneAreaH, marginTop: LANE_TOP }} aria-hidden />

      {!compact && (
        <div
          className="tint-move mt-1 flex items-center gap-1 text-[10.5px]"
          style={{ height: TRANSFER_H }}
        >
          {transfer && (
            <>
              <TransferIcon size={12} aria-hidden />
              <span className="hidden truncate text-graphite sm:inline">{transfer.title}</span>
            </>
          )}
        </div>
      )}

      {!compact && day?.theme && (
        <p className="mt-1 hidden line-clamp-4 text-[11.5px] leading-[1.5] text-graphite sm:block">
          {day.theme}
        </p>
      )}

      {!compact && todo > 0 && (
        <span className="todo-badge tnum mt-2 hidden self-start rounded-full px-1.5 text-[10px] leading-[16px] sm:block">
          {todo} 项待订
        </span>
      )}

      {comp && total > 0 && (
        <span className="mt-auto flex h-[3px] w-full overflow-hidden rounded-full pt-0" aria-hidden>
          {(['play', 'food', 'other'] as const).map((g) =>
            comp[g] > 0 ? (
              <span
                key={g}
                style={{
                  width: `${(comp[g] / total) * 100}%`,
                  background: `var(--t-${g})`,
                  opacity: g === 'other' ? 0.3 : 1,
                }}
              />
            ) : null,
          )}
        </span>
      )}
    </button>
  )
}
