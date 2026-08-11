import { describe, expect, it } from 'vitest'
import { fmtDurationZh, fmtMoney, shortDate } from './format.ts'

describe('shortDate', () => {
  it('"2026-10-01" → "10/01"', () => {
    expect(shortDate('2026-10-01')).toBe('10/01')
    expect(shortDate('2026-01-31')).toBe('01/31')
  })
})

describe('fmtDurationZh', () => {
  it('不足一小时只报分', () => {
    expect(fmtDurationZh(45)).toBe('45 分')
  })
  it('整小时不带零分', () => {
    expect(fmtDurationZh(120)).toBe('2 小时')
  })
  it('小时 + 分', () => {
    expect(fmtDurationZh(170)).toBe('2 小时 50 分')
  })
})

describe('fmtMoney', () => {
  it('认识的币种用符号', () => {
    expect(fmtMoney(189, 'USD')).toBe('$189')
    expect(fmtMoney(1200, 'JPY')).toBe('¥1,200')
  })
  it('不认识的币种用代码前缀', () => {
    expect(fmtMoney(100, 'CHF')).toBe('CHF 100')
  })
  it('没有币种就裸数字', () => {
    expect(fmtMoney(1234)).toBe('1,234')
  })
})
