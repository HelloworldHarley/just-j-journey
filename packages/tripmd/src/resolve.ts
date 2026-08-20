import type { Day, Place, Stay, Trip } from '@jjj/schema'

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
 * 被行程引用（事件 / 住宿 / 租车取还）但没有坐标的地点。
 *
 * 一份答案，两处消费：地图右下角那枚「N 个地点缺坐标」的 chip，
 * 和 `tools/enrich.ts` 要去地理编码的工作清单。两边口径必须一致 ——
 * chip 说 7 个而工具只查 5 个，是那种查起来很久的 bug。
 *
 * 未被引用的无坐标地点不算：它们本来就不上地图，也不值得去查。
 */
export function missingCoords(trip: Trip): Place[] {
  const referenced = new Set<string>()
  for (const day of trip.days) {
    for (const ev of day.events) if (ev.placeId) referenced.add(ev.placeId)
  }
  for (const s of trip.stays) if (s.placeId) referenced.add(s.placeId)
  for (const r of trip.rentals) {
    if (r.pickupPlaceId) referenced.add(r.pickupPlaceId)
    if (r.dropoffPlaceId) referenced.add(r.dropoffPlaceId)
  }
  return trip.places.filter((p) => p.coord === null && referenced.has(p.id))
}

/**
 * `detail:` 引用的归属 —— 全仓唯一的一份「首次引用」扫描。
 *
 * 首次引用按**日期序**判定，不是书写序：若 Day 2 写在 Day 1 前面，
 * 往返一次后首卡不能换人 —— 语义幂等踩在这条规则上。
 * 它同时决定三件事，三处消费必须同一口径：
 *
 * - 解析器把长途明细灌进哪个事件（票面时间轴长在哪张卡上）
 * - 前端把住宿/租车的信息模块挂到哪张卡、哪些卡是该去重的简单提及
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
