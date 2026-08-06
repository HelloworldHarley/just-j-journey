import { describe, expect, it } from 'vitest'
import type { Day, Rental, TripEvent } from '@jjj/schema'
import {
  computeWeekAxis,
  minuteToPct,
  rentalBandForColumn,
  rentalBandsForWeek,
  type WeekAxis,
} from './week-axis.ts'

const ev = (startMin: number, endMin: number): TripEvent =>
  ({ startMin, endMin }) as TripEvent

const day = (date: string, ...events: TripEvent[]): Day => ({ date, events }) as Day

const rental = (from: string, fromMin: number, to: string, toMin: number): Rental =>
  ({
    what: '车',
    from: { raw: from, date: from, minute: fromMin },
    to: { raw: to, date: to, minute: toMin },
  }) as Rental

const axis: WeekAxis = { from: 7 * 60, to: 23 * 60 }

describe('computeWeekAxis', () => {
  it('取全页最早/最晚并向整点外扩', () => {
    const a = computeWeekAxis([
      day('2026-10-01', ev(7 * 60 + 15, 9 * 60)),
      day('2026-10-02', ev(10 * 60, 22 * 60 + 40)),
    ])
    expect(a).toEqual({ from: 7 * 60, to: 23 * 60 })
  })

  it('内容很少时撑到 8 小时下限', () => {
    const a = computeWeekAxis([day('2026-10-01', ev(10 * 60, 11 * 60))])
    expect(a.to - a.from).toBe(8 * 60)
    expect(a.from).toBe(10 * 60)
  })

  it('深夜事件顶到上限时改为往上补，仍是 8 小时', () => {
    const a = computeWeekAxis([day('2026-10-01', ev(25 * 60, 25 * 60 + 30))])
    expect(a.to - a.from).toBe(8 * 60)
    expect(a.to).toBeLessThanOrEqual(30 * 60)
  })

  it('一页全是空天时给一个可用的默认轴，不返回 Infinity', () => {
    const a = computeWeekAxis([day('2026-10-01')])
    expect(Number.isFinite(a.from) && Number.isFinite(a.to)).toBe(true)
    expect(a.to).toBeGreaterThan(a.from)
  })

  it('跨午夜的事件把轴往后延，而不是回卷到 01:00', () => {
    const a = computeWeekAxis([day('2026-10-01', ev(20 * 60, 25 * 60))])
    expect(a.to).toBeGreaterThanOrEqual(25 * 60)
    expect(a.from).toBe(20 * 60)
  })
})

describe('minuteToPct', () => {
  it('轴内线性换算', () => {
    expect(minuteToPct(15 * 60, axis)).toBeCloseTo(50, 6)
  })

  it('恰好等于两端得 0 与 100（防差 1）', () => {
    expect(minuteToPct(axis.from, axis)).toBe(0)
    expect(minuteToPct(axis.to, axis)).toBe(100)
  })

  it('超出两端钳住', () => {
    expect(minuteToPct(0, axis)).toBe(0)
    expect(minuteToPct(48 * 60, axis)).toBe(100)
  })
})

describe('rentalBandForColumn', () => {
  const r = rental('2026-10-02', 11 * 60 + 30, '2026-10-05', 11 * 60 + 20)

  it('取车日从取车时刻铺到列底', () => {
    const b = rentalBandForColumn(r, '2026-10-02', axis)!
    expect(b.topPct).toBeCloseTo(minuteToPct(11 * 60 + 30, axis), 6)
    expect(b.bottomPct).toBe(100)
  })

  it('中间日铺满整列', () => {
    expect(rentalBandForColumn(r, '2026-10-03', axis)).toMatchObject({
      topPct: 0,
      bottomPct: 100,
    })
  })

  it('还车日从列顶铺到还车时刻', () => {
    const b = rentalBandForColumn(r, '2026-10-05', axis)!
    expect(b.topPct).toBe(0)
    expect(b.bottomPct).toBeCloseTo(minuteToPct(11 * 60 + 20, axis), 6)
  })

  it('不在租期内返回 null', () => {
    expect(rentalBandForColumn(r, '2026-10-01', axis)).toBeNull()
    expect(rentalBandForColumn(r, '2026-10-06', axis)).toBeNull()
  })

  it('轴跨午夜时中间日与取车日铺到轴底，不在 24:00 停', () => {
    // 夜游行程的轴可以到 25:00+。带只铺到 1440 的话，午夜之后
    // 那一小时没有底色 —— 而那段时间人明明还有车
    const lateAxis: WeekAxis = { from: 18 * 60, to: 26 * 60 }
    expect(rentalBandForColumn(r, '2026-10-03', lateAxis)!.bottomPct).toBe(100)
    expect(rentalBandForColumn(r, '2026-10-02', lateAxis)!.bottomPct).toBe(100)
  })

  it('单日租车只有中段', () => {
    const one = rental('2026-10-02', 9 * 60, '2026-10-02', 18 * 60)
    const b = rentalBandForColumn(one, '2026-10-02', axis)!
    expect(b.topPct).toBeGreaterThan(0)
    expect(b.bottomPct).toBeLessThan(100)
  })

  it('整段落在轴外时钳到边界并标记，不报错也不出现负高度', () => {
    const night = rental('2026-10-02', 2 * 60, '2026-10-02', 5 * 60)
    const b = rentalBandForColumn(night, '2026-10-02', axis)!
    expect(b.topPct).toBe(0)
    expect(b.bottomPct).toBe(0)
    expect(b.clampedTop).toBe(true)
  })

  it('取车即还车的零长度区间不产出带', () => {
    const zero = rental('2026-10-02', 600, '2026-10-02', 600)
    expect(rentalBandForColumn(zero, '2026-10-02', axis)).toBeNull()
  })
})

describe('rentalBandsForWeek', () => {
  it('只在租期覆盖的列上产出，列号对得上', () => {
    const r = rental('2026-10-02', 11 * 60 + 30, '2026-10-05', 11 * 60 + 20)
    const cols = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']
    expect(rentalBandsForWeek(r, cols, axis).map((b) => b.col)).toEqual([1, 2, 3, 4])
  })
})
