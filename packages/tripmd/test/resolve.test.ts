import { describe, expect, it } from 'vitest'
import { detailIndex, missingCoords, stayOfMorning } from '../src/resolve.ts'
import { parse } from '../src/parse.ts'
import { serialize } from '../src/serialize.ts'
import type { Day, Place, Stay, Trip, TripEvent } from '@jjj/schema'

/** 造一个只有 detail 引用相关字段有意义的事件 */
function ev(id: string, detailRef?: string, placeId: string | null = null): TripEvent {
  return {
    id,
    title: id,
    category: 'sight',
    startMin: 600,
    endMin: 660,
    timeKind: 'range',
    timeRaw: '10:00–11:00',
    placeId,
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

function place(id: string, coord: [number, number] | null): Place {
  return {
    id,
    name: id,
    coord,
    category: 'sight',
    tentative: false,
    geo: { source: coord ? 'authored' : 'none', confidence: coord ? 'high' : 'unknown' },
  }
}

function trip(days: Day[], places: Place[], over: Partial<Trip> = {}): Trip {
  return {
    id: 't',
    title: 'T',
    destination: 'X',
    timezone: 'UTC',
    dates: { start: '2026-10-01', end: '2026-10-05' },
    constraints: [],
    journeys: [],
    stays: [],
    rentals: [],
    places,
    days,
    reference: [],
    ...over,
  }
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

describe('stayOfMorning', () => {
  /** Astra：10-01 16:00 入住 → 10-03 09:45 退房 */
  const astra: Stay = {
    what: 'Astra Hotel',
    placeId: 'p-astra',
    from: { raw: '2026-10-01 16:00', date: '2026-10-01', minute: 960 },
    to: { raw: '2026-10-03 09:45', date: '2026-10-03', minute: 585 },
  }
  /** Ashford 木屋：10-03 20:30 → 10-04 07:15 */
  const cabin: Stay = {
    what: 'Ashford 木屋',
    placeId: 'p-cabin',
    from: { raw: '2026-10-03 20:30', date: '2026-10-03', minute: 1230 },
    to: { raw: '2026-10-04 07:15', date: '2026-10-04', minute: 435 },
  }
  const stays = [astra, cabin]

  it('入住当天没有住处 —— 那天早上你还没到', () => {
    expect(stayOfMorning(stays, '2026-10-01')).toBeNull()
  })

  it('入住次日在住处醒来', () => {
    expect(stayOfMorning(stays, '2026-10-02')?.what).toBe('Astra Hotel')
  })

  it('退房当天仍算 —— 早上人还在房里', () => {
    expect(stayOfMorning(stays, '2026-10-03')?.what).toBe('Astra Hotel')
  })

  it('换住处那天认新的那条', () => {
    expect(stayOfMorning(stays, '2026-10-04')?.what).toBe('Ashford 木屋')
  })

  it('全部退完之后没有住处', () => {
    expect(stayOfMorning(stays, '2026-10-05')).toBeNull()
  })

  it('没有住宿记录时返回 null', () => {
    expect(stayOfMorning([], '2026-10-02')).toBeNull()
  })

  it('只比日期不比时刻 —— 凌晨退房也算你在那儿醒的', () => {
    const redEye: Stay = {
      ...astra,
      to: { raw: '2026-10-03 04:00', date: '2026-10-03', minute: 240 },
    }
    expect(stayOfMorning([redEye], '2026-10-03')?.what).toBe('Astra Hotel')
  })
})

describe('missingCoords', () => {
  const SEA: [number, number] = [-122.33, 47.6]

  it('被事件引用且无坐标的入列；有坐标或没人引用的不入', () => {
    const t = trip(
      [day(1, '2026-10-01', [ev('e1', undefined, 'a'), ev('e2', undefined, 'nc')])],
      [place('a', SEA), place('nc', null), place('orphan', null)],
    )
    expect(missingCoords(t).map((p) => p.id)).toEqual(['nc'])
  })

  it('住宿与租车取还点也算引用', () => {
    const t = trip(
      [day(1, '2026-10-01', [ev('e1', undefined, 'a')])],
      [place('a', SEA), place('h', null), place('lot', null)],
      {
        stays: [
          {
            what: 'H',
            placeId: 'h',
            from: { raw: '', date: '2026-10-01', minute: 1080 },
            to: { raw: '', date: '2026-10-02', minute: 600 },
          },
        ],
        rentals: [
          {
            what: 'Car',
            pickupPlaceId: 'lot',
            dropoffPlaceId: null,
            from: { raw: '', date: '2026-10-01', minute: 0 },
            to: { raw: '', date: '2026-10-02', minute: 0 },
          },
        ],
      },
    )
    expect(
      missingCoords(t)
        .map((p) => p.id)
        .sort(),
    ).toEqual(['h', 'lot'])
  })
})
