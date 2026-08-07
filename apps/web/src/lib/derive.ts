import type { Reference, Rental, Stay, Trip } from '@jjj/schema'

/**
 * `detail:` 引用的归属 —— 哪张卡片长出信息模块、哪些卡片是「简单提及」。
 *
 * 事件用 `detail: 名字` 显式指认前置记录（长途/住宿/长租），这里只做两件事：
 *
 * - **首次引用**（按日期序，与解析器灌长途明细的口径一致）拿到信息模块；
 * - 之后的引用是简单提及：普通卡片，且在住/行筛选视图里去重隐藏 ——
 *   同一家酒店、同一辆车的信息说一遍就够了。
 *
 * 这里没有任何按地点/名字猜归属的启发式 —— 那套东西曾经因为
 * 名字大小写漂移把连住区间拆断过（F3），显式引用之后整类问题不存在了。
 */

/**
 * 预算类附录归预算页 —— 作者写的点数策略、砍价顺序、风险变量
 * 和自动统计的数字放在一起才有用；资料页不再出现预算分区。
 */
export function isBudgetRef(ref: Reference): boolean {
  return ref.id === 'budget' || /预算|budget/i.test(ref.title)
}

export interface DetailModules {
  /** eventId → 住宿记录（只含首次引用） */
  stay: Map<string, Stay>
  /** eventId → 租赁记录（只含首次引用） */
  rental: Map<string, Rental>
  /** 非首次引用的事件 —— 住/行筛选视图里隐藏 */
  dup: Set<string>
}

export function detailModules(trip: Trip): DetailModules {
  const stayByWhat = new Map(trip.stays.map((s) => [s.what, s]))
  const rentalByWhat = new Map(trip.rentals.map((r) => [r.what, r]))

  const stay = new Map<string, Stay>()
  const rental = new Map<string, Rental>()
  const dup = new Set<string>()
  const seen = new Set<string>()

  for (const day of trip.days) {
    for (const e of day.events) {
      if (!e.detailRef) continue
      if (seen.has(e.detailRef)) {
        dup.add(e.id)
        continue
      }
      seen.add(e.detailRef)
      const st = stayByWhat.get(e.detailRef)
      if (st) stay.set(e.id, st)
      const r = rentalByWhat.get(e.detailRef)
      if (r) rental.set(e.id, r)
      // 长途的「模块」是票面时间轴，解析器已把明细灌进首次引用的事件
    }
  }
  return { stay, rental, dup }
}
