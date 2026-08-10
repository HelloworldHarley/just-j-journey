import { describe, expect, it } from 'vitest'
import { detailIndex } from '../src/resolve.ts'
import { parse } from '../src/parse.ts'
import { serialize } from '../src/serialize.ts'
import type { Day, TripEvent } from '@jjj/schema'

/** 造一个只有 detail 引用相关字段有意义的事件 */
function ev(id: string, detailRef?: string): TripEvent {
  return {
    id,
    title: id,
    category: 'sight',
    startMin: 600,
    endMin: 660,
    timeKind: 'range',
    timeRaw: '10:00–11:00',
    placeId: null,
    flags: [],
    transports: [],
    detailRef,
    summary: '',
    detail: '',
    notes: [],
    variants: [],
  }
}

function day(index: number, date: string, events: TripEvent[]): Day {
  return { index, date, weekday: '周四', color: '#000', intro: '', events, legs: [] }
}

describe('detailIndex', () => {
  it('首次引用拿到 firstRef 与 firstRefDate，之后的引用进 dup', () => {
    const days = [
      day(1, '2026-10-01', [ev('e1', 'Astra Hotel'), ev('e2')]),
      day(2, '2026-10-02', [ev('e3', 'Astra Hotel'), ev('e4', '去程航班')]),
      day(3, '2026-10-03', [ev('e5', 'Astra Hotel'), ev('e6', '去程航班')]),
    ]
    const idx = detailIndex(days)
    expect(idx.firstRef.get('Astra Hotel')).toBe('e1')
    expect(idx.firstRefDate.get('Astra Hotel')).toBe('2026-10-01')
    expect(idx.firstRef.get('去程航班')).toBe('e4')
    expect(idx.firstRefDate.get('去程航班')).toBe('2026-10-02')
    expect(idx.dup).toEqual(new Set(['e3', 'e5', 'e6']))
  })

  it('没有引用时三个集合都空', () => {
    const idx = detailIndex([day(1, '2026-10-01', [ev('e1')])])
    expect(idx.firstRef.size).toBe(0)
    expect(idx.firstRefDate.size).toBe(0)
    expect(idx.dup.size).toBe(0)
  })

  it('同一天内按事件顺序判首次', () => {
    const idx = detailIndex([day(1, '2026-10-01', [ev('a', 'X'), ev('b', 'X')])])
    expect(idx.firstRef.get('X')).toBe('a')
    expect(idx.dup).toEqual(new Set(['b']))
  })
})

describe('detailIndex 与解析器同一口径（幂等的支点）', () => {
  // Day 2 写在 Day 1 前面：首次引用必须按日期序归 Day 1 的事件，
  // 不是书写序的 Day 2 —— 否则往返一次后票面时间轴换卡
  const md = `---
id: t
title: T
destination: X
timezone: America/Los_Angeles
start: 2026-10-01
end: 2026-10-02
---

## 长途

\`\`\`trip-transports
- what: 去程航班
  transport:
    mode: flight
    number: NH178
\`\`\`

## Day 2 · 2026-10-02

### 再看一眼航班

\`\`\`trip-event
time: 09:00
category: logistics
detail: 去程航班
\`\`\`

## Day 1 · 2026-10-01

### 出发

\`\`\`trip-event
time: 10:00
category: flight
detail: 去程航班
\`\`\`
`

  it('书写序倒置时，明细灌进日期更早的事件', () => {
    const { trip, diagnostics } = parse(md)
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(trip).not.toBeNull()

    const d1 = trip!.days.find((d) => d.index === 1)!
    const d2 = trip!.days.find((d) => d.index === 2)!
    // 解析器灌明细的那张卡
    expect(d1.events[0]!.transports).toHaveLength(1)
    expect(d2.events[0]!.transports).toHaveLength(0)
    // detailIndex 对同一份 Trip 给出同一个答案
    const idx = detailIndex(trip!.days)
    expect(idx.firstRef.get('去程航班')).toBe(d1.events[0]!.id)
    expect(idx.firstRefDate.get('去程航班')).toBe('2026-10-01')
    expect(idx.dup).toEqual(new Set([d2.events[0]!.id]))
  })

  it('往返一次后归属不变', () => {
    const once = parse(md).trip!
    const twice = parse(serialize(once)).trip!
    const a = detailIndex(once.days)
    const b = detailIndex(twice.days)
    expect(b.firstRefDate.get('去程航班')).toBe(a.firstRefDate.get('去程航班'))
    expect([...b.dup].length).toBe([...a.dup].length)
  })
})
