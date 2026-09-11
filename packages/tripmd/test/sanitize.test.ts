import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Transport, Trip } from '@jjj/schema'
import { parse } from '../src/parse.ts'
import { serialize } from '../src/serialize.ts'
import { blurCoord, sanitize, sanitizeTransport, transportRole } from '../src/sanitize.ts'

/**
 * 公开版抹除 —— 白名单：只有显式保留的字段能过。
 * fixture 是合成的（工具仓库是公开的，真值不能进测试）。
 */
const md = readFileSync(join(__dirname, 'fixtures/sanitize-full.md'), 'utf8')
const load = (): Trip => {
  const r = parse(md)
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
  return r.trip!
}
const journey = (t: Trip, what: string) => t.journeys.find((j) => j.what === what)!

describe('transportRole', () => {
  const dates = { start: '2026-11-20', end: '2026-11-22' }
  it('Day 1 抵达 · 末日离开 · 中间日行程内部 · 没引用', () => {
    expect(transportRole('2026-11-20', dates)).toBe('arrival')
    expect(transportRole('2026-11-22', dates)).toBe('departure')
    expect(transportRole('2026-11-21', dates)).toBe('internal')
    expect(transportRole(undefined, dates)).toBe('unreferenced')
  })
  it('单日行程：当天既是首日也是末日，按抵达处理', () => {
    expect(transportRole('2026-11-20', { start: '2026-11-20', end: '2026-11-20' })).toBe('arrival')
  })
})

describe('sanitize · 长途', () => {
  it('抵达：只剩到达端 + 乘客 + 方式，到达日期落成显式 arr_date', () => {
    const t = sanitize(load())
    const j = journey(t, '去程')
    expect(j.cost).toBeUndefined()
    const f = j.transports[0]!
    expect(f).toMatchObject({ traveler: '我', mode: 'flight', to: 'HND T3', arrTime: '15:30', arrDate: '2026-11-20' })
    for (const k of ['from', 'depTime', 'depDate', 'carrier', 'number', 'price', 'cabin', 'seat', 'baggage', 'refund', 'note'] as const) {
      expect(f[k], k).toBeUndefined()
    }
    expect(f.stops).toEqual([])
    expect(f.legs).toEqual([])
    expect(f.durationMin).toBeNull()
    expect(f.arrDayOffset).toBe(0)
  })

  it('行程内部移动：两端时刻与地点全留，票面细节全抹', () => {
    const f = journey(sanitize(load()), '新干线').transports[0]!
    expect(f).toMatchObject({ mode: 'hsr', from: '东京', to: '京都', depTime: '09:00', arrTime: '11:15', arrDate: '2026-11-21' })
    expect(f.carrier).toBeUndefined()
    expect(f.number).toBeUndefined()
    expect(f.price).toBeUndefined()
    expect(f.seat).toBeUndefined()
  })

  it('离开：只剩出发端，dep_date 也不留（规范：日期由事件所在天派生）', () => {
    const f = journey(sanitize(load()), '返程').transports[0]!
    expect(f).toMatchObject({ mode: 'flight', from: 'HND T3', depTime: '18:30' })
    expect(f.to).toBeUndefined()
    expect(f.arrTime).toBeUndefined()
    expect(f.arrDate).toBeUndefined()
    expect(f.depDate).toBeUndefined()
    expect(f.price).toBeUndefined()
  })

  it('没被任何事件引用的长途：只剩 traveler / mode，两端都不留', () => {
    const f = journey(sanitize(load()), '备用巴士').transports[0]!
    expect(f.mode).toBe('bus')
    for (const k of ['from', 'to', 'depTime', 'arrTime', 'carrier', 'number', 'price'] as const) {
      expect(f[k], k).toBeUndefined()
    }
  })

  it('事件上灌好的 transports 与 journeys 同步抹（内存里也不能留真值）', () => {
    const t = sanitize(load())
    const ev = t.days[0]!.events.find((e) => e.detailRef === '去程')!
    expect(ev.transports[0]!.price).toBeUndefined()
    expect(ev.transports[0]!.to).toBe('HND T3')
  })

  it('白名单：schema 之外的字段也过不去', () => {
    const t = load()
    const raw = { ...journey(t, '去程').transports[0]!, secret: 'x' } as Transport
    const out = sanitizeTransport(raw, 'arrival', '2026-11-20')
    expect('secret' in out).toBe(false)
  })
})

describe('sanitize · 住宿 / 租车 / 地点', () => {
  it('住宿与租车只抹 cost，其余照留', () => {
    const t = sanitize(load())
    const s = t.stays[0]!
    expect(s.cost).toBeUndefined()
    expect(s).toMatchObject({ platform: 'Airbnb', room: '独栋', parking: '含', breakfast: '不含', refund: '11/1 前可免费取消', note: '自助入住' })
    const r = t.rentals[0]!
    expect(r.cost).toBeUndefined()
    expect(r).toMatchObject({ platform: 'Times Car', mileage: '不限', refund: '提车前 24 小时可免费取消' })
    expect(r.pickupPlaceId).toBe(load().rentals[0]!.pickupPlaceId)
    // 白名单：住宿 / 租车除了 cost 全留 —— 用「原记录删掉 cost」逐字段比对，漏抄一个字段就红
    const { cost: _sc, ...stayRest } = load().stays[0]!
    expect(s).toEqual(stayRest)
    const { cost: _rc, ...rentalRest } = load().rentals[0]!
    expect(r).toEqual(rentalRest)
  })

  it('民宿：坐标模糊到 2 位小数，en / note / url / gmaps_place_id 全删（任何一个都能把模糊废掉）；其他类别原样', () => {
    const before = load()
    const after = sanitize(before)
    const cabin = after.places.find((p) => p.category === 'homestay')!
    expect(cabin.coord).toEqual([139.12, 35.65])
    expect(cabin.nameEn).toBeUndefined()
    expect(cabin.note).toBeUndefined()
    expect(cabin.url).toBeUndefined()
    expect(cabin.gmapsPlaceId).toBeUndefined()
    expect(cabin.geo.query).toBe('山间小屋')
    const airport = after.places.find((p) => p.name === '羽田机场')!
    expect(airport).toEqual(before.places.find((p) => p.name === '羽田机场'))
  })

  it('blurCoord：四舍五入，负数也对', () => {
    expect(blurCoord([139.12345, 35.65432])).toEqual([139.12, 35.65])
    expect(blurCoord([-70.12345, 12.34567])).toEqual([-70.12, 12.35])
  })
})

describe('sanitize · 合法性', () => {
  it('抹完仍是合法 TripMD：serialize 后零错误可解析，且二次往返字节稳定', () => {
    const s = sanitize(load())
    const md2 = serialize(s)
    const again = parse(md2)
    expect(again.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(serialize(again.trip!)).toBe(md2)
    expect(again.trip!.visibility).toBe('public')
  })

  it('事件卡、导语、事件散项 cost、附录一字不动', () => {
    const before = load()
    const after = sanitize(before)
    // fixture 里这三样都真有内容，断言才不是空对空
    expect(before.days[0]!.intro).not.toBe('')
    expect(before.days[0]!.events.some((e) => e.cost)).toBe(true)
    expect(before.reference.length).toBeGreaterThan(0)
    const strip = (t: Trip) => t.days.map((d) => ({ ...d, events: d.events.map((e) => ({ ...e, transports: [] })) }))
    expect(strip(after)).toEqual(strip(before))
    expect(after.reference).toEqual(before.reference)
    expect(after.constraints).toEqual(before.constraints)
  })
})
