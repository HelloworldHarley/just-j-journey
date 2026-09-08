import { describe, expect, it } from 'vitest'
import { fmtDurationZh, fmtMoney, roundMoneyText, shortDate } from './format.ts'

describe('roundMoneyText', () => {
  it('文本里的金额取整，前后缀原样保留', () => {
    expect(roundMoneyText('$713.33')).toBe('$713')
    expect(roundMoneyText('往返 $226.80')).toBe('往返 $227')
    expect(roundMoneyText('$1,908.5')).toBe('$1,909')
  })
  it('不碰时刻、时长、日期这些没有小数点的数字', () => {
    expect(roundMoneyText('16:00 前可免费取消 · 2h50m · 9/26')).toBe('16:00 前可免费取消 · 2h50m · 9/26')
    expect(roundMoneyText('$250–400')).toBe('$250–400')
  })
})

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
    // 四舍五入到个位：.42 抹掉，.5 进位，千分位照常
    expect(fmtMoney(339.42, 'USD')).toBe('$339')
    expect(fmtMoney(1908.5, 'USD')).toBe('$1,909')
    expect(fmtMoney(1200, 'JPY')).toBe('¥1,200')
  })
  it('不认识的币种用代码前缀', () => {
    expect(fmtMoney(100, 'CHF')).toBe('CHF 100')
  })
  it('没有币种就裸数字', () => {
    expect(fmtMoney(1234)).toBe('1,234')
  })
})
