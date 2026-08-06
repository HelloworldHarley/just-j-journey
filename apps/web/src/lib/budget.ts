import { groupKeyOf, type CategoryKey, type GroupKey, type Trip } from '@jjj/schema'

/**
 * 预算模型 —— 从事件的结构化 cost 现算，不依赖作者单独维护一张预算表。
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

export function buildBudget(trip: Trip) {
  const items: BudgetItem[] = []
  for (const day of trip.days) {
    for (const e of day.events) {
      // 有 cost 就进明细 —— 列表卡片上看得见的费用，预算页一条都不静默丢
      if (!e.cost) continue
      items.push({
        id: e.id,
        day: day.index,
        date: day.date,
        title: e.title,
        category: e.category,
        raw: e.cost.raw,
        amount: e.cost.amount,
        currency: e.cost.currency,
        optional: e.cost.optional,
      })
    }
  }

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
