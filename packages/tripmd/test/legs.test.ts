import { describe, expect, it } from 'vitest'
import { parse } from '../src/parse.ts'
import { serialize } from '../src/serialize.ts'

/**
 * 分段票面（transport.legs）—— 中转前后班次号/客舱/座位各一份，
 * 联程属性（价格/全程/直挂）留在顶层。
 */

const wrap = (transport: string): string => `---
id: t
title: T
destination: X
timezone: UTC
start: 2026-10-01
end: 2026-10-01
---

## 长途

\`\`\`trip-transports
- what: J
  transport:
    - ${transport}
\`\`\`

## Day 1 · 2026-10-01

### 到

\`\`\`trip-event
time: "10:00"
category: flight
detail: J
\`\`\`
`

const LEGGED = `{mode: flight, carrier: K, from: A, to: B, dep_time: "10:00", arr_time: "20:00", stops: [{airport: C, arr_time: "12:00", dep_time: "14:00"}], legs: [{number: X1, cabin: Y, seat: 1A}, {number: X2, seat: 2B}]}`

describe('transport.legs 分段信息', () => {
  it('逐段解析班次/客舱/座位，顶层 seat 不再折进 cabin', () => {
    const r = parse(wrap(`{mode: flight, number: X9, cabin: Y, seat: 9F, from: A, to: B}`))
    expect(r.diagnostics).toEqual([])
    const t = r.trip!.days[0]!.events[0]!.transports[0]!
    expect(t.cabin).toBe('Y')
    expect(t.seat).toBe('9F')

    const r2 = parse(wrap(LEGGED))
    expect(r2.diagnostics).toEqual([])
    const t2 = r2.trip!.days[0]!.events[0]!.transports[0]!
    expect(t2.legs).toEqual([
      { number: 'X1', cabin: 'Y', seat: '1A' },
      { number: 'X2', cabin: undefined, seat: '2B' },
    ])
  })

  it('legs 数量与行进段（stops + 1）对不上 → 响亮警告', () => {
    const r = parse(
      wrap(`{mode: flight, from: A, to: B, stops: [{airport: C}], legs: [{number: X1}]}`),
    )
    expect(r.diagnostics.some((d) => d.message.includes('legs 有 1 段'))).toBe(true)
  })

  it('legs 的未知字段警告 + 建议，不静默吞掉', () => {
    const r = parse(wrap(`{mode: flight, from: A, to: B, legs: [{numbr: X1}]}`))
    expect(r.diagnostics.some((d) => d.message.includes('numbr'))).toBe(true)
  })

  it('托运/退改是整张票的事：写在 legs 里会被当未知字段警告', () => {
    const r = parse(wrap(`{mode: flight, from: A, to: B, legs: [{number: X1, refund: 不可改}]}`))
    expect(r.diagnostics.some((d) => d.message.includes('refund'))).toBe(true)
  })

  it('through_check 已退役：写了会警告，直挂说明该进 note', () => {
    const r = parse(wrap(`{mode: flight, from: A, to: B, through_check: 行李直挂}`))
    expect(r.diagnostics.some((d) => d.message.includes('through_check'))).toBe(true)
  })

  it('serialize 往返语义幂等', () => {
    const once = parse(wrap(LEGGED)).trip!
    const twice = parse(serialize(once)).trip!
    expect(twice).toEqual(once)
  })
})
