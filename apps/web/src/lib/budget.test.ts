import { describe, expect, it } from 'vitest'
import { parse } from '@jjj/tripmd'
import { buildBudget } from './budget.ts'

/**
 * 预算的两个来源各记各的：前置块（长途/住宿/租车）+ 事件散项。
 * 这里钉住归属规则 —— 住宿记入住日、租车记取车日、长途记引用它的那天，
 * 以及「前置块的钱搬走之后事件不再重复计」这一迁移约定本身。
 */
const MD = `---
id: t
title: T
destination: X
timezone: UTC
start: 2026-10-01
end: 2026-10-03
currency: USD
---

## 长途

\`\`\`trip-transports
- what: 去程
  cost: $200
  transport: {mode: flight, from: A, to: B, arr_time: "13:00"}
\`\`\`

## 住宿

\`\`\`trip-stays
- what: Astra
  from: "2026-10-01 16:00"
  to: "2026-10-03 10:00"
  cost: $340
\`\`\`

## 租车

\`\`\`trip-rentals
- what: Macan
  from: "2026-10-02 11:30"
  to: "2026-10-03 11:20"
  cost: $310
\`\`\`

## Day 1 · 2026-10-01

### 抵达

\`\`\`trip-event
time: "13:00"
category: flight
detail: 去程
\`\`\`

## Day 2 · 2026-10-02

### 提车

\`\`\`trip-event
time: "11:30"
category: drive
cost: 停车 $20
\`\`\`
`

describe('buildBudget 前置块统计', () => {
  const trip = parse(MD).trip!
  const model = buildBudget(trip)

  it('三类前置记录 + 事件散项各计一次', () => {
    expect(model.total).toBe(200 + 340 + 310 + 20)
  })

  it('归属：长途记引用日、住宿记入住日、租车记取车日', () => {
    const d1 = model.byDay.find((d) => d.date === '2026-10-01')!
    const d2 = model.byDay.find((d) => d.date === '2026-10-02')!
    expect(d1.total).toBe(200 + 340)
    expect(d2.total).toBe(310 + 20)
  })

  it('入住日在行程区间外时不进 byDay，但总额不丢', () => {
    const early = MD.replace('from: "2026-10-01 16:00"', 'from: "2026-09-30 16:00"')
    const m2 = buildBudget(parse(early).trip!)
    expect(m2.total).toBe(870)
    expect(m2.byDay.reduce((n, d) => n + d.total, 0)).toBe(870 - 340)
  })
})
