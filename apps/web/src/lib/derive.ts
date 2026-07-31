import { CATEGORIES, type Day, type Reference, type Rental, type Trip } from '@jjj/schema'

/**
 * 从 Trip 派生「信息模块」的归属 —— 哪张卡片该长出住宿/租车模块。
 *
 * 统一卡片模板下，住/行不再有专属卡片组件；差异全部表现为
 * 卡片内部的可选信息模块。这里回答「模块挂在哪个事件上」：
 *
 * - 住宿：连续住同一家的夜晚合并成区间；**只有区间首晚的入住事件**
 *   显示完整模块（几晚、哪天到哪天），当天再回酒店、之后每天回酒店
 *   都只是普通简卡 —— 同一家酒店的信息说一遍就够了。
 * - 租车：trip-rentals 是横跨行程的区间，模块挂在取车当天、
 *   地点与取车点一致的那个事件上（通常是「提车」）。
 */

/**
 * 预算类附录归预算页 —— 作者写的点数策略、砍价顺序、风险变量
 * 和自动统计的数字放在一起才有用；资料页不再出现预算分区。
 */
export function isBudgetRef(ref: Reference): boolean {
  return ref.id === 'budget' || /预算|budget/i.test(ref.title)
}

export interface StaySpan {
  name: string
  placeId: string | null
  note?: string
  /** 入住日 */
  checkIn: string
  /** 退房日 = 最后一晚的次日 */
  checkOut: string
  nights: number
}

export function buildStaySpans(days: Day[]): StaySpan[] {
  const spans: StaySpan[] = []
  for (const day of days) {
    if (!day.lodging) continue
    const last = spans[spans.length - 1]
    if (last && last.name === day.lodging.name && last.checkOut === day.date) {
      last.nights += 1
      last.checkOut = nextDay(day.date)
      if (!last.note && day.lodging.note) last.note = day.lodging.note
    } else {
      spans.push({
        name: day.lodging.name,
        placeId: day.lodging.placeId,
        note: day.lodging.note,
        checkIn: day.date,
        checkOut: nextDay(day.date),
        nights: 1,
      })
    }
  }
  return spans
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** 住宿模块归属：eventId → 区间。每个区间只归到首晚第一个匹配的住类事件。 */
export function stayModuleMap(trip: Trip): Map<string, StaySpan> {
  const map = new Map<string, StaySpan>()
  const spans = buildStaySpans(trip.days)
  for (const span of spans) {
    const day = trip.days.find((d) => d.date === span.checkIn)
    if (!day) continue
    const ev = day.events.find(
      (e) =>
        CATEGORIES[e.category].kind === 'stay' &&
        (e.placeId === span.placeId || e.title.includes(span.name)),
    )
    if (ev) map.set(ev.id, span)
  }
  return map
}

/** 租车模块归属：eventId → 租赁。挂在取车当天、地点与取车点一致的事件上。 */
export function rentalModuleMap(trip: Trip): Map<string, Rental> {
  const map = new Map<string, Rental>()
  for (const rental of trip.rentals) {
    const day = trip.days.find((d) => d.date === rental.from.date)
    if (!day) continue
    const ev =
      day.events.find(
        (e) => e.placeId !== null && e.placeId === rental.pickupPlaceId && !map.has(e.id),
      ) ?? undefined
    if (ev) map.set(ev.id, rental)
  }
  return map
}

/**
 * 「住」「行」视图的去重集合 —— 同一家酒店 / 同一辆租车只保留最开始那张卡：
 *
 * - 住：不是区间首卡的住类事件（当晚再回酒店、连住第二天）全部隐藏
 * - 行：租期内、地点是取/还车点、又不是取车卡的行类事件（还车）隐藏
 *
 * 只作用于住/行筛选视图；「全部」照常显示每一张卡。
 */
export function dedupIds(
  trip: Trip,
  stay: Map<string, StaySpan>,
  rental: Map<string, Rental>,
): Set<string> {
  const dup = new Set<string>()
  for (const day of trip.days) {
    for (const e of day.events) {
      const kind = CATEGORIES[e.category].kind
      if (kind === 'stay' && !stay.has(e.id)) dup.add(e.id)
      if (kind === 'move' && !rental.has(e.id) && e.placeId) {
        for (const r of trip.rentals) {
          if (day.date < r.from.date || day.date > r.to.date) continue
          if (e.placeId === r.pickupPlaceId || e.placeId === r.dropoffPlaceId) dup.add(e.id)
        }
      }
    }
  }
  return dup
}
