import { useMemo } from 'react'
import {
  CATEGORIES,
  GROUPS,
  type CategoryKey,
  type GroupKey,
  type Trip,
} from '@jjj/schema'
import { CategoryChip } from '../../components/CategoryChip.tsx'
import { fmtMoney } from '../../components/DayTimeline.tsx'

/**
 * 预算页 —— 从事件的结构化 cost 现算，不依赖作者单独维护一张预算表。
 * 作者在事件上写 "约 $70/人"，解析器抽出金额，这里聚合。
 * 任何 TripMD 行程导入后这页自动成立。
 *
 * 图表遵循 dataviz 规范：单轴、细 mark、数据端 2px 圆角、分段间 2px 表面缝、
 * 文字永远用文字色而非系列色、每根条直接标注（≤12 根时）。
 */
export function BudgetView({ trip }: { trip: Trip }) {
  const model = useMemo(() => build(trip), [trip])

  if (model.items.length === 0) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-16 text-[13px] text-graphite">
        这份行程的事件里没有可统计的费用。在 trip-event 的 <code>cost</code> 字段写上金额
        （如 <code>约 $70/人</code>）即可自动进入统计。
      </p>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-8">
      {/* 头部：总额是这页的答案，直接给 */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="signage text-[11px] text-graphite">预估总支出</div>
          <div className="tnum mt-1 text-[40px] font-medium leading-none tracking-[-0.02em] text-ink">
            {fmtMoney(model.total, model.currency)}
          </div>
          {model.optionalTotal > 0 && (
            <div className="mt-1.5 text-[12.5px] text-graphite">
              另有可选项目 <span className="tnum">{fmtMoney(model.optionalTotal, model.currency)}</span>
              ，未计入
            </div>
          )}
        </div>
        <div className="flex gap-5 text-[12px] text-graphite">
          {(['play', 'food', 'other'] as GroupKey[]).map((g) => (
            <div key={g}>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-[8px] w-[8px] rounded-full"
                  style={{ background: `var(--g-${g})`, opacity: g === 'other' ? 0.45 : 1 }}
                />
                {GROUPS[g].zh}
              </span>
              <div className="tnum mt-0.5 text-[15px] text-ink">
                {fmtMoney(model.byGroup[g], model.currency)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 分组占比条：一根 100% 堆叠条，分段之间 2px 表面缝 */}
      <div className="mt-5 flex h-[14px] gap-[2px] overflow-hidden rounded-[4px]" aria-hidden>
        {(['play', 'food', 'other'] as GroupKey[]).map((g) =>
          model.byGroup[g] > 0 ? (
            <span
              key={g}
              style={{
                width: `${(model.byGroup[g] / model.total) * 100}%`,
                background: `var(--g-${g})`,
                opacity: g === 'other' ? 0.45 : 1,
              }}
              title={`${GROUPS[g].zh} ${fmtMoney(model.byGroup[g], model.currency)}`}
            />
          ) : null,
        )}
      </div>

      {/* 按细类的横向条形图。类目数有限（≤11），每根直接标注，不需要图例 */}
      <section className="mt-10">
        <h2 className="signage mb-4 text-[11px] text-graphite">按类目</h2>
        <div className="space-y-2.5">
          {model.byCategory.map((row) => (
            <div key={row.category} className="grid grid-cols-[7rem_minmax(0,1fr)_5rem] items-center gap-3">
              <span className="flex items-center gap-2 text-[12.5px] text-soft">
                <CategoryChip category={row.category} size={18} />
                {CATEGORIES[row.category].zh}
              </span>
              <div className="h-[10px] overflow-hidden rounded-r-[3px]">
                <div
                  className="h-full rounded-r-[3px]"
                  style={{
                    width: `${(row.amount / model.maxCategory) * 100}%`,
                    background: `var(--g-${CATEGORIES[row.category].group})`,
                    opacity: CATEGORIES[row.category].group === 'other' ? 0.45 : 1,
                  }}
                />
              </div>
              <span className="tnum text-right text-[13px] text-ink">
                {fmtMoney(row.amount, model.currency)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 按天 */}
      <section className="mt-10">
        <h2 className="signage mb-4 text-[11px] text-graphite">按天</h2>
        <div className="space-y-2.5">
          {model.byDay.map((row) => (
            <div key={row.index} className="grid grid-cols-[7rem_minmax(0,1fr)_5rem] items-center gap-3">
              <span className="text-[12.5px] text-soft">
                <span className="signage text-[10px] text-graphite">Day {row.index}</span>
                <span className="tnum ml-1.5">{row.date.slice(5).replace('-', '/')}</span>
              </span>
              <div className="flex h-[10px] gap-[2px] overflow-hidden rounded-r-[3px]">
                {(['play', 'food', 'other'] as GroupKey[]).map((g) =>
                  row.byGroup[g] > 0 ? (
                    <span
                      key={g}
                      style={{
                        width: `${(row.byGroup[g] / model.maxDay) * 100}%`,
                        background: `var(--g-${g})`,
                        opacity: g === 'other' ? 0.45 : 1,
                      }}
                    />
                  ) : null,
                )}
              </div>
              <span className="tnum text-right text-[13px] text-ink">
                {fmtMoney(row.total, model.currency)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 明细表：图表之外必须有可核对的数字来源 */}
      <section className="mt-10">
        <h2 className="signage mb-3 text-[11px] text-graphite">明细</h2>
        <div className="table-scroll">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-graphite">
                <th className="py-1.5 pr-3 font-normal">天</th>
                <th className="py-1.5 pr-3 font-normal">项目</th>
                <th className="py-1.5 pr-3 font-normal">原文</th>
                <th className="py-1.5 text-right font-normal">金额</th>
              </tr>
            </thead>
            <tbody>
              {model.items.map((it) => (
                <tr key={it.id} className="border-t border-[var(--hairline)]">
                  <td className="tnum py-2 pr-3 whitespace-nowrap text-graphite">D{it.day}</td>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-1.5 text-ink">
                      <CategoryChip category={it.category} size={16} />
                      <span className="min-w-0">{it.title}</span>
                      {it.optional && (
                        <span className="rounded-sm bg-[var(--paper-sunken)] px-1 text-[10px] text-graphite">
                          可选
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="max-w-[16rem] truncate py-2 pr-3 text-graphite" title={it.raw}>
                    {it.raw}
                  </td>
                  <td className="tnum py-2 text-right whitespace-nowrap text-ink">
                    {fmtMoney(it.amount, model.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-graphite">
          金额从各事件的 cost 文本自动提取：/人 已乘人数（{trip.travelers ?? 1} 人），区间取中值。
          标注「可选」的不计入总额。以原文为准。
        </p>
      </section>
    </div>
  )
}

// ── 聚合 ────────────────────────────────────────────────────────

interface Item {
  id: string
  day: number
  date: string
  title: string
  category: CategoryKey
  raw: string
  amount: number
  currency?: string
  optional: boolean
}

function build(trip: Trip) {
  const items: Item[] = []
  for (const day of trip.days) {
    for (const e of day.events) {
      if (e.cost?.amount == null) continue
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

  const counted = items.filter((i) => !i.optional)
  const total = counted.reduce((n, i) => n + i.amount, 0)
  const optionalTotal = items.filter((i) => i.optional).reduce((n, i) => n + i.amount, 0)

  const byGroup: Record<GroupKey, number> = { play: 0, food: 0, other: 0 }
  const catMap = new Map<CategoryKey, number>()
  for (const i of counted) {
    byGroup[CATEGORIES[i.category].group] += i.amount
    catMap.set(i.category, (catMap.get(i.category) ?? 0) + i.amount)
  }
  const byCategory = [...catMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)

  const byDay = trip.days.map((d) => {
    const rows = counted.filter((i) => i.day === d.index)
    const g: Record<GroupKey, number> = { play: 0, food: 0, other: 0 }
    for (const i of rows) g[CATEGORIES[i.category].group] += i.amount
    return { index: d.index, date: d.date, byGroup: g, total: rows.reduce((n, i) => n + i.amount, 0) }
  })

  return {
    items,
    total,
    optionalTotal,
    byGroup,
    byCategory,
    byDay,
    maxCategory: Math.max(...byCategory.map((r) => r.amount), 1),
    maxDay: Math.max(...byDay.map((r) => r.total), 1),
    currency: counted[0]?.currency ?? trip.currency,
  } as const
}
