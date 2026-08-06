import { CATEGORIES, type Reference, type Rental, type Stay, type Trip } from '@jjj/schema'

/**
 * 从 Trip 派生「信息模块」的归属 —— 哪张卡片该长出住宿/租车模块。
 *
 * 统一卡片模板下，住/行不再有专属卡片组件；差异全部表现为
 * 卡片内部的可选信息模块。这里回答「模块挂在哪个事件上」：
 *
 * - 住宿：trip-stays 是作者直接写的区间；**只有入住当天的那个事件**
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

/**
 * 住宿模块归属：eventId → 住宿区间，归到区间内第一个匹配的住类事件。
 *
 * 不锁死在 from 当天 —— 行前一夜就住下时（清晨航班前先到酒店），
 * from 落在行程区间之外，那天根本没有 Day；只查那一天的话
 * 平台/星级/退改整段信息会静默消失。月视图为同一场景扩了网格
 * （见 tripCalendarRange），列表这头的口径必须一致。
 */
export function stayModuleMap(trip: Trip): Map<string, Stay> {
  const map = new Map<string, Stay>()
  for (const st of trip.stays) {
    for (const day of trip.days) {
      if (day.date < st.from.date || day.date > st.to.date) continue
      const ev = day.events.find(
        (e) =>
          CATEGORIES[e.category].kind === 'stay' &&
          !map.has(e.id) &&
          (e.placeId === st.placeId || e.title.includes(st.what)),
      )
      if (ev) {
        map.set(ev.id, st)
        break
      }
    }
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
  stay: Map<string, Stay>,
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
