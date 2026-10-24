import { describe, expect, it } from 'vitest'
import { isIsoDate, parseClock, parseDurationMin, parseLatLng, parseTimeSpec } from '../src/values.ts'
import { parseCost } from '../src/cost.ts'

describe('parseDurationMin', () => {
  it.each([
    ['11h55m', 715],
    ['2h', 120],
    ['45m', 45],
    ['11 小时 55 分', 715],
    ['2 小时', 120],
    ['130 分钟', 130],
    ['"11:55" 时钟形态', null], // 带引号的整串不是时长
    ['11:55', 715],
    [90, 90],
    ['', null],
    ['马上', null],
    // 小时后面的裸数字是分钟，不能丢
    ['1h30', 90],
    ['11小时55', 715],
    ['24h05', 1445],
    ['2.5h', 150],
    // 整串认不出来就是 null，由调用方报出来 —— 不再只抠出认得的那段
    ['20 min 4 km', null],
    ['1:30h', null],
    ['0:00', null],
    ['11:75', null],
    [0, null],
  ])('%s → %s', (input, expected) => {
    expect(parseDurationMin(input)).toBe(expected)
  })
})

describe('isIsoDate / parseClock', () => {
  it('日期必须真实存在：2026-02-30、2026-04-31 不算（Date 会把它们滚到下个月）', () => {
    expect(isIsoDate('2026-10-31')).toBe(true)
    expect(isIsoDate('2028-02-29')).toBe(true)
    for (const s of ['2026-02-30', '2026-04-31', '2026-13-01', '2026/11/13', '2026-1-1']) expect(isIsoDate(s), s).toBe(false)
  })
  it('时刻最晚到 24:00', () => {
    expect(parseClock('24:00')).toBe(1440)
    expect(parseClock('23:59')).toBe(1439)
    expect(parseClock('24:01')).toBeNull()
    expect(parseClock('7:60')).toBeNull()
    expect(parseClock('18：25')).toBe(1105)
  })
})

describe('parseLatLng', () => {
  it('十进制与半球字母', () => {
    expect(parseLatLng('47.6205, -122.3493')).toEqual([47.6205, -122.3493])
    expect(parseLatLng('47.6205°N, 122.3493°W')).toEqual([47.6205, -122.3493])
  })
  it('度分秒按度分秒算，不再读成两个整数', () => {
    const [lat, lng] = parseLatLng(`47°36'22.3"N 122°19'55.6"W`)!
    expect(lat).toBeCloseTo(47.60619, 4)
    expect(lng).toBeCloseTo(-122.33211, 4)
    const [lat2, lng2] = parseLatLng(`47° 36.371' N, 122° 19.927' W`)!
    expect(lat2).toBeCloseTo(47.60618, 4)
    expect(lng2).toBeCloseTo(-122.33212, 4)
  })
  it('多于两个数就认不出（「附近 3 号门」），由调用方报错', () => {
    expect(parseLatLng('47.6205, -122.3493 附近 3 号门')).toBeNull()
    expect(parseLatLng('47.6205')).toBeNull()
  })
})

describe('parseTimeSpec', () => {
  it('区间', () => {
    const r = parseTimeSpec('18:25–18:55')
    expect(r).toEqual({ ok: true, value: { startMin: 1105, endMin: 1135, kind: 'exact' } })
  })
  it('跨午夜视为次日，不报错', () => {
    const r = parseTimeSpec('23:30-01:00')
    expect(r.ok && r.value.endMin).toBe(1500)
  })
  it('时间点时长为 0', () => {
    const r = parseTimeSpec('13:11')
    expect(r.ok && r.value.startMin === r.value.endMin).toBe(true)
  })
  it('时段关键字', () => {
    const r = parseTimeSpec('afternoon')
    expect(r.ok && r.value.kind).toBe('period')
  })
  it('自然语言拒绝', () => {
    expect(parseTimeSpec('下午三点半').ok).toBe(false)
  })
})

describe('parseCost（规则：宁可抽不出，不要抽错）', () => {
  it('/人 乘人数', () => {
    expect(parseCost('约 $70/人', 2, 'USD').amount).toBe(140)
  })
  it('等号后是总额', () => {
    expect(parseCost('$159 × 2 = $318', 2, 'USD').amount).toBe(318)
  })
  it('区间取中值', () => {
    expect(parseCost('$250–400', 2, 'USD').amount).toBe(325)
  })
  it('「可选」标记不计入', () => {
    expect(parseCost('摩天轮 $18/人（可选）', 2, 'USD').optional).toBe(true)
  })
  it('抽不出金额 → null 且保留原文', () => {
    const c = parseCost('看情况', 2, 'USD')
    expect(c.amount).toBeNull()
    expect(c.raw).toBe('看情况')
  })
})
