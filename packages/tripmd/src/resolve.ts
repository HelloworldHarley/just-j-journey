import type { Day, Journey, Leg, Place, Rental, Stay, Trip } from '@jjj/schema'

/**
 * 这一天你在哪儿醒来 —— 覆盖当天清晨的那条住宿区间。
 *
 * 判据只比**日期**不比时刻：`from.date < date ≤ to.date`。
 * 时刻在这里一点用没有 —— 「几点入住」说的是当天傍晚的事，
 * 拿它和第二天早上的出发时刻比大小，得跨时区、跨午夜地推，全是坑。
 * 而按日期判就自带两个正确的边界：
 *
 * - **入住当天不算**（`from.date < date` 不成立）—— 那天早上你还没到，
 *   落地日不该凭空长出「从酒店出发」，例外不用作者手工标；
 * - **退房当天算**（`≤ to.date`）—— 早上人确实还在房里，这一天照样从住处出发。
 *
 * 「开场通勤」与将来的住宿相关派生共用这一份，口径不会漂。
 */
export function stayOfMorning(stays: readonly Stay[], date: string): Stay | null {
  return stays.find((s) => s.from.date < date && date <= s.to.date) ?? null
}

/**
 * 一天里的路：开场通勤（昨晚住处 → 第一站，`from_stay`）与每个事件出发的那段（`to_next`）。
 *
 * 路按 `afterEventId` 挂在出发的事件上，开场段的 afterEventId 是 null。全仓按事件找路只走这里 ——
 * 曾经序列化、日历导出、余量检查、公开版、列表、地图各写一遍「先滤掉 null 再建表」，漏滤一处就把开场段挂错。
 */
export interface DayLegs {
  /** 开场通勤；这天不从住处出发时没有 */
  opening: Leg | undefined
  /** eventId → 从这个事件出发的那段路 */
  after: ReadonlyMap<string, Leg>
}

export function legsOf(day: { readonly legs: readonly Leg[] }): DayLegs {
  let opening: Leg | undefined
  const after = new Map<string, Leg>()
  for (const leg of day.legs) {
    if (leg.afterEventId === null) opening ??= leg
    else after.set(leg.afterEventId, leg)
  }
  return { opening, after }
}

/** 第 i 个事件的进出两段路：进来的是前一个事件的 to_next（当天第一个事件则是开场通勤），出去的是它自己的 to_next */
export function adjacentLegs(
  day: { readonly events: readonly { id: string }[]; readonly legs: readonly Leg[] },
  i: number,
): { incoming: Leg | undefined; outgoing: Leg | undefined } {
  const { opening, after } = legsOf(day)
  const prev = day.events[i - 1]
  const self = day.events[i]
  return {
    incoming: i === 0 ? opening : prev && after.get(prev.id),
    outgoing: self && after.get(self.id),
  }
}

/** 被行程引用的地点 id：事件、通勤两端、住宿、租车取还。没人引用的地点不上地图、不上列表，也不进公开版 */
export function referencedPlaceIds(trip: Pick<Trip, 'days' | 'stays' | 'rentals'>): Set<string> {
  const ids = new Set<string>()
  const add = (id: string | null | undefined): void => {
    if (id) ids.add(id)
  }
  for (const day of trip.days) {
    for (const ev of day.events) add(ev.placeId)
    for (const leg of day.legs) {
      add(leg.from)
      add(leg.to)
    }
  }
  for (const s of trip.stays) add(s.placeId)
  for (const r of trip.rentals) {
    add(r.pickupPlaceId)
    add(r.dropoffPlaceId)
  }
  return ids
}

/**
 * 被行程引用（referencedPlaceIds）但没有坐标的地点。
 *
 * 一份答案，两处消费：地图右下角那枚「N 个地点缺坐标」的 chip，
 * 和 `tools/enrich.ts` 要去地理编码的工作清单。两边口径必须一致 ——
 * chip 说 7 个而工具只查 5 个，是那种查起来很久的 bug。
 *
 * 未被引用的无坐标地点不算：它们本来就不上地图，也不值得去查。
 */
export function missingCoords(trip: Trip): Place[] {
  const referenced = referencedPlaceIds(trip)
  return trip.places.filter((p) => p.coord === null && referenced.has(p.id))
}

/**
 * `detail:` 引用的归属 —— 全仓唯一的一份「首次引用」扫描。
 *
 * 首次引用按**日期序**判定，不是书写序：若 Day 2 写在 Day 1 前面，
 * 往返一次后首卡不能换人 —— 语义幂等踩在这条规则上。
 * 它同时决定两件事，消费方必须同一口径：
 *
 * - 票面 / 住宿 / 租车模块挂到哪张卡、哪些卡是该去重的简单提及（`resolveDetails`）
 * - 预算把长途的钱记到哪一天
 *
 * 曾经是三份各自的扫描（parse / derive / budget），漂移一处就是
 * 「时间轴挂 A 卡、钱记 B 天」。现在只有这一份。
 */
export interface DetailIndex {
  /** what → 首次引用它的 eventId */
  firstRef: Map<string, string>
  /** what → 首次引用所在日期 (ISO)。预算的「长途记哪天」从这里取 */
  firstRefDate: Map<string, string>
  /** 非首次引用的 eventId —— 住/行筛选视图里去重隐藏 */
  dup: Set<string>
}

/** days 必须已按日期排序 —— parse 在 days.sort 之后才调它，别的调用方拿到的 Trip 天生有序 */
export function detailIndex(days: readonly Day[]): DetailIndex {
  const firstRef = new Map<string, string>()
  const firstRefDate = new Map<string, string>()
  const dup = new Set<string>()

  for (const day of days) {
    for (const ev of day.events) {
      if (!ev.detailRef) continue
      if (firstRef.has(ev.detailRef)) {
        dup.add(ev.id)
        continue
      }
      firstRef.set(ev.detailRef, ev.id)
      firstRefDate.set(ev.detailRef, day.date)
    }
  }
  return { firstRef, firstRefDate, dup }
}

/**
 * `detail:` 的对号入座 —— 首次引用的事件挂上它指向的那条前置记录（长途票面、住宿区间、租车区间），
 * 之后的引用是简单提及（回酒店、还车），住 / 行筛选视图里去重。
 *
 * 三种记录一个口径，全仓只在这里查：列表的信息模块、月历的换乘图标、公开版找端点卡都读它。
 * 事件上不存副本 —— 曾经长途明细被复制进首次引用的事件，序列化不写那份，改了就静默丢。
 */
export interface ResolvedDetails {
  /** eventId → 长途（只含首次引用：票面时间轴长在这张卡上） */
  journeyOf: Map<string, Journey>
  /** eventId → 住宿（只含首次引用：入住卡） */
  stayOf: Map<string, Stay>
  /** eventId → 租车（只含首次引用：取车卡） */
  rentalOf: Map<string, Rental>
  /** 非首次引用的 eventId */
  dup: Set<string>
}

export function resolveDetails(trip: Pick<Trip, 'days' | 'journeys' | 'stays' | 'rentals'>): ResolvedDetails {
  const { firstRef, dup } = detailIndex(trip.days)
  const byEvent = <T extends { what: string }>(records: readonly T[]): Map<string, T> =>
    new Map(records.flatMap((r) => {
      const evId = firstRef.get(r.what)
      return evId === undefined ? [] : [[evId, r] as const]
    }))
  return { journeyOf: byEvent(trip.journeys), stayOf: byEvent(trip.stays), rentalOf: byEvent(trip.rentals), dup }
}
