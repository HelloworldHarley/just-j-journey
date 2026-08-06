import { describe, expect, it } from 'vitest'
import { DEFAULT_CHECK_OUT, dayColor } from '@jjj/schema'
import { parse } from '../src/parse.ts'
import { summarize } from '../src/summary.ts'
import { serialize } from '../src/serialize.ts'
import { applyPatch } from '../src/patch.ts'
import { parseLatLng } from '../src/values.ts'

/**
 * 静默错误的回归测试。
 *
 * 这里每一条都对应一个**真实发生过、而且不报错**的缺陷 —— 解析照常通过、
 * 界面照常渲染，只是数字或语义悄悄错了。正因为不吭声，只能靠测试钉住。
 */

const wrap = (body: string): string => `---
id: t
title: T
destination: X
timezone: UTC
start: 2026-10-01
end: 2026-10-02
---
${body}`

const event = (title: string, time: string, extra = ''): string =>
  ['### ' + title, '```trip-event', `time: ${time}`, 'category: sight', extra, '```', ''].join('\n')

describe('坐标方向字母', () => {
  it('N/S/E/W 决定正负，不能只当噪声剥掉', () => {
    // 曾经：字母被丢弃 → 西经变东经，西雅图被画到中国境内，
    // 而且整份文件一致地错时坐标离群检测也抓不到
    expect(parseLatLng('47.6062°N, 122.3321°W')).toEqual([47.6062, -122.3321])
    expect(parseLatLng('33.8688°S, 151.2093°E')).toEqual([-33.8688, 151.2093])
  })

  it('原有的负号写法不受影响', () => {
    expect(parseLatLng('47.6062, -122.3321')).toEqual([47.6062, -122.3321])
    expect(parseLatLng([47.6062, -122.3321])).toEqual([47.6062, -122.3321])
    expect(parseLatLng({ lat: 47.6062, lng: -122.3321 })).toEqual([47.6062, -122.3321])
  })
})

describe('day.color 与书写顺序无关', () => {
  // Day 2 故意写在 Day 1 前面
  const outOfOrder = wrap(
    `## Day 2 · 2026-10-02\n${event('B', '"10:00"')}## Day 1 · 2026-10-01\n${event('A', '"10:00"')}`,
  )

  it('颜色由 day.index 决定，而不是标题在文件里的出现顺序', () => {
    // 曾经取自 forEach 的下标，于是 Day 1 拿到第 2 个色。
    // 注意：只断言「幂等」是不够的 —— 所有天同一个颜色也满足幂等，
    // 必须钉住「按 index 取色环」这个具体性质
    const days = parse(outOfOrder).trip!.days
    const byIndex = new Map(days.map((d) => [d.index, d.color]))
    expect(byIndex.get(1)).toBe(dayColor(1))
    expect(byIndex.get(2)).toBe(dayColor(2))
    expect(byIndex.get(1)).not.toBe(byIndex.get(2))
  })

  it('乱序书写时仍然语义幂等', () => {
    // serialize 总按日期排序输出，取书写顺序的话往返一次颜色就互换 ——
    // roundtrip 测试的两个 fixture 恰好都是顺序书写，测不到这个 case
    const once = parse(outOfOrder).trip
    expect(once).not.toBeNull()
    expect(parse(serialize(once!)).trip).toEqual(once)
  })
})

describe('transport.stops 的宽容度', () => {
  it('单个中转写成 map 而非列表也能解析', () => {
    // 曾经：非数组直接丢成 []，整个中转段静默消失且零诊断；
    // 而紧邻的 transport 字段本身是支持「单对象或列表」的，宽容度不一致
    const md = wrap(
      '## Day 1 · 2026-10-01\n' +
        [
          '### 航班',
          '```trip-event',
          'time: "09:00"',
          'category: flight',
          'transport: {mode: flight, from: A, to: B, stops: {airport: SEA, wait: 2h}}',
          '```',
          '',
        ].join('\n'),
    )
    const trip = parse(md).trip
    expect(trip).not.toBeNull()
    const stops = trip!.days[0]!.events[0]!.transports[0]!.stops
    expect(stops).toHaveLength(1)
    expect(stops[0]).toMatchObject({ airport: 'SEA', waitMin: 120 })
  })
})

describe('booking.status 拼错必须报错', () => {
  it('不能静默兜底成 required —— 那会把「已订」读成「待订」', () => {
    const md = wrap(`## Day 1 · 2026-10-01\n${event('X', '"09:00"', 'booking: {status: bookd}')}`)
    const { trip, diagnostics } = parse(md)
    expect(trip).toBeNull()
    const err = diagnostics.find((d) => d.severity === 'error')
    expect(err?.message).toContain('booking status')
    expect(err?.hint).toContain('booked') // 给出「是否想写」建议
  })

  it('合法值照常通过', () => {
    const md = wrap(`## Day 1 · 2026-10-01\n${event('X', '"09:00"', 'booking: {status: booked}')}`)
    expect(parse(md).trip?.days[0]?.events[0]?.booking?.status).toBe('booked')
  })
})

describe('时段重叠检查', () => {
  it('没有 to_next 的两个事件撞车时要出诊断', () => {
    // 曾经：余量检查只在有通勤段时触发，前端又把负空档钳成 0，
    // 于是「10:00–12:00」后面跟「11:00–13:00」全链路无人吭声
    const md = wrap(
      `## Day 1 · 2026-10-01\n${event('A', '10:00-12:00')}${event('B', '11:00-13:00')}`,
    )
    const warn = parse(md).diagnostics.find((d) => d.message.includes('时段重叠'))
    expect(warn).toBeDefined()
    expect(warn?.hint).toContain('60 分钟')
  })

  it('有 to_next 时交给余量检查，不重复报', () => {
    const md = wrap(
      '## Day 1 · 2026-10-01\n' +
        event('A', '10:00-12:00', 'to_next: {mode: walk, minutes: 10}') +
        event('B', '11:00-13:00'),
    )
    const diags = parse(md).diagnostics.filter((d) => d.message.includes('时段重叠'))
    expect(diags).toHaveLength(0)
  })

  it('模糊时段不参与重叠判定 —— 名义窗口不是排定时刻', () => {
    const md = wrap(`## Day 1 · 2026-10-01\n${event('A', 'afternoon')}${event('B', '14:00-15:00')}`)
    const diags = parse(md).diagnostics.filter((d) => d.message.includes('时段重叠'))
    expect(diags).toHaveLength(0)
  })
})

describe('删除/移动事件时的通勤段', () => {
  const threeEvents = wrap(
    '## Day 1 · 2026-10-01\n' +
      event('A', '09:00-10:00', 'to_next: {mode: walk, minutes: 5, label: A到B}') +
      event('B', '10:05-11:00', 'to_next: {mode: rail, minutes: 60, label: B到C}') +
      event('C', '12:00-13:00'),
  )

  it('删中间事件时前后两段通勤都要删掉', () => {
    // 曾经：只删被删事件自己的 leg，前一段静默改指到新后继却仍带原时长 ——
    // 「A 步行 5 分到 B」会变成「A 步行 5 分到 C」，而实际 A→C 要坐车 60 分
    const trip = parse(threeEvents).trip!
    const b = trip.days[0]!.events[1]!
    const r = applyPatch(trip, [{ op: 'remove_event', eventId: b.id }])
    expect(r.ok).toBe(true)
    expect(r.trip.days[0]!.legs).toEqual([])
    expect(r.markdown).not.toContain('A到B')
  })

  it('移动事件同理', () => {
    const trip = parse(threeEvents).trip!
    const b = trip.days[0]!.events[1]!
    const c = trip.days[0]!.events[2]!
    const r = applyPatch(trip, [
      { op: 'move_event', eventId: b.id, dayIndex: 1, afterEventId: c.id },
    ])
    expect(r.ok).toBe(true)
    expect(r.trip.days[0]!.legs).toEqual([])
  })

  it('删末尾事件不误伤更前面的通勤段', () => {
    const trip = parse(threeEvents).trip!
    const c = trip.days[0]!.events[2]!
    const r = applyPatch(trip, [{ op: 'remove_event', eventId: c.id }])
    expect(r.ok).toBe(true)
    // A→B 那段与被删的 C 无关，必须留下
    expect(r.trip.days[0]!.legs.map((l) => l.label)).toEqual(['A到B'])
  })
})

describe('住宿是一等区间，不靠名字合并', () => {
  const md = `---
id: t
title: T
destination: X
timezone: UTC
start: 2026-10-01
end: 2026-10-05
---

## 住宿

\`\`\`trip-stays
- what: Astra Hotel
  from: "2026-10-01 16:00"
  to: "2026-10-02 09:45"
- what: 山里木屋
  from: "2026-10-02 20:30"
  to: "2026-10-03 07:15"
- what: astra hotel
  from: "2026-10-03 18:00"
  to: "2026-10-05"
\`\`\`

## Day 1 · 2026-10-01
${event('入住', '"16:00"')}`

  it('先住 A、去别处、再回 A 产出三段独立区间', () => {
    // 曾经：区间靠「连续几天 lodging 名字相等」合并出来，
    // 大小写一漂就断成两截，续住那晚的信息直接从界面消失（code review F3）
    const stays = parse(md).trip!.stays
    expect(stays.map((s) => s.what)).toEqual(['Astra Hotel', '山里木屋', 'astra hotel'])
  })

  it('只写日期时按保底时刻算，但写回仍是日期，往返不长出时刻', () => {
    const once = parse(md).trip!
    const last = once.stays[2]!
    expect(last.to.minute).toBe(DEFAULT_CHECK_OUT)
    expect(last.to.raw).toBe('2026-10-05')

    const md2 = serialize(once)
    expect(md2).toContain('to: "2026-10-05"')
    expect(md2).not.toContain('to: "2026-10-05 10:00"')
    expect(parse(md2).trip).toEqual(once)
  })

  it('两端都有确定时刻 —— 区间带永远知道画到哪', () => {
    for (const st of parse(md).trip!.stays) {
      expect(Number.isInteger(st.from.minute)).toBe(true)
      expect(Number.isInteger(st.to.minute)).toBe(true)
    }
  })
})

describe('旧写法不静默丢数据', () => {
  it('事件上的 `stay:` 与天上的 `lodging:` 都报错', () => {
    // 迁移到 trip-stays 之后，这两个键不再被读取。
    // 不报错的话，作者的平台/星级/停车信息会无声消失
    const md = wrap(
      `## Day 1 · 2026-10-01\n\`\`\`trip-day\nlodging: Astra Hotel\n\`\`\`\n` +
        event('入住', '"16:00"', 'stay: {platform: 万豪, stars: 4}'),
    )
    const errors = parse(md).diagnostics.filter((d) => d.severity === 'error')
    expect(errors.map((d) => d.message)).toEqual([
      '`trip-day` 的 `lodging` 已不再使用',
      '`stay:` 已不再写在事件上',
    ])
  })
})

describe('构成条不被全天事件淹没', () => {
  it('allday 事件不计入 dayComposition 的分钟数与跨度', () => {
    // 曾经：一张周游券（allday，名义窗口 00:00–24:00）按 1440 分钟计入，
    // 独占构成条的八九成，密度条几乎全灰 —— 同一次改动里 daySpan 修了
    // 这个陷阱，dayComposition 却漏了，两个「同一件事」的口径分了叉
    const md = wrap(
      `## Day 1 · 2026-10-01\n### 周游券\n\`\`\`trip-event\ntime: allday\ncategory: logistics\n\`\`\`\n` +
        event('公园', '10:00–12:00'),
    )
    const shape = summarize(parse(md).trip!).dayShape[0]!
    expect(shape.other).toBe(0) // 周游券是 logistics（other 组），被排除后归零
    expect(shape.play).toBe(120)
    expect(shape.span).toBe(120)
  })
})

describe('trip-stays 不静默吞错', () => {
  const stays = (block: string): string =>
    wrap(`## 住宿\n\`\`\`trip-stays\n${block}\n\`\`\`\n## Day 1 · 2026-10-01\n${event('入住', '"16:00"')}`)

  it('漏写 what: 的裸字符串项报错，不是整条消失', () => {
    // 曾经：`- Astra Hotel` 被 asRecord 判 null 后静默跳过 → stays: []、零诊断
    const r = parse(stays('- Astra Hotel'))
    expect(r.diagnostics.some((d) => d.severity === 'error' && d.message.includes('不是键值对'))).toBe(true)
  })

  it('字段名拼错给出警告与建议，不是渲染「待填」骗人', () => {
    const r = parse(stays('- what: Astra\n  from: "2026-10-01 16:00"\n  to: "2026-10-02 10:00"\n  platfrom: 万豪'))
    const w = r.diagnostics.find((d) => d.message.includes('platfrom'))
    expect(w?.severity).toBe('warning')
    expect(w?.hint).toContain('platform')
  })

  it('stars 写歪只丢字段并警告，不让整趟行程解析失败', () => {
    // 曾经：stars: 0 → zod 裸英文报错、trip = null，整页打不开
    const r = parse(stays('- what: Astra\n  from: "2026-10-01 16:00"\n  to: "2026-10-02 10:00"\n  stars: 4.5'))
    expect(r.trip).not.toBeNull()
    expect(r.trip!.stays[0]!.stars).toBeUndefined()
    expect(r.diagnostics.some((d) => d.severity === 'warning' && d.message.includes('stars'))).toBe(true)
  })
})
