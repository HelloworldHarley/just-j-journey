import type { Reservation } from '@jjj/schema'
import { addDays, daysBetween, mondayIndex } from '@jjj/tripmd'
import { packLanes } from './lanes.ts'

/**
 * 月视图的网格数学 —— 组件只管画，坐标全在这里算。
 *
 * 与 `layout.ts`（列表按顺序排行、**刻意不按时长成比例**）分工明确：
 * 那份文档字符串写着「没有轴就读不出比例」，日历正是那个有轴的地方，
 * 所以比例布局另开一个文件，不塞进去自相矛盾。
 *
 * 核心是一套连续坐标：`网格天数 = 距网格首日的天数 + 当天已过的比例`。
 * 区间、格子、周行都换算到这条数轴上，裁剪就只是求交集。
 */

export function mondayOfWeek(iso: string): string {
  return addDays(iso, -mondayIndex(iso))
}

/**
 * 带子格精度的区间。
 *
 * `frac` = 当天分钟数 / 1440，**恒有值** —— 解析器已经用
 * `DEFAULT_CHECK_IN` / `DEFAULT_CHECK_OUT` 把只写日期的那端补齐了，
 * 所以这里不存在「不知道画到哪」的情形，也就不需要渐隐端。
 */
export interface TimedSpan {
  startDate: string
  startFrac: number
  endDate: string
  endFrac: number
}

const DAY_MIN = 1440

/** 住和租车走**同一个**函数 —— 它们本来就是同一种东西（ReservationBase）。 */
export function reservationToTimed(r: Reservation): TimedSpan {
  return {
    startDate: r.from.date,
    startFrac: r.from.minute / DAY_MIN,
    endDate: r.to.date,
    endFrac: r.to.minute / DAY_MIN,
  }
}

/**
 * 网格要覆盖的闭区间：行程日期与所有预订日期的并集。
 *
 * 取并集是因为退房/还车可能晚于行程末日（清晨的航班前一夜还在酒店里），
 * 只按 `trip.dates` 画的话那一截会被网格边界吃掉。
 */
export function tripCalendarRange(
  dates: { start: string; end: string },
  reservations: Reservation[],
): { start: string; end: string } {
  let { start, end } = dates
  for (const r of reservations) {
    if (r.from.date < start) start = r.from.date
    if (r.to.date > end) end = r.to.date
  }
  return { start, end }
}

export interface WeekRow {
  /** 周一 */
  start: string
  /** 7 天，周一起 */
  dates: string[]
  /** 前后各多渲染的那一周 —— 渐隐显示 */
  outside: boolean
}

export interface MonthGrid {
  /** 网格首日（周一） */
  start: string
  weeks: WeekRow[]
}

/**
 * 按**闭区间日期**建网格，不按年月 —— 这不是通用月份浏览器，
 * 「月」只是一种渲染形态：窗口是围着这趟行程裁的。
 *
 * 行程周之外前后各多渲染一周（渐隐），让人看得到「出发前一周」「回来那几天」。
 */
export function buildMonthGrid(rangeStart: string, rangeEnd: string): MonthGrid {
  const firstMonday = mondayOfWeek(rangeStart)
  const lastMonday = mondayOfWeek(rangeEnd)
  // 正着算周数。不要用 daysBetween(gridStart, gridEnd)/7 反推 ——
  // 末日是周日，总天数是「周数 × 7 − 1」，除下来是小数
  const tripWeeks = daysBetween(firstMonday, lastMonday) / 7 + 1
  const start = addDays(firstMonday, -7)
  const weeks: WeekRow[] = []
  for (let w = 0; w < tripWeeks + 2; w++) {
    const rowStart = addDays(start, w * 7)
    weeks.push({
      start: rowStart,
      dates: Array.from({ length: 7 }, (_, d) => addDays(rowStart, d)),
      outside: w === 0 || w === tripWeeks + 1,
    })
  }
  return { start, weeks }
}

/** 区间在某一周行里的一段。left/width 是相对整行宽度的百分比，直接喂绝对定位。 */
export interface RowSegment {
  weekIndex: number
  leftPct: number
  widthPct: number
  /** 画不画圆角。被周行边界切断的那端为 false（齐平，表示「还没完」） */
  capStart: boolean
  capEnd: boolean
}

/** 换算到连续坐标：距网格首日多少天（含当天已过的比例） */
function posOf(gridStart: string, date: string, frac: number): number {
  return daysBetween(gridStart, date) + frac
}

export function clipSpanToGrid(grid: MonthGrid, span: TimedSpan): RowSegment[] {
  const from = posOf(grid.start, span.startDate, span.startFrac)
  const to = posOf(grid.start, span.endDate, span.endFrac)
  if (to < from) {
    throw new Error(`区间反了：${span.startDate} → ${span.endDate}`)
  }

  const out: RowSegment[] = []
  for (const [weekIndex, week] of grid.weeks.entries()) {
    const rowFrom = weekIndex * 7
    const rowTo = rowFrom + 7
    const segFrom = Math.max(from, rowFrom)
    const segTo = Math.min(to, rowTo)
    // 严格小于：区间正好收在周日 24:00 时，不给下一行留一段零宽
    if (segTo <= segFrom) continue
    void week
    out.push({
      weekIndex,
      leftPct: ((segFrom - rowFrom) / 7) * 100,
      widthPct: ((segTo - segFrom) / 7) * 100,
      capStart: segFrom === from,
      capEnd: segTo === to,
    })
  }
  return out
}

/**
 * 泳道分配：重叠的区间往下摞。返回值与入参**同序**。
 *
 * 住和租车都可能重叠 —— 租车是两人各租一辆；住宿正常写不重叠，
 * 但 trip-stays 是作者手写的独立区间，双订酒店这种录入错误挡不住，
 * 重叠时摞开画总比叠在一起消失强。算法本身在 `lanes.ts`，与周视图共用一份。
 */
export function assignLanes(items: TimedSpan[]): number[] {
  return packLanes(
    items.map((s) => ({ from: keyOf(s.startDate, s.startFrac), to: keyOf(s.endDate, s.endFrac) })),
  ).map((l) => l.lane)
}

/** 排序/比较用的绝对坐标，基准随便取一个固定日期即可 */
const EPOCH = '2000-01-01'
function keyOf(date: string, frac: number): number {
  return daysBetween(EPOCH, date) + frac
}
