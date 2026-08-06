import type { Day, Rental } from '@jjj/schema'
import { daySpan } from './layout.ts'

/**
 * 周视图的纵轴数学 —— 分钟换成百分比，组件只管画。
 *
 * 轴范围跟着当前这几天自适应：早出发的行程从 06:00 开始，
 * 夜生活多的行程往后延。写死 00:00–24:00 的话，
 * 一天里真正有事的那 12 小时会被压成半屏。
 */

const DAY_MIN = 1440
/** 轴至少这么宽，否则只有一两个事件的一页会被拉成巨型方块 */
const MIN_SPAN_MIN = 8 * 60

export interface WeekAxis {
  /** 轴起点（分钟，整点） */
  from: number
  /** 轴终点（分钟，整点，可 > 1440 表示跨午夜） */
  to: number
}

/**
 * 取当前页所有天的最早开始 / 最晚结束，向整点外扩，再保证 8 小时下限。
 *
 * **租车不参与** —— 一辆凌晨 3 点取的车会把所有列的轴硬拉宽，
 * 而它只是一层底色。底色超出轴范围时钳到边界即可（精确时刻在卡片里逐字写着）。
 */
export function computeWeekAxis(days: Day[]): WeekAxis {
  let from = Infinity
  let to = -Infinity
  for (const d of days) {
    const s = daySpan(d)
    if (!s) continue
    from = Math.min(from, s.from)
    to = Math.max(to, s.to)
  }
  if (!Number.isFinite(from) || !Number.isFinite(to)) return { from: 8 * 60, to: 22 * 60 }

  from = Math.floor(from / 60) * 60
  to = Math.ceil(to / 60) * 60
  if (to - from < MIN_SPAN_MIN) {
    // 优先往下补（晚上的空白比清晨的更常被用到），不够再往上
    to = from + MIN_SPAN_MIN
    if (to > DAY_MIN + 6 * 60) {
      to = DAY_MIN + 6 * 60
      from = to - MIN_SPAN_MIN
    }
  }
  return { from, to: Math.max(to, from + 60) }
}

/** 分钟 → 轴上的百分比。超出轴的钳到 0 / 100。 */
export function minuteToPct(minute: number, axis: WeekAxis): number {
  const pct = ((minute - axis.from) / (axis.to - axis.from)) * 100
  return Math.min(100, Math.max(0, pct))
}

/** 租车底色在某一列里的上下缘（百分比）。clamped 表示那一端被轴切掉了。 */
export interface RentalBand {
  topPct: number
  bottomPct: number
  clampedTop: boolean
  clampedBottom: boolean
}

/**
 * 某一天这辆车占据的时段：
 * 取车日 `[取车时刻, 当天结束]`、中间日整列、还车日 `[当天开始, 还车时刻]`、
 * 单日租车 `[取, 还]`；这天不在租期内返回 null。
 */
export function rentalBandForColumn(
  rental: Rental,
  columnDate: string,
  axis: WeekAxis,
): RentalBand | null {
  if (columnDate < rental.from.date || columnDate > rental.to.date) return null

  const startMin = columnDate === rental.from.date ? rental.from.minute : 0
  // 「铺到列底」的列底是轴底，不是 24:00 —— 轴可以 > 1440（跨午夜时拉长），
  // 只铺到 1440 会在午夜刻度处留一截没底色的空白，而那段人明明还有车
  const endMin = columnDate === rental.to.date ? rental.to.minute : Math.max(DAY_MIN, axis.to)
  if (endMin <= startMin) return null

  return {
    topPct: minuteToPct(startMin, axis),
    bottomPct: minuteToPct(endMin, axis),
    clampedTop: startMin < axis.from,
    clampedBottom: endMin > axis.to,
  }
}

/** 一辆车在这一页所有列上的底色带 */
export function rentalBandsForWeek(
  rental: Rental,
  columns: string[],
  axis: WeekAxis,
): { col: number; band: RentalBand }[] {
  const out: { col: number; band: RentalBand }[] = []
  for (const [col, date] of columns.entries()) {
    const band = rentalBandForColumn(rental, date, axis)
    if (band) out.push({ col, band })
  }
  return out
}
