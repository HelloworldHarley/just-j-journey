import { describe, expect, it } from 'vitest'
import type { Reservation } from '@jjj/schema'
import { mondayIndex } from '@jjj/tripmd'
import {
  assignLanes,
  buildMonthGrid,
  clipSpanToGrid,
  mondayOfWeek,
  reservationToTimed,
  tripCalendarRange,
  type TimedSpan,
} from './calendar-grid.ts'

/** 造一条预订。只关心起止时刻，其余字段给最小值 */
const res = (from: string, fromMin: number, to: string, toMin: number): Reservation =>
  ({
    what: 'X',
    from: { raw: from, date: from, minute: fromMin },
    to: { raw: to, date: to, minute: toMin },
    placeId: null,
  }) as Reservation

const span = (
  startDate: string,
  startFrac: number,
  endDate: string,
  endFrac: number,
): TimedSpan => ({ startDate, startFrac, endDate, endFrac })

describe('mondayIndex', () => {
  it('周一 0、周六 5、周日 6', () => {
    // getUTCDay() 是周日 = 0，直接用会把整周错位一格
    expect(mondayIndex('2026-10-05')).toBe(0) // 周一
    expect(mondayIndex('2026-10-10')).toBe(5) // 周六
    expect(mondayIndex('2026-10-11')).toBe(6) // 周日
  })

  it('mondayOfWeek 回到本周周一；本身是周一时原地不动', () => {
    expect(mondayOfWeek('2026-10-11')).toBe('2026-10-05')
    expect(mondayOfWeek('2026-10-05')).toBe('2026-10-05')
  })
})

describe('buildMonthGrid', () => {
  const rows = (a: string, b: string) => buildMonthGrid(a, b).weeks

  it('每行严格 7 天、周一开头、行间连续', () => {
    const grid = buildMonthGrid('2026-10-01', '2026-10-05')
    for (const w of grid.weeks) {
      expect(w.dates).toHaveLength(7)
      expect(mondayIndex(w.start)).toBe(0)
      expect(w.dates[0]).toBe(w.start)
    }
    const flat = grid.weeks.flatMap((w) => w.dates)
    expect(new Set(flat).size).toBe(flat.length)
  })

  it('同一周内的行程：1 周行程周 + 前后各一周 = 3 行', () => {
    expect(rows('2026-10-05', '2026-10-09')).toHaveLength(3)
  })

  it('跨两周的行程 = 4 行；首尾两行是渐隐周', () => {
    const w = rows('2026-10-01', '2026-10-05')
    expect(w).toHaveLength(4)
    expect(w.map((r) => r.outside)).toEqual([true, false, false, true])
  })

  it('首日恰好是周一也不会多算一周', () => {
    expect(rows('2026-10-05', '2026-10-11')).toHaveLength(3)
  })

  it('跨月不跳日', () => {
    const flat = rows('2026-01-28', '2026-02-03').flatMap((r) => r.dates)
    expect(flat).toContain('2026-01-31')
    expect(flat).toContain('2026-02-01')
  })

  it('跨年不跳日', () => {
    const flat = rows('2026-12-29', '2027-01-04').flatMap((r) => r.dates)
    expect(flat).toContain('2026-12-31')
    expect(flat).toContain('2027-01-01')
  })

  it('闰年 2 月有 29 号', () => {
    const flat = rows('2028-02-27', '2028-03-02').flatMap((r) => r.dates)
    expect(flat).toContain('2028-02-29')
  })
})

describe('tripCalendarRange', () => {
  const dates = { start: '2026-10-01', end: '2026-10-05' }

  it('没有预订时就是行程区间', () => {
    expect(tripCalendarRange(dates, [])).toEqual(dates)
  })

  it('还车晚于行程末日时往后延', () => {
    expect(tripCalendarRange(dates, [res('2026-10-02', 690, '2026-10-06', 680)]).end).toBe(
      '2026-10-06',
    )
  })

  it('入住早于行程首日时往前延', () => {
    expect(tripCalendarRange(dates, [res('2026-09-30', 960, '2026-10-02', 600)]).start).toBe(
      '2026-09-30',
    )
  })
})

describe('reservationToTimed', () => {
  it('住和租车走同一个函数，结果同构', () => {
    // 保底时刻在**解析时**就填好了（DEFAULT_CHECK_IN / OUT），
    // 所以这里只是投影：两端恒有值，不需要判空
    const stay = reservationToTimed(res('2026-10-01', 960, '2026-10-03', 585))
    const rental = reservationToTimed(res('2026-10-02', 690, '2026-10-05', 680))
    expect(stay).toEqual(span('2026-10-01', 960 / 1440, '2026-10-03', 585 / 1440))
    expect(Object.keys(stay)).toEqual(Object.keys(rental))
  })
})

describe('clipSpanToGrid', () => {
  // 10/01（周四）–10/05（周一）→ 4 行，行 0 与行 3 渐隐；行 1 从 09-28 起
  const grid = buildMonthGrid('2026-10-01', '2026-10-05')

  it('单天区间：两端都是真端头', () => {
    const segs = clipSpanToGrid(grid, span('2026-10-02', 0.25, '2026-10-02', 0.75))
    expect(segs).toHaveLength(1)
    expect(segs[0]!.capStart).toBe(true)
    expect(segs[0]!.capEnd).toBe(true)
  })

  it('子格比例：16:00 落在该格的 66.7% 处', () => {
    // 10/01 是行 1 的第 4 天（周四）→ 3/7 已过，再加 16/24 的一格
    const segs = clipSpanToGrid(grid, span('2026-10-01', 16 / 24, '2026-10-01', 20 / 24))
    const cellLeft = (3 / 7) * 100
    const cellWidth = 100 / 7
    expect(segs[0]!.leftPct).toBeCloseTo(cellLeft + cellWidth * (16 / 24), 6)
  })

  it('跨周行时被截断的那端不画圆角', () => {
    // 09-30 → 10-07 横跨行 1、行 2
    const segs = clipSpanToGrid(grid, span('2026-09-30', 0.5, '2026-10-07', 0.5))
    expect(segs.map((s) => s.weekIndex)).toEqual([1, 2])
    expect(segs[0]).toMatchObject({ capStart: true, capEnd: false })
    expect(segs[1]).toMatchObject({ capStart: false, capEnd: true })
    // 被切断的那端一定贴着行边界
    expect(segs[0]!.leftPct + segs[0]!.widthPct).toBeCloseTo(100, 6)
    expect(segs[1]!.leftPct).toBe(0)
  })

  it('跨三行时中间那段两端都不画圆角、且铺满整行', () => {
    const segs = clipSpanToGrid(grid, span('2026-09-29', 0.5, '2026-10-14', 0.5))
    const mid = segs[1]!
    expect(mid).toMatchObject({ capStart: false, capEnd: false, leftPct: 0, widthPct: 100 })
  })

  it('完全落在渐隐周里也照常产出 —— 不画等于制造「数据丢失」假象', () => {
    const firstWeek = grid.weeks[0]!.dates
    const segs = clipSpanToGrid(grid, span(firstWeek[1]!, 0.4, firstWeek[2]!, 0.6))
    expect(segs).toHaveLength(1)
    expect(segs[0]!.weekIndex).toBe(0)
  })

  it('部分超出网格时裁到边界，完全超出返回空', () => {
    const last = grid.weeks[grid.weeks.length - 1]!.dates[6]!
    const clipped = clipSpanToGrid(grid, span('2026-10-02', 0.5, '2027-01-01', 0.5))
    expect(clipped[clipped.length - 1]!.capEnd).toBe(false)
    expect(clipSpanToGrid(grid, span('2027-01-01', 0, '2027-01-02', 0))).toEqual([])
    expect(clipSpanToGrid(grid, span(last, 0.1, last, 0.2))).toHaveLength(1)
  })

  it('换酒店那天的两段不重叠 —— 上午退房、晚上入住', () => {
    const out = clipSpanToGrid(grid, span('2026-10-01', 16 / 24, '2026-10-03', 9.75 / 24))[0]!
    const inn = clipSpanToGrid(grid, span('2026-10-03', 20.5 / 24, '2026-10-05', 10 / 24))[0]!
    expect(out.leftPct + out.widthPct).toBeLessThan(inn.leftPct)
  })

  it('反转的区间抛错，不静默画反', () => {
    expect(() => clipSpanToGrid(grid, span('2026-10-05', 0.5, '2026-10-01', 0.5))).toThrow()
  })
})

describe('assignLanes', () => {
  it('不重叠的住宿恒 0', () => {
    expect(
      assignLanes([
        span('2026-10-01', 0.6, '2026-10-03', 0.4),
        span('2026-10-03', 0.8, '2026-10-05', 0.4),
      ]),
    ).toEqual([0, 0])
  })

  it('两段并发的租车分两条', () => {
    expect(
      assignLanes([
        span('2026-10-01', 0.5, '2026-10-04', 0.5),
        span('2026-10-02', 0.5, '2026-10-03', 0.5),
      ]),
    ).toEqual([0, 1])
  })

  it('错开的复用第 0 条，返回值与入参同序', () => {
    expect(
      assignLanes([
        span('2026-10-04', 0.5, '2026-10-05', 0.5), // 后发生的写在前面
        span('2026-10-01', 0.5, '2026-10-02', 0.5),
      ]),
    ).toEqual([0, 0])
  })

  it('空数组不炸', () => {
    expect(assignLanes([])).toEqual([])
  })
})
