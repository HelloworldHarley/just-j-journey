import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Rental, Trip } from '@jjj/schema'
import { parse } from '../src/parse.ts'
import { adjacentLegs } from '../src/resolve.ts'
import { serialize } from '../src/serialize.ts'
import { blurCoord, sanitize, type Policy } from '../src/sanitize.ts'
import { edit } from './support/index.ts'

/**
 * 公开版抹除 —— 逐字段策略表：只有写明 keep 的字段能过，拿掉的敏感值同时进黑名单。
 * fixture 是合成的（工具仓库是公开的，真值不能进测试）：去程 hide: from、返程 hide: to、新干线没写。
 */
const md = readFileSync(join(__dirname, 'fixtures/sanitize-full.md'), 'utf8')
const load = (src = md): Trip => {
  const r = parse(src)
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
  return r.trip!
}
const journey = (t: Trip, what: string) => t.journeys.find((j) => j.what === what)!
const events = (t: Trip) => t.days.flatMap((d) => d.events)
const ends = (t: { from?: string; to?: string }) => [t.from, t.to]
/** 被抹掉的字段在公开版记录里根本不存在（不是 undefined 值） */
const absent = (o: object, keys: readonly string[]) => keys.filter((k) => k in o)
const secretValues = (t: Trip) => sanitize(t).secrets.flatMap((s) => (s.kind === 'coord' ? [] : [s.value]))

/** 一份只有长途与引用它们的事件的小行程 —— 审查报告里会把家门口机场发出去的三种写法 */
const tripWith = (transports: string, days: string): Trip =>
  load(`---
id: t
title: T
destination: X
timezone: UTC
start: 2026-11-20
end: 2026-11-22
visibility: public
---

## 长途

\`\`\`trip-transports
${transports}
\`\`\`

${days}`)
const day = (n: number, date: string, title: string, detail: string, time = '10:00') =>
  `## Day ${n} · ${date}\n\n### ${title}\n\n\`\`\`trip-event\ntime: "${time}"\ncategory: flight\ndetail: ${detail}\n\`\`\`\n`

describe('sanitize · 长途按 hide 藏端', () => {
  it('hide: from：出发地、出发时刻与日期都不发，出发地进黑名单；到达日落成显式 arr_date', () => {
    const t = load()
    const f = journey(sanitize(t).trip, '去程').transports[0]!
    expect(f).toMatchObject({ traveler: '我', mode: 'flight', to: 'HND T3', arrTime: '15:30', arrDate: '2026-11-20', hide: [] })
    for (const k of ['from', 'depTime', 'depDate', 'carrier', 'number', 'price', 'cabin', 'seat', 'baggage', 'refund', 'note'] as const) {
      expect(f[k], k).toBeUndefined()
    }
    expect(f.stops).toEqual([])
    expect(f.legs).toEqual([])
    expect(f.durationMin).toBeNull()
    expect(f.arrDayOffset).toBeNull()
    expect(journey(sanitize(t).trip, '去程').cost).toBeUndefined()
    expect(secretValues(t)).toContain('LAX T2')
  })

  it('没写 hide：两端时刻与地点全发，钱也发（照着走一遍的人也要花），班次座位照抹', () => {
    const t = load()
    const j = journey(sanitize(t).trip, '新干线')
    expect(j.transports[0]).toMatchObject({ mode: 'hsr', from: '东京', to: '京都', depTime: '09:00', arrTime: '11:15', arrDate: '2026-11-21', price: '¥11,220' })
    expect(j.cost).toEqual(journey(t, '新干线').cost)
    for (const k of ['carrier', 'number', 'seat', 'depDate'] as const) expect(j.transports[0]![k], k).toBeUndefined()
  })

  it('接驳长途（带 hide）的 cost 与票价不发、进黑名单：从哪出发、买的什么票，每个人都不一样', () => {
    const t = load()
    for (const what of ['去程', '返程']) {
      const j = journey(sanitize(t).trip, what)
      expect(j.cost, what).toBeUndefined()
      expect(j.transports.every((x) => x.price === undefined), what).toBe(true)
    }
    expect(secretValues(t)).toEqual(expect.arrayContaining(['$900', '$842', '$715']))
  })

  it('hide: to：只剩出发端，到达地进黑名单', () => {
    const t = load()
    const f = journey(sanitize(t).trip, '返程').transports[0]!
    expect(f).toMatchObject({ mode: 'flight', from: 'HND T3', depTime: '18:30' })
    for (const k of ['to', 'arrTime', 'arrDate', 'depDate', 'price'] as const) expect(f[k], k).toBeUndefined()
    expect(secretValues(t)).toContain('SFO')
  })

  it('hide: [from, to]：两端都藏，只剩乘客与方式', () => {
    const t = load(edit(md, 'from: 东京, to: 京都,', 'from: 东京, to: 京都, hide: [from, to],'))
    const f = journey(sanitize(t).trip, '新干线').transports[0]!
    expect(f.mode).toBe('hsr')
    for (const k of ['from', 'to', 'depTime', 'arrTime', 'arrDate'] as const) expect(f[k], k).toBeUndefined()
  })

  it('旅伴晚一天到：她那条照样按 hide 藏 —— 不看引用落在哪天', () => {
    const t = tripWith(
      '- what: 我的去程\n  transport: {traveler: 我, from: AAA, to: HND, hide: from}\n- what: 旅伴的去程\n  transport: {traveler: 旅伴, from: BBB, to: HND, hide: from}',
      day(1, '2026-11-20', '我落地', '我的去程') + day(2, '2026-11-21', '旅伴落地', '旅伴的去程'),
    )
    const late = journey(sanitize(t).trip, '旅伴的去程').transports[0]!
    expect(late.from).toBeUndefined()
    expect(late.to).toBe('HND')
  })

  it('单程、往返写成一条：按每条交通自己的 hide 判，回家那班的目的地不发', () => {
    const oneWay = tripWith('- what: 返程\n  transport: {from: HND, to: AAA, hide: to}', day(1, '2026-11-22', '起飞', '返程'))
    expect(ends(journey(sanitize(oneWay).trip, '返程').transports[0]!)).toEqual(['HND', undefined])

    const roundTrip = tripWith(
      '- what: 往返\n  transport:\n    - {from: AAA, to: HND, hide: from}\n    - {from: HND, to: AAA, hide: to}',
      day(1, '2026-11-20', '出发', '往返'),
    )
    const [go, back] = journey(sanitize(roundTrip).trip, '往返').transports
    expect(ends(go!)).toEqual([undefined, 'HND'])
    expect(ends(back!)).toEqual(['HND', undefined])
  })

  it('过夜交通：出发日不是事件那天时写出 dep_date，公开版不会先到后发', () => {
    const t = tripWith(
      '- what: 夜行巴士\n  transport: {mode: bus, from: 东京站, to: 京都站, dep_date: "2026-11-21", dep_time: "22:00", arr_time: "06:00"}',
      day(2, '2026-11-22', '到京都', '夜行巴士', '06:00'),
    )
    const bus = journey(sanitize(t).trip, '夜行巴士').transports[0]!
    expect(bus).toMatchObject({ depDate: '2026-11-21', depTime: '22:00', arrDate: '2026-11-22', arrTime: '06:00' })
  })

  it('没被任何事件引用的长途不发，但它的班次照样进黑名单', () => {
    const t = load()
    expect(sanitize(t).trip.journeys.map((j) => j.what)).toEqual(['去程', '新干线', '返程'])
    expect(secretValues(t)).toContain('X99')
  })
})

describe('sanitize · 住宿 / 租车 / 地点', () => {
  it('住宿与租车原样公开，钱也在（真实成本）；只有民宿那条住宿的备注抹掉（入住说明、门锁密码最常写在这里）', () => {
    const before = load()
    const { trip: after, secrets } = sanitize(before)
    const { note: stayNote, ...stayRest } = before.stays[0]!
    expect(stayRest.cost).toBeDefined() // fixture 里真有房费，断言不是空对空
    expect(after.stays[0]).toEqual(stayRest)
    expect(secrets).toContainEqual(expect.objectContaining({ kind: 'text', value: stayNote }))
    expect(after.rentals[0]).toEqual(before.rentals[0])
    expect(secrets.some((s) => s.kind === 'money' && ['$120.00', '$88.40'].includes(s.value))).toBe(false)
  })

  it('民宿：坐标模糊到 2 位小数，en / note / url / gmaps_place_id 全删且进黑名单；其他类别原样', () => {
    const before = load()
    const { trip: after, secrets } = sanitize(before)
    const cabin = after.places.find((p) => p.category === 'homestay')!
    expect(cabin.coord).toEqual([139.12, 35.65])
    expect(absent(cabin, ['nameEn', 'note', 'url', 'gmapsPlaceId'])).toEqual([])
    expect(cabin.geo.query).toBe('山间小屋')
    expect(secrets).toContainEqual(expect.objectContaining({ kind: 'coord', coord: [139.12345, 35.65432] }))
    expect(secretValues(before)).toEqual(expect.arrayContaining(['777 Made Up Road', '门牌在邮箱后面', 'https://example.com/listing/1', 'ChIJfakefakefake']))
    const airport = after.places.find((p) => p.name === '羽田机场')!
    expect(airport).toEqual(before.places.find((p) => p.name === '羽田机场'))
  })

  it('住宿名与地点名写得不一样、入住卡在民宿：这条住宿照样按民宿抹备注', () => {
    // 「山间小屋」这条住宿改名，并不再指向地点 —— 唯一的线索是入住卡挂在民宿上
    const renamed = edit(edit(md, '- what: 山间小屋\n', '- what: 小屋整租\n'), 'detail: 山间小屋', 'detail: 小屋整租')
    const t = parse(renamed).trip!
    const stay = t.stays.find((s) => s.what === '小屋整租')!
    expect(t.places.find((p) => p.id === stay.placeId)?.category).not.toBe('homestay')
    const out = sanitize(t).trip.stays.find((s) => s.what === '小屋整租')!
    expect('note' in out).toBe(false)
  })

  it('进出民宿的那几段路去掉时长、距离与说明 —— 否则「开 90 分钟」把模糊过的位置算回来', () => {
    const before = load()
    const cabinId = before.places.find((p) => p.category === 'homestay')!.id
    const toCabin = before.days.flatMap((d) => d.legs).filter((l) => l.from === cabinId || l.to === cabinId)
    expect(toCabin.length).toBeGreaterThanOrEqual(2) // 提车 → 入住，第二天从小屋出发
    const after = new Map(sanitize(before).trip.days.flatMap((d) => d.legs).map((l) => [l.id, l]))
    for (const l of toCabin) {
      const out = after.get(l.id)!
      expect(out, l.id).toMatchObject({ mode: l.mode, durationMin: null, distanceKm: null })
      expect(absent(out, ['label', 'note']), l.id).toEqual([])
    }
  })

  it('没人引用的地点不发：界面永远不画它，留着只是多一份风险', () => {
    const extra = edit(md, '- name: 京都站\n', '- name: 朋友家\n  en: 2-14 Example-cho\n  coord: 35.61835, 139.70315\n  category: transit\n  note: 车库码 0614\n- name: 京都站\n')
    const t = load(extra)
    expect(t.places.some((p) => p.name === '朋友家')).toBe(true)
    expect(sanitize(t).trip.places.some((p) => p.name === '朋友家')).toBe(false)
  })

  it('blurCoord：四舍五入，负数也对', () => {
    expect(blurCoord([139.12345, 35.65432])).toEqual([139.12, 35.65])
    expect(blurCoord([-70.12345, 12.34567])).toEqual([-70.12, 12.35])
  })

  it('策略表每个字段都要有规则：少一个，typecheck 不过（这条测试由 tsc 执行）', () => {
    // @ts-expect-error —— 少了 dropoffPlaceId
    const partial: Policy<Rental, never> = {
      what: 'keep', platform: 'keep', from: 'keep', to: 'keep', cost: 'omit', refund: 'keep',
      note: 'keep', mileage: 'keep', insurance: 'keep', pickupPlaceId: 'keep',
    }
    expect(partial).toBeDefined()
  })
})

describe('sanitize · 合法性与正文', () => {
  it('抹完仍是合法 TripMD：serialize 后零错误可解析，且二次往返字节稳定', () => {
    const md2 = serialize(sanitize(load()).trip)
    const again = parse(md2)
    expect(again.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(serialize(again.trip!)).toBe(md2)
    expect(again.trip!.visibility).toBe('public')
  })

  it('事件卡、导语、事件散项 cost、附录一字不动 —— 接驳卡、挨着它的路、民宿那几段路与预订信息除外（各有一条）', () => {
    const before = load()
    const after = sanitize(before).trip
    // fixture 里这些都真有内容，断言才不是空对空
    expect(before.days[0]!.intro).not.toBe('')
    expect(before.days.flatMap((d) => d.events).some((e) => e.cost)).toBe(true)
    expect(before.reference.length).toBeGreaterThan(0)
    const cabinId = before.places.find((p) => p.category === 'homestay')!.id
    const strip = (t: Trip) =>
      t.days.map((d) => {
        const connection = new Set(d.events.filter((e) => e.detailRef === '去程' || e.detailRef === '返程').map((e) => e.id))
        const touched = new Set(
          d.events.flatMap((e, i) => {
            if (!connection.has(e.id)) return []
            const { incoming, outgoing } = adjacentLegs(d, i)
            return [incoming?.id, outgoing?.id]
          }),
        )
        return {
          ...d,
          events: d.events
            .filter((e) => !connection.has(e.id))
            .map((e) => ({ ...e, booking: undefined, flags: e.flags.filter((f) => f !== 'needs-booking') })),
          legs: d.legs.filter((l) => !touched.has(l.id) && l.from !== cabinId && l.to !== cabinId),
        }
      })
    // 剩下的路里真有一段带说明的（新干线 → 清水寺），断言不是空对空
    expect(strip(before).flatMap((d) => d.legs).some((l) => l.label)).toBe(true)
    expect(strip(after)).toEqual(strip(before))
    expect(after.reference).toEqual(before.reference)
  })

  it('接驳卡（引用了带 hide 的长途）的正文不进公开版：摘要、全文、注意、变体、预订块全清；没写 hide 的照留', () => {
    const before = load()
    const arrive = events(before).find((e) => e.detailRef === '去程')!
    const inner = events(before).find((e) => e.detailRef === '新干线')!
    // fixture 里卡都真有正文（抵达卡还有注意条目和变体），断言不是空对空
    expect(arrive.summary).not.toBe('')
    expect(arrive.notes.length).toBeGreaterThan(0)
    expect(arrive.variants.length).toBeGreaterThan(0)
    expect(inner.summary).not.toBe('')

    const after = sanitize(before).trip
    for (const ref of ['去程', '返程']) {
      const e = events(after).find((x) => x.detailRef === ref)!
      expect(e, ref).toMatchObject({ summary: '', detail: '', notes: [], variants: [] })
      expect(e.booking, ref).toBeUndefined()
    }
    expect(events(after).find((e) => e.detailRef === '新干线')!.summary).toBe(inner.summary)
  })

  it('接驳卡前后两段路的说明也清：离开的接驳在卡前（去机场还车），抵达的在卡后', () => {
    const before = load()
    const after = sanitize(before).trip
    for (const [dayIdx, ref, side] of [[0, '去程', 'outgoing'], [2, '返程', 'incoming']] as const) {
      const d = before.days[dayIdx]!
      const leg = adjacentLegs(d, d.events.findIndex((e) => e.detailRef === ref))[side]!
      expect(leg.label, ref).toBeTruthy()
      expect(leg.note, ref).toBeTruthy()
      const out = after.days[dayIdx]!.legs.find((l) => l.id === leg.id)!
      expect(out.mode, ref).toBe(leg.mode)
      expect(absent(out, ['label', 'note']), ref).toEqual([])
    }
  })

  it('预订信息整个不进公开版：booking 块与待订标记全去、备注进黑名单，别的标记照留', () => {
    const before = load()
    const booked = events(before).find((e) => e.booking?.status === 'booked')!
    const todo = events(before).find((e) => e.flags.includes('needs-booking'))!
    expect(booked.booking?.note).toBeTruthy()
    expect(todo.flags).toContain('optional')
    const { trip: after } = sanitize(before)
    expect(events(after).filter((e) => e.booking !== undefined)).toEqual([])
    expect(events(after).find((e) => e.id === todo.id)!.flags).toEqual(['optional'])
    expect(secretValues(before)).toContain(booked.booking!.note)
    expect(serialize(after)).not.toMatch(/booking:|needs-booking|R8Q4/)
  })

  it('硬约束整块不进公开版，label / note 按「只提醒」进黑名单（自由文本，常与地点同名）', () => {
    const before = load()
    expect(before.constraints.some((c) => c.label.includes('UA34'))).toBe(true)
    const { trip: after, secrets } = sanitize(before)
    expect(after.constraints).toEqual([])
    const fromConstraints = secrets.filter((s) => s.source.startsWith('硬约束'))
    expect(fromConstraints.length).toBeGreaterThan(0)
    expect(fromConstraints.every((s) => s.kind !== 'coord' && s.loose)).toBe(true)
  })
})
