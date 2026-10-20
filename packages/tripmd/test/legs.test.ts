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
    const t = r.trip!.journeys[0]!.transports[0]!
    expect(t.cabin).toBe('Y')
    expect(t.seat).toBe('9F')

    const r2 = parse(wrap(LEGGED))
    expect(r2.diagnostics).toEqual([])
    const t2 = r2.trip!.journeys[0]!.transports[0]!
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

describe('transport.hide 公开版藏哪一端', () => {
  const hideOf = (flow: string) => parse(wrap(`{mode: flight, from: A, to: B, ${flow}}`))

  it('单值、列表、逗号分隔、大小写都认，按 from、to 的顺序收好；没写就是空', () => {
    expect(hideOf('hide: from').trip!.journeys[0]!.transports[0]!.hide).toEqual(['from'])
    expect(hideOf('hide: TO').trip!.journeys[0]!.transports[0]!.hide).toEqual(['to'])
    expect(hideOf('hide: [to, from]').trip!.journeys[0]!.transports[0]!.hide).toEqual(['from', 'to'])
    expect(hideOf('hide: "from, to"').trip!.journeys[0]!.transports[0]!.hide).toEqual(['from', 'to'])
    expect(hideOf('note: x').trip!.journeys[0]!.transports[0]!.hide).toEqual([])
  })

  it('写错是错误不是警告：认不出的值若当没写，这一端就进了公开版', () => {
    const r = hideOf('hide: form')
    expect(r.trip).toBeNull()
    expect(r.diagnostics).toMatchObject([{ severity: 'error', message: expect.stringContaining('form'), hint: expect.stringContaining('`from`') }])
  })

  it('写回紧跟在 to 后面，往返不变', () => {
    for (const [flow, written] of [['hide: to', 'to: B, hide: to}'], ['hide: [from, to]', 'to: B, hide: [from, to]}']] as const) {
      const trip = hideOf(flow).trip!
      const md = serialize(trip)
      expect(md).toContain(written)
      expect(parse(md).trip).toEqual(trip)
    }
  })
})
