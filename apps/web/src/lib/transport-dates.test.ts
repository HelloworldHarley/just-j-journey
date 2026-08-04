import { describe, expect, it } from 'vitest'
import type { Transport } from '@jjj/schema'
import { dayOffsetOf, timelineDates } from './transport-dates.ts'

const t = (over: Partial<Transport>): Transport => ({
  mode: 'flight',
  arrDayOffset: 0,
  durationMin: null,
  stops: [],
  ...over,
})

const stop = (over: Partial<Transport['stops'][number]>): Transport['stops'][number] => ({
  depAirport: undefined,
  arrTime: undefined,
  depTime: undefined,
  arrDate: undefined,
  depDate: undefined,
  legMin: null,
  waitMin: null,
  ...over,
})

describe('日期从时刻推导', () => {
  it('当天来回：所有节点都是出发日，无角标', () => {
    const d = timelineDates(t({ depTime: '09:12', arrTime: '11:14' }), '2026-11-22')
    expect(d.dep).toBe('2026-11-22')
    expect(d.arr).toBe('2026-11-22')
    expect(dayOffsetOf(d.dep, d.arr)).toBe(0)
  })

  it('钟点回卷 → 自动进一天并给出角标', () => {
    // 23:40 起飞、次日 06:15 落地，作者只写了时刻
    const d = timelineDates(t({ depTime: '23:40', arrTime: '06:15' }), '2026-11-22')
    expect(d.arr).toBe('2026-11-23')
    expect(dayOffsetOf(d.dep, d.arr)).toBe(1)
  })

  it('中转跨午夜：中转两端各自算日期，各自带角标', () => {
    const d = timelineDates(
      t({
        depTime: '21:00',
        arrTime: '08:30',
        stops: [stop({ arrTime: '23:50', depTime: '01:20', waitMin: 90 })],
      }),
      '2026-11-22',
    )
    expect(d.stops[0]!.arr).toBe('2026-11-22') // 当晚到达
    expect(d.stops[0]!.dep).toBe('2026-11-23') // 过了午夜才走
    expect(d.arr).toBe('2026-11-23')
    expect(dayOffsetOf(d.dep, d.stops[0]!.arr)).toBe(0)
    expect(dayOffsetOf(d.dep, d.stops[0]!.dep)).toBe(1)
  })

  it('超过 24 小时的停留：靠 wait 时长推进，钟点回卷做不到', () => {
    // 10:00 到中转站，停 27 小时，13:00 再出发 —— 13:00 > 10:00 不会触发回卷
    const d = timelineDates(
      t({
        depTime: '08:00',
        arrTime: '18:00',
        stops: [stop({ arrTime: '10:00', depTime: '13:00', waitMin: 27 * 60 })],
      }),
      '2026-11-22',
    )
    expect(d.stops[0]!.arr).toBe('2026-11-22')
    expect(d.stops[0]!.dep).toBe('2026-11-23')
    expect(dayOffsetOf(d.dep, d.stops[0]!.dep)).toBe(1)
    expect(d.arr).toBe('2026-11-23')
  })

  it('作者写的日期是锚点，后续从锚点继续走', () => {
    const d = timelineDates(
      t({
        depDate: '2026-11-19',
        depTime: '08:05',
        arrTime: '15:30',
        arrDate: '2026-11-20',
        stops: [stop({ arrTime: '10:55', depTime: '13:35', waitMin: 160 })],
      }),
      '2026-11-20',
    )
    expect(d.dep).toBe('2026-11-19')
    expect(d.stops[0]!.arr).toBe('2026-11-19')
    expect(d.arr).toBe('2026-11-20')
    expect(dayOffsetOf(d.dep, d.arr)).toBe(1)
  })

  it('跨时区只能靠 arr_day_offset —— 时长反推不出天数', () => {
    // LAX 08:05 飞 14h25m 到 HND 15:30 次日：本地钟点只走了 7h25m，
    // 差出来的 17 小时是时区偏移。没有时区数据谁也解不出来
    const d = timelineDates(
      t({ depTime: '08:05', arrTime: '15:30', arrDayOffset: 1, durationMin: 865 }),
      '2026-11-19',
    )
    expect(d.arr).toBe('2026-11-20')
    expect(dayOffsetOf(d.dep, d.arr)).toBe(1)
  })

  it('东行同日到达：起飞晚于落地钟点也不该进位', () => {
    // KIX 18:30 → SFO 同日 11:10（赚回一天）
    const d = timelineDates(
      t({ depTime: '18:30', arrTime: '11:10', arrDayOffset: 0, arrDate: '2026-11-23' }),
      '2026-11-23',
    )
    expect(d.arr).toBe('2026-11-23')
    expect(dayOffsetOf(d.dep, d.arr)).toBe(0)
  })

  it('缺时刻时不猜日期 —— 宁可不显示，也不给错的', () => {
    const d = timelineDates(t({ depTime: undefined, arrTime: undefined }), '2026-11-22')
    expect(d.dep).toBe('2026-11-22')
    expect(d.arr).toBeUndefined()
    expect(dayOffsetOf(d.dep, d.arr)).toBe(0)
  })

  it('没有任何日期锚点时全部为空', () => {
    const d = timelineDates(t({ depTime: '09:00', arrTime: '10:00' }), undefined)
    expect(d.dep).toBeUndefined()
    expect(d.arr).toBeUndefined()
  })
})
