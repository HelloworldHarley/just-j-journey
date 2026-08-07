import {
  groupKeyOf,
  type CategoryKey,
  type Cost,
  type GroupKey,
  type TransportMode,
  type Trip,
} from '@jjj/schema'

/**
 * 预算模型 —— 从结构化 cost 现算，不依赖作者单独维护一张预算表。
 *
 * 钱有两个来源，各记各的、互不重复：
 * - **前置块**（长途 / 住宿 / 租车）：大额预订的钱写在记录自己身上 ——
 *   住宿记到入住日、租车记到取车日、长途记到引用它的那个事件所在天
 * - **事件**：当场发生的散项（门票、餐费、停车、寄存）
 *
 * 住在 lib 而不是预算页里：月视图格子右上角的当天预算必须和预算页**同一个口径**
 * （只算主币种、不含可选项）。两处各算一遍的话，同一个数字会在两个页面上不一样。
 */
export interface BudgetItem {
  id: string
  day: number
  date: string
  title: string
  category: CategoryKey
  raw: string
  /** null = 原文里没识别出金额 —— 仍进明细（显示 —），不进统计 */
  amount: number | null
  currency?: string
  optional: boolean
}

/** 长途的类目 = 第一段的交通方式；短途方式（步行/打车/电车…）归 transit */
const MODE_CATEGORY: Partial<Record<TransportMode, CategoryKey>> = {
  flight: 'flight',
  rail: 'rail',
  hsr: 'hsr',
  ferry: 'ferry',
  drive: 'drive',
  bus: 'bus',
}

export function buildBudget(trip: Trip) {
  const items: BudgetItem[] = []
  const push = (
    id: string,
    date: string,
    title: string,
    category: CategoryKey,
    cost: Cost,
  ): void => {
    items.push({
      id,
      // 日期在行程区间外（行前一夜的酒店）时 day 对不上任何一行，
      // byDay 里不出现，但照常计入总额与分类 —— 钱不会因此消失
      day: trip.days.find((d) => d.date === date)?.index ?? 0,
      date,
      title,
      category,
      raw: cost.raw,
      amount: cost.amount,
      currency: cost.currency,
      optional: cost.optional,
    })
  }

  for (const day of trip.days) {
    for (const e of day.events) {
      // 有 cost 就进明细 —— 列表卡片上看得见的费用，预算页一条都不静默丢
      if (e.cost) push(e.id, day.date, e.title, e.category, e.cost)
    }
  }
  for (const [i, st] of trip.stays.entries()) {
    if (st.cost) push(`stay-${i}`, st.from.date, st.what, 'hotel', st.cost)
  }
  for (const [i, r] of trip.rentals.entries()) {
    if (r.cost) push(`rental-${i}`, r.from.date, r.what, 'drive', r.cost)
  }
  for (const [i, j] of trip.journeys.entries()) {
    if (!j.cost) continue
    // 长途本身没有日期 —— 记到第一个引用它的事件那天；没人引用就记到行程首日
    const day = trip.days.find((d) => d.events.some((e) => e.detailRef === j.what))
    const category = MODE_CATEGORY[j.transports[0]?.mode ?? 'flight'] ?? 'transit'
    push(`journey-${i}`, day?.date ?? trip.dates.start, j.what, category, j.cost)
  }

  // 明细按日期排 —— 前置块的行插回它们发生的那天，而不是拖在表尾
  items.sort((a, b) => a.date.localeCompare(b.date))

  /**
   * 主币种 = 出现次数最多的那个（没有金额时回退到 frontmatter 的 currency）。
   *
   * **不同币种的金额绝不能相加。** parseCost 是按每条 cost 文本里的符号单独判币种的，
   * 所以「整体按 $ 记账、某条小吃随手写 ¥1200」很常见 —— 直接 reduce 会得到
   * $140 + ¥1200 = 1340 这种假总数，而卡片上每条自己显示得都对，
   * 恰好构成「卡片对、预算页错」的不一致。这里只统计主币种，其余单列。
   */
  const withAmount = items.filter((i): i is BudgetItem & { amount: number } => i.amount != null)
  const tally = new Map<string, number>()
  for (const i of withAmount) tally.set(i.currency ?? '', (tally.get(i.currency ?? '') ?? 0) + 1)
  const primary =
    [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || (trip.currency ?? '')
  const isPrimary = (i: BudgetItem) => (i.currency ?? '') === primary

  const counted = withAmount.filter((i) => !i.optional && isPrimary(i))
  const total = counted.reduce((n, i) => n + i.amount, 0)
  const optionalTotal = withAmount
    .filter((i) => i.optional && isPrimary(i))
    .reduce((n, i) => n + i.amount, 0)

  // 非主币种的条目：明细里照常列出，但不并进总额 —— 按币种分别汇总后单独展示
  const otherCurrencies = [...tally.keys()]
    .filter((c) => c !== primary)
    .map((c) => ({
      currency: c || undefined,
      amount: withAmount
        .filter((i) => !i.optional && (i.currency ?? '') === c)
        .reduce((n, i) => n + i.amount, 0),
    }))
    .filter((r) => r.amount > 0)

  const byGroup: Record<GroupKey, number> = { play: 0, food: 0, other: 0 }
  const catMap = new Map<CategoryKey, number>()
  for (const i of counted) {
    byGroup[groupKeyOf(i.category)] += i.amount
    catMap.set(i.category, (catMap.get(i.category) ?? 0) + i.amount)
  }
  const byCategory = [...catMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)

  const byDay = trip.days.map((d) => {
    const rows = counted.filter((i) => i.day === d.index)
    const g: Record<GroupKey, number> = { play: 0, food: 0, other: 0 }
    for (const i of rows) g[groupKeyOf(i.category)] += i.amount
    return { index: d.index, date: d.date, byGroup: g, total: rows.reduce((n, i) => n + i.amount, 0) }
  })

  return {
    items,
    total,
    optionalTotal,
    otherCurrencies,
    byGroup,
    byCategory,
    byDay,
    maxCategory: Math.max(...byCategory.map((r) => r.amount), 1),
    maxDay: Math.max(...byDay.map((r) => r.total), 1),
    currency: primary || undefined,
  } as const
}
