import { describe, expect, it } from 'vitest'
import { parseDurationMin, parseTimeSpec } from '../src/values.ts'
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
  ])('%s → %s', (input, expected) => {
    expect(parseDurationMin(input)).toBe(expected)
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
