import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Transport, Trip } from '@jjj/schema'
import { parse } from '../src/parse.ts'
import { serialize } from '../src/serialize.ts'
import { blurCoord, referencedSpan, sanitize, sanitizeTransport, transportRole } from '../src/sanitize.ts'

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

describe('referencedSpan', () => {
  it('跨度 = 各长途首次引用日期的最早与最晚；没有任何引用时退回行程首末日', () => {
    const refs = new Map([['去程', '2026-11-20'], ['新干线', '2026-11-21'], ['返程', '2026-11-23']])
    expect(referencedSpan(refs, { start: '2026-11-19', end: '2026-11-24' })).toEqual({ start: '2026-11-20', end: '2026-11-23' })
    expect(referencedSpan(new Map(), { start: '2026-11-19', end: '2026-11-24' })).toEqual({ start: '2026-11-19', end: '2026-11-24' })
  })

  it('跨度只看长途：去程之前一天引用了租车，去程仍是抵达 —— 住宿 / 租车也走 detail:，混进来会把跨度撑宽', () => {
    // 在去程前一天加一天，那天只引用租车；Day 编号整体后移
    const shifted = md
      .replace('start: 2026-11-20', 'start: 2026-11-19')
      .replace('## Day 3 · 2026-11-22', '## Day 4 · 2026-11-22')
      .replace('## Day 2 · 2026-11-21', '## Day 3 · 2026-11-21')
      .replace(
        '## Day 1 · 2026-11-20',
        '## Day 1 · 2026-11-19\n\n```trip-day\ntheme: 出发前一晚\n```\n\n### 机场旁取车\n\n```trip-event\ntime: "22:00"\ncategory: logistics\nplace: 羽田机场\ndetail: 日产 Note\n```\n\n## Day 2 · 2026-11-20',
      )
    const r = parse(shifted)
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    const go = journey(sanitize(r.trip!), '去程').transports[0]!
    expect(go.from, '去程出发端').toBeUndefined()
    expect(go.depTime).toBeUndefined()
    expect(go.to).toBe('HND T3')
  })

  it('首日在家、末日在家的行程：去程仍是抵达、返程仍是离开 —— 按行程首末日判会把两班都当成内部移动，家门口的机场就发出去了', () => {
    // 同一份 fixture，只把行程首末日各往外推一天（Day 1 前一天在家收拾，末日后一天在家歇着）
    const home = md.replace('start: 2026-11-20', 'start: 2026-11-19').replace('end: 2026-11-22', 'end: 2026-11-23')
    const r = parse(home)
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    const t = sanitize(r.trip!)
    const go = journey(t, '去程').transports[0]!
    const back = journey(t, '返程').transports[0]!
    expect(go.from, '去程出发端').toBeUndefined()
    expect(go.to).toBe('HND T3')
    expect(back.to, '返程到达端').toBeUndefined()
    expect(back.from).toBe('HND T3')
    // 正文清理也要跟着 role 走
    expect(t.days.flatMap((d) => d.events).find((e) => e.detailRef === '去程')!.summary).toBe('')
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

  it('事件卡、导语、事件散项 cost、附录一字不动（抵达 / 离开两张卡除外，见下一条）', () => {
    const before = load()
    const after = sanitize(before)
    // fixture 里这三样都真有内容，断言才不是空对空
    expect(before.days[0]!.intro).not.toBe('')
    expect(before.days[0]!.events.some((e) => e.cost)).toBe(true)
    expect(before.reference.length).toBeGreaterThan(0)
    // 端点卡与挨着它的两段路（进来的、出去的）不在这条的范围里 —— 见下两条
    const strip = (t: Trip) =>
      t.days.map((d) => {
        const endpoint = new Set(d.events.filter((e) => e.detailRef === '去程' || e.detailRef === '返程').map((e) => e.id))
        const touching = new Set<string | null>()
        d.events.forEach((e, i) => {
          if (endpoint.has(e.id)) touching.add(e.id).add(i === 0 ? null : d.events[i - 1]!.id)
        })
        return {
          ...d,
          // 预订信息全站都去（见「预订信息整个不进公开版」那条），比对时两边都拿掉
          events: d.events
            .filter((e) => !endpoint.has(e.id))
            .map((e) => ({ ...e, transports: [], booking: undefined, flags: e.flags.filter((f) => f !== 'needs-booking') })),
          legs: d.legs.filter((l) => !touching.has(l.afterEventId)),
        }
      })
    expect(strip(after)).toEqual(strip(before))
    expect(after.reference).toEqual(before.reference)
  })

  it('抵达 / 离开事件的正文不进公开版：摘要、全文、注意、变体、预订块全清；行程内部移动的照留', () => {
    const before = load()
    const arrive = before.days[0]!.events.find((e) => e.detailRef === '去程')!
    const depart = before.days[2]!.events.find((e) => e.detailRef === '返程')!
    const inner = before.days[1]!.events.find((e) => e.detailRef === '新干线')!
    // fixture 里三张卡都真有正文（抵达卡还有注意条目和变体），断言不是空对空
    expect(arrive.summary).not.toBe('')
    expect(arrive.notes.length).toBeGreaterThan(0)
    expect(arrive.variants.length).toBeGreaterThan(0)
    expect(depart.summary).not.toBe('')
    expect(inner.summary).not.toBe('')

    const after = sanitize(before)
    for (const ref of ['去程', '返程']) {
      const e = after.days.flatMap((d) => d.events).find((x) => x.detailRef === ref)!
      expect(e, ref).toMatchObject({ summary: '', detail: '', notes: [], variants: [] })
      expect(e.booking, ref).toBeUndefined()
    }
    expect(after.days[1]!.events.find((e) => e.detailRef === '新干线')!.summary).toBe(inner.summary)
  })

  it('进入离开卡的那段路也清：离开的接驳在卡前（去机场还车），不在卡后', () => {
    const before = load()
    const lastDay = before.days[2]!
    const depart = lastDay.events.find((e) => e.detailRef === '返程')!
    // fixture 里离开卡是当天第一张，进来的就是开场通勤（afterEventId 为 null）
    expect(lastDay.events[0]!.id).toBe(depart.id)
    const into = lastDay.legs.find((l) => l.afterEventId === null)!
    expect(into.label).toBeTruthy()
    expect(into.note).toBeTruthy()
    const after = sanitize(before).days[2]!.legs.find((l) => l.afterEventId === null)!
    expect(after.label).toBeUndefined()
    expect(after.note).toBeUndefined()
    expect(after.mode).toBe(into.mode)
  })

  it('抵达 / 离开卡后面那段路的 label / note 也清：它们写在 trip-event 围栏里，讲的还是作者自己的接驳', () => {
    const before = load()
    const arrive = before.days[0]!.events.find((e) => e.detailRef === '去程')!
    const legBefore = before.days[0]!.legs.find((l) => l.afterEventId === arrive.id)!
    expect(legBefore.label).toBeTruthy()
    expect(legBefore.note).toBeTruthy()
    const after = sanitize(before)
    const legAfter = after.days[0]!.legs.find((l) => l.afterEventId === arrive.id)!
    expect(legAfter.label).toBeUndefined()
    expect(legAfter.note).toBeUndefined()
    expect(legAfter.mode).toBe(legBefore.mode) // 路本身还在：时长、方式照留，只去文字
    expect(legAfter.durationMin).toBe(legBefore.durationMin)
    // 内部移动后面的路一字不动
    const drive = before.days[0]!.legs.find((l) => l.mode === 'drive')!
    expect(after.days[0]!.legs.find((l) => l.id === drive.id)).toEqual(drive)
  })

  it('预订信息整个不进公开版：booking 块（需预订 / 已预订 / 截止 / 备注）与待订标记全去，别的标记照留', () => {
    const before = load()
    const all = (t: Trip) => t.days.flatMap((d) => d.events)
    // fixture 里内部事件真带着已订的 booking 块与待订标记 —— 断言不是空对空
    const booked = all(before).find((e) => e.booking?.status === 'booked')!
    const todo = all(before).find((e) => e.flags.includes('needs-booking'))!
    expect(booked.booking?.note).toBeTruthy()
    expect(todo.flags).toContain('optional')
    const after = sanitize(before)
    expect(all(after).filter((e) => e.booking !== undefined)).toEqual([])
    expect(all(after).filter((e) => e.flags.includes('needs-booking'))).toEqual([])
    expect(all(after).find((e) => e.id === todo.id)!.flags).toEqual(['optional'])
    // 落到文本上：公开版 plan.md 里一个 booking 字样都没有，备注里的取车码也不在
    const md = serialize(after)
    expect(md).not.toMatch(/booking:|needs-booking|R8Q4/)
  })

  it('硬约束整块不进公开版：它从不渲染，却会原样躺在 plan.md 里被 fetch 到', () => {
    const before = load()
    // fixture 里这块真有内容，而且写着班次号与确认号 —— 断言不是空对空
    expect(before.constraints.length).toBeGreaterThan(0)
    expect(before.constraints.some((c) => c.label.includes('UA34'))).toBe(true)
    expect(sanitize(before).constraints).toEqual([])
  })
})
