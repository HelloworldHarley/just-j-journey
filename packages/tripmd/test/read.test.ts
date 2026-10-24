import { describe, expect, it } from 'vitest'
import { parse } from '../src/parse.ts'
import { parseSpace } from '../src/space.ts'
import { lex } from '../src/lexer.ts'
import { toIcs } from '../src/ics.ts'
import { timelineDates } from '../src/transport-dates.ts'
import type { Diagnostic } from '../src/diagnostics.ts'

/**
 * 读取层（read.ts 的字段表）的回归测试 —— 每条对应一个曾经静默的读法：
 * 写了但读不出来的值被当成没写、行号指在块的第一行、全角与中文名认不出、别名两套口径……
 * 样例全是合成数据。
 */

const doc = (body: string, fm = ''): string => `---
id: t
title: T
destination: X
timezone: UTC
start: 2026-10-01
end: 2026-10-03
${fm}---
${body}`

const event = (title: string, ...lines: string[]): string =>
  ['### ' + title, '```trip-event', ...lines, '```', ''].join('\n')

const day1 = (...events: string[]): string => `## Day 1 · 2026-10-01\n${events.join('')}`

/** 文本里第一处出现 needle 的行号（1 起） */
const lineOf = (md: string, needle: string): number => {
  const i = md.indexOf(needle)
  if (i < 0) throw new Error(`样例里没有「${needle}」`)
  return md.slice(0, i).split('\n').length
}

const find = (ds: Diagnostic[], text: string): Diagnostic | undefined => ds.find((d) => d.message.includes(text))

const journey = (transport: string): string =>
  ['## 长途', '```trip-transports', '- what: 去程', `  transport: ${transport}`, '```', ''].join('\n') +
  day1(event('出发', 'time: "09:00"', 'category: flight', 'detail: 去程'))

describe('写了但读不出来的值一律报出来，报在它自己那一行', () => {
  it('不存在的日期（2026-02-30）在长途、中转、预订截止上都是错误', () => {
    const md = doc(
      ['## 长途', '```trip-transports', '- what: 去程', '  transport:', '    dep_date: "2026-02-30"',
        '    stops: [{airport: X, arr_date: "2026-13-01"}]', '```', ''].join('\n') +
        day1(event('出发', 'time: "09:00"', 'category: flight', 'detail: 去程', 'booking: {status: required, deadline: 2026-09-31}')),
    )
    const { trip, diagnostics } = parse(md)
    expect(trip).toBeNull()
    expect(find(diagnostics, '"2026-02-30"')).toMatchObject({ severity: 'error', line: lineOf(md, 'dep_date') })
    expect(find(diagnostics, '"2026-13-01"')).toMatchObject({ severity: 'error', line: lineOf(md, 'stops:') })
    expect(find(diagnostics, '2026-09-31')).toMatchObject({ severity: 'error', line: lineOf(md, 'deadline') })
  })

  it('时刻最晚 24:00：dep_time 24:30 是错误，不悄悄变成次日 00:30', () => {
    const { diagnostics } = parse(doc(journey('{mode: flight, dep_time: "24:30"}')))
    expect(find(diagnostics, '"24:30"')?.severity).toBe('error')
  })

  it('to_next 的 minutes 走时长读法：1h30 = 90；「20 min 4 km」是错误而不是静默未知', () => {
    const ok = parse(doc(day1(event('A', 'time: "09:00"', 'category: sight', 'to_next: {mode: walk, minutes: 1h30}'), event('B', 'time: "11:00"', 'category: sight'))))
    expect(ok.trip!.days[0]!.legs[0]!.durationMin).toBe(90)

    const md = doc(day1(event('A', 'time: "09:00"', 'category: sight', 'to_next: {mode: walk, minutes: 20 min 4 km}'), event('B', 'time: "11:00"', 'category: sight')))
    expect(find(parse(md).diagnostics, '20 min 4 km')).toMatchObject({ severity: 'error', line: lineOf(md, 'to_next') })
  })

  it('显示字段读不出来是警告并说明已忽略（星级写成文字）', () => {
    const md = doc(['```trip-stays', '- what: 旅馆', '  from: 2026-10-01', '  to: 2026-10-02', '  stars: 四星', '```', ''].join('\n') +
      day1(event('入住', 'time: "18:00"', 'category: hotel', 'detail: 旅馆')))
    const { trip, diagnostics } = parse(md)
    expect(trip!.stays[0]!.stars).toBeUndefined()
    const w = find(diagnostics, '`stars`')
    expect(w).toMatchObject({ severity: 'warning', line: lineOf(md, 'stars') })
    expect(w!.message).toContain('已忽略')
  })

  it('形状不对的值只报一条，说的是这个字段自己该是什么；空字符串算没写', () => {
    const md = doc(day1(event('A', 'time: "09:00"', 'category: sight')), 'travelers: true\nvisibility: ""\n')
    const about = parse(md).diagnostics.filter((d) => d.message.includes('travelers') || d.message.includes('visibility'))
    expect(about).toHaveLength(1)
    expect(about[0]!.message).toContain('应为正整数')
  })

  it('notes: false 不会变成一条「false」注意，而是报出来', () => {
    const { trip, diagnostics } = parse(doc(day1(event('A', 'time: "09:00"', 'category: sight', 'notes: false'))))
    expect(trip!.days[0]!.events[0]!.notes).toEqual([])
    expect(find(diagnostics, '`notes`')?.severity).toBe('warning')
  })

  it('列表里写错的那一项单独报（第几项、写的是什么），其余照收', () => {
    const md = doc(day1(event('A', 'time: "09:00"', 'category: sight', 'flags: [tentative, optinal]')))
    const { trip, diagnostics } = parse(md)
    expect(trip!.days[0]!.events[0]!.flags).toEqual(['tentative'])
    expect(find(diagnostics, '第 2 项写的是 "optinal"')?.hint).toContain('optional')
  })

  it('frontmatter 的 YAML 错误报在真实行号（曾经差一行）', () => {
    const md = `---\nid: t\ntitle: T\ndestination: [x\n---\n${day1(event('A', 'time: "09:00"', 'category: sight'))}`
    const err = parse(md).diagnostics.find((d) => d.message.includes('YAML'))
    expect(err?.line).toBeGreaterThanOrEqual(lineOf(md, 'destination'))
  })

  it('frontmatter 字段报在它自己那一行：start 写成不存在的日期', () => {
    const md = doc(day1(event('A', 'time: "09:00"', 'category: sight'))).replace('start: 2026-10-01', 'start: 2026-02-30')
    expect(find(parse(md).diagnostics, '`start`')?.line).toBe(lineOf(md, 'start:'))
  })

  it('认不出的时区名是错误', () => {
    const md = doc(day1(event('A', 'time: "09:00"', 'category: sight'))).replace('timezone: UTC', 'timezone: Mars/Olympus')
    expect(find(parse(md).diagnostics, 'Mars/Olympus')).toMatchObject({ severity: 'error', line: lineOf(md, 'timezone') })
  })

  it('坐标必须恰好两个数；度分秒照收', () => {
    const places = (coord: string): string => ['```trip-places', '- name: 甲', `  coord: ${coord}`, '```', ''].join('\n')
    const bad = doc(places('35.1, 135.2 附近 3 号门') + day1(event('A', 'time: "09:00"', 'category: sight')))
    expect(find(parse(bad).diagnostics, '`coord`')).toMatchObject({ severity: 'error', line: lineOf(bad, 'coord') })

    const dms = parse(doc(places(`35°0'36"N 135°46'12"E`) + day1(event('A', 'time: "09:00"', 'category: sight'))))
    expect(dms.trip!.places[0]!.coord).toEqual([135.77, 35.01])
  })
})

describe('arr_day_offset 写了 0 就是当天', () => {
  it('钟点回卷了（到达比中转再出发早），显式 0 不再被推成 +1', () => {
    const trip = parse(doc(journey('{mode: flight, dep_time: "10:15", arr_time: "13:11", arr_day_offset: 0, stops: [{airport: X, arr_time: "13:55", dep_time: "16:05"}]}'))).trip!
    const t = trip.journeys[0]!.transports[0]!
    expect(t.arrDayOffset).toBe(0)
    expect(timelineDates(t, '2026-10-01').arr).toBe('2026-10-01')
  })

  it('没写时仍按钟点回卷', () => {
    const trip = parse(doc(journey('{mode: flight, dep_time: "22:00", arr_time: "06:00"}'))).trip!
    const t = trip.journeys[0]!.transports[0]!
    expect(t.arrDayOffset).toBeNull()
    expect(timelineDates(t, '2026-10-01').arr).toBe('2026-10-02')
  })
})

describe('枚举：全角、大小写、中文名都认，同一套口径', () => {
  it('全角时刻照认（曾经丢了经停日期）', () => {
    const t = parse(doc(journey('{mode: flight, dep_time: "１０：１５"}'))).trip!.journeys[0]!.transports[0]!
    expect(t.depTime).toBe('10:15')
  })

  it('类别 / 标记 / 预订状态 / 交通方式认中文名与各种写法', () => {
    const md = doc(day1(
      event('A', 'time: "09:00"', 'category: 景点', 'flags: Needs Booking', 'booking: {status: 已预订}', 'to_next: {mode: 步行, minutes: 10}'),
      event('B', 'time: "10:00"', 'category: ＳＩＧＨＴ'),
    ))
    const { trip, diagnostics } = parse(md)
    expect(diagnostics).toEqual([])
    const [a, b] = trip!.days[0]!.events
    expect(a).toMatchObject({ category: 'sight', flags: ['needs-booking'], booking: { status: 'booked' } })
    expect(b!.category).toBe('sight')
    expect(trip!.days[0]!.legs[0]!.mode).toBe('walk')
  })

  it('约束 kind 认中文名与大小写（截止、入住、Arrive）', () => {
    const md = doc(['```trip-constraints', '- {kind: 截止, at: 2026-10-01 11:20, label: 甲}', '- {kind: 入住, at: 2026-10-01 15:00, label: 乙}',
      '- {kind: Arrive, at: 2026-10-01 09:00, label: 丙}', '```', ''].join('\n') + day1(event('A', 'time: "09:00"', 'category: sight')))
    expect(parse(md).trip!.constraints.map((c) => c.kind)).toEqual(['deadline', 'checkin', 'arrive'])
  })

  it('visibility 认「公开」；hide 认「出发」', () => {
    expect(parse(doc(day1(event('A', 'time: "09:00"', 'category: sight')), 'visibility: 公开\n')).trip!.visibility).toBe('public')
    const t = parse(doc(journey('{mode: flight, hide: 出发}'))).trip!.journeys[0]!.transports[0]!
    expect(t.hide).toEqual(['from'])
  })
})

describe('字段表：别名、重复、每层子记录都查键', () => {
  it('键和它的别名同时写了要警告，用的是首选键', () => {
    const md = doc(['```trip-transports', '- what: 去程', '  name: 别名', '  transport: {mode: flight}', '```', ''].join('\n') +
      day1(event('出发', 'time: "09:00"', 'category: flight', 'detail: 去程')))
    const { trip, diagnostics } = parse(md)
    expect(trip!.journeys[0]!.what).toBe('去程')
    expect(find(diagnostics, '`what` 与 `name`')).toMatchObject({ severity: 'warning', line: lineOf(md, 'name: 别名') })
  })

  it('中转、开场通勤认驼峰；长途认 item', () => {
    const md = doc(['```trip-transports', '- item: 去程', '  transport: {mode: flight, stops: [{airport: X, arrTime: "10:00", depTime: "11:00"}]}', '```', ''].join('\n') +
      day1(event('出发', 'time: "09:00"', 'category: flight', 'detail: 去程')))
    const { trip, diagnostics } = parse(md)
    expect(diagnostics).toEqual([])
    expect(trip!.journeys[0]!.transports[0]!.stops[0]).toMatchObject({ arrTime: '10:00', depTime: '11:00' })
  })

  it('附录 trip-ref 与名片的 tips 里拼错的键也报', () => {
    const md = doc(day1(event('A', 'time: "09:00"', 'category: sight')) + '## 附录 · 甲\n```trip-ref\nid: a\nicno: x\n```\n正文\n')
    expect(find(parse(md).diagnostics, '`icno`')).toMatchObject({ severity: 'warning', line: lineOf(md, 'icno') })

    const space = '---\nname: 甲\ntips:\n  - {label: 乙, url: "https://example.com", icno: x}\n---\n'
    const w = find(parseSpace(space).diagnostics, '`icno`')
    expect(w).toMatchObject({ severity: 'warning', line: 4 })
    expect(w?.hint).toContain('image')
  })

  it('同一个事件写了两个 trip-event 块是错误，两处行号都报', () => {
    const md = doc(day1(['### A', '```trip-event', 'time: "09:00"', 'category: sight', '```', '```trip-event', 'time: "10:00"', '```', ''].join('\n')))
    const err = find(parse(md).diagnostics, '有两个 `trip-event` 块')
    expect(err?.severity).toBe('error')
    expect(err?.message).toContain(`第 ${lineOf(md, '```trip-event')} 行`)
  })

  it('前置记录没人引用的提醒指到那条记录自己', () => {
    const md = doc(['```trip-stays', '- what: 甲', '  from: 2026-10-01', '  to: 2026-10-02', '- what: 没人引用', '  from: 2026-10-02', '  to: 2026-10-03', '```', ''].join('\n') +
      day1(event('入住', 'time: "18:00"', 'category: hotel', 'detail: 甲')))
    expect(find(parse(md).diagnostics, '「没人引用」')?.line).toBe(lineOf(md, '- what: 没人引用'))
  })
})

describe('结构', () => {
  it('两个 Day 同一天是错误；天号与标题日期对不上是警告；Day 0 是错误', () => {
    const md = doc(`## Day 1 · 2026-10-01\n${event('A', 'time: "09:00"', 'category: sight')}## Day 2 · 2026-10-01\n${event('B', 'time: "09:00"', 'category: sight')}`)
    const ds = parse(md).diagnostics
    expect(find(ds, '与第')).toMatchObject({ severity: 'error', line: lineOf(md, '## Day 2') })
    expect(find(ds, '应是 2026-10-02')?.severity).toBe('warning')

    const zero = doc(`## Day 0 · 2026-10-01\n${event('A', 'time: "09:00"', 'category: sight')}`)
    expect(find(parse(zero).diagnostics, '从 1 开始数')?.severity).toBe('error')
  })

  it('不在任何视图里的正文哪怕一句也提醒', () => {
    const md = doc(`# 标题\n\n一句前言。\n\n${day1(event('A', 'time: "09:00"', 'category: sight'))}`)
    expect(find(parse(md).diagnostics, '不会出现在任何视图里')?.line).toBe(lineOf(md, '# 标题'))
  })

  it('附录 id 撞了往后找空着的后缀，不会再撞', () => {
    const ref = '## 附录 · 甲\n正文\n'
    const ids = parse(doc(day1(event('A', 'time: "09:00"', 'category: sight')) + ref + ref + ref)).trip!.reference.map((r) => r.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids[1]).toBe(`${ids[0]}-2`)
    expect(ids[2]).toBe(`${ids[0]}-3`)
  })

  it('围栏按 CommonMark：缩进 4 格不是围栏；闭合围栏不短于开头；~~~ 里的 ``` 不算', () => {
    const kinds = (md: string): string[] => lex(md).filter((t) => t.kind === 'fence').map((t) => (t.kind === 'fence' ? t.info : ''))
    expect(kinds('    ```trip-event\n    time: 1\n    ```\n')).toEqual([])
    expect(kinds('````md\n```trip-event\n```\n````\n')).toEqual(['md'])
    expect(kinds('~~~\n```trip-event\n~~~\n')).toEqual([''])
    // 缩进的围栏把正文的同等缩进剥掉，YAML 才读得对
    const t = lex('  ```trip-event\n  time: "09:00"\n  ```\n')[0]
    expect(t?.kind === 'fence' && t.content).toBe('time: "09:00"')
  })
})

describe('坐标离群按团判', () => {
  const places = (...rows: [string, string][]): string =>
    ['```trip-places', ...rows.flatMap(([name, coord]) => [`- name: ${name}`, `  coord: ${coord}`]), '```', ''].join('\n')
  const body = day1(event('A', 'time: "09:00"', 'category: sight'))

  it('两座城市各占一半的行程不报（中位数会把整半边报错）', () => {
    // 东京两处 + 檀香山两处：中位数落在东京，檀香山整半边会被报成坐标写错
    const md = doc(places(['东一', '35.68, 139.76'], ['东二', '35.66, 139.70'], ['檀一', '21.28, -157.83'], ['檀二', '21.31, -157.86']) + body)
    expect(parse(md).diagnostics).toEqual([])
  })

  it('改个符号就挨着别人了 → 错误并给改法；怎么改都远 → 只提醒', () => {
    const flipped = doc(places(['甲', '35.68, 139.76'], ['乙', '35.66, 139.70'], ['丙', '35.67, -139.73']) + body)
    const err = find(parse(flipped).diagnostics, '"丙"')
    expect(err).toMatchObject({ severity: 'error', line: lineOf(flipped, '- name: 丙') })
    expect(err!.hint).toContain('经度符号反了')

    // 两个点犯了同样的错：它们互为邻居，只看最近邻会放过；按团判，整团改个符号就落进主体
    const pair = doc(places(['甲', '35.68, 139.76'], ['乙', '35.66, 139.70'], ['丙', '35.70, 139.80'], ['丁', '35.69, -139.75'], ['戊', '35.67, -139.72']) + body)
    const pairDs = parse(pair).diagnostics
    for (const name of ['丁', '戊']) expect(find(pairDs, `"${name}"`), name).toMatchObject({ severity: 'error', line: lineOf(pair, `- name: ${name}`) })
    expect(pairDs).toHaveLength(2)

    const far = doc(places(['甲', '35.68, 139.76'], ['乙', '35.66, 139.70'], ['丙', '64.13, -21.94']) + body)
    const w = find(parse(far).diagnostics, '"丙"')
    expect(w?.severity).toBe('warning')
    expect(w?.hint).toContain('km')
  })
})

describe('D5 · warning 标记已废弃', () => {
  const md = doc(day1(event('A', 'time: "09:00"', 'category: sight', 'flags: [warning, optional]')))

  it('提醒一句并去掉，其余标记照收', () => {
    const { trip, diagnostics } = parse(md)
    expect(trip!.days[0]!.events[0]!.flags).toEqual(['optional'])
    expect(find(diagnostics, '`warning` 标记已废弃')).toMatchObject({ severity: 'warning', line: lineOf(md, 'flags') })
  })

  it('日历导出不再为它加提醒', () => {
    const ics = toIcs(parse(md).trip!)
    expect(ics).not.toContain('VALARM')
    expect(ics).not.toContain('⚠')
  })
})

describe('复审发现：仍会静默的写法', () => {
  it('拼错的键若本该是错误级字段，也是错误（hidden: to 不能让家门口那端发出去；stauts 不能读反）', () => {
    const hidden = doc(journey('{mode: flight, from: A, to: B, hidden: to}'))
    const e = find(parse(hidden).diagnostics, '`hidden`')
    expect(e).toMatchObject({ severity: 'error', line: lineOf(hidden, 'hidden') })
    expect(e?.hint).toContain('`hide`')

    const stauts = doc(day1(event('A', 'time: "09:00"', 'category: sight', 'booking: {stauts: booked}')))
    expect(find(parse(stauts).diagnostics, '`stauts`')?.severity).toBe('error')
    // 显示字段拼错仍只是提醒
    expect(find(parse(doc(day1(event('A', 'time: "09:00"', 'category: sight', 'nots: [甲]')))).diagnostics, '`nots`')?.severity).toBe('warning')
  })

  it('拼错的 trip-* 围栏、写进附录的结构块都要报，不能当成正文吞掉', () => {
    const typo = doc(`## Day 1 · 2026-10-01\n\`\`\`trip-days\ntheme: 甲\n\`\`\`\n${event('A', 'time: "09:00"', 'category: sight')}`)
    const e = find(parse(typo).diagnostics, '`trip-days`')
    expect(e).toMatchObject({ severity: 'error', line: lineOf(typo, '```trip-days') })
    expect(e?.hint).toContain('`trip-day`')

    const inRef = doc(day1(event('A', 'time: "09:00"', 'category: sight')) + '## 附录 · 甲\n```trip-constraints\n- {kind: deadline, at: 2026-10-01 11:00, label: 乙}\n```\n')
    expect(find(parse(inRef).diagnostics, '`trip-constraints` 块写在了附录「甲」里')).toMatchObject({ severity: 'error', line: lineOf(inRef, '```trip-constraints') })
  })

  it('少了一行闭合的代码块吞掉后面的天 —— 报错并指出从哪一行开始、吞到了哪', () => {
    // 这个 ``` 会和 Day 2 那个 trip-event 块的闭合配成一对：形式上闭合了，Day 2 却整个进了代码块
    const md = doc(`${day1(event('A', 'time: "09:00"', 'category: sight') + '正文\n```\n1. 到柜台\n')}## Day 2 · 2026-10-02\n${event('B', 'time: "09:00"', 'category: sight')}`)
    const e = find(parse(md).diagnostics, '吞了进去')
    expect(e).toMatchObject({ severity: 'error', line: lineOf(md, '```\n1. 到柜台') })
    expect(e?.message).toContain(`第 ${md.split('\n').lastIndexOf('```trip-event') + 1} 行的 \`trip-event\``)

    // 一直吞到文件尾
    const tail = doc(`${day1(event('A', 'time: "09:00"', 'category: sight'))}正文\n\`\`\`\n1. 到柜台\n`)
    expect(find(parse(tail).diagnostics, '一直没有闭合')).toMatchObject({ severity: 'error', line: lineOf(tail, '```\n1. 到柜台') })

    // 外层四个反引号里展示 TripMD 示例是正当的嵌套，不报
    const example = doc(day1(event('A', 'time: "09:00"', 'category: sight')) + '## 附录 · 写法\n````md\n```trip-event\ntime: "09:00"\n```\n````\n')
    expect(parse(example).diagnostics).toEqual([])
  })

  it('空坐标不是 [0, 0]', () => {
    for (const coord of ['[~, ~]', `['', '']`, '{lat: "", lng: ""}']) {
      const md = doc(['```trip-places', '- name: 甲', `  coord: ${coord}`, '```', ''].join('\n') + day1(event('A', 'time: "09:00"', 'category: sight')))
      const { diagnostics } = parse(md)
      expect(find(diagnostics, '`coord`')?.severity, coord).toBe('error')
    }
  })

  it('半球字母决定哪个是纬度：「2.3376° E, 48.8606° N」不会被读成索马里', () => {
    const md = doc(['```trip-places', '- name: 甲', '  coord: 2.3376° E, 48.8606° N', '```', ''].join('\n') + day1(event('A', 'time: "09:00"', 'category: sight')))
    expect(parse(md).trip!.places[0]!.coord).toEqual([2.3376, 48.8606])
  })

  it('一个 YAML 错误只报它自己，不连带一串「缺少必需字段」；行号是文件行号', () => {
    const md = doc(day1(event('A', 'time: "09:00"', 'category: sight'))).replace('title: T\n', 'title: T\ntitle: U\n')
    const ds = parse(md).diagnostics.filter((d) => d.severity === 'error')
    expect(ds).toHaveLength(1)
    expect(ds[0]!.line).toBe(md.split('\n').lastIndexOf('title: U') + 1)
    expect(ds[0]!.message).not.toMatch(/at line/)

    const ev = doc(day1(['### A', '```trip-event', 'time: "09:00"', 'time: "10:00"', 'category: sight', '```', ''].join('\n')))
    expect(parse(ev).diagnostics.filter((d) => d.severity === 'error')).toHaveLength(1)
  })

  it('文字字段照作者写的收：0812 不变 812，45.50 不变 45.5', () => {
    const md = doc(
      ['```trip-transports', '- what: 去程', '  transport: {mode: flight, number: 0507, price: 45.50, seat: 012}', '```',
        '```trip-stays', '- what: 旅馆', '  from: 2026-10-01', '  to: 2026-10-02', '  room: 0812', '```', ''].join('\n') +
        day1(event('出发', 'time: "09:00"', 'category: flight', 'detail: 去程'), event('入住', 'time: "18:00"', 'category: hotel', 'detail: 旅馆')),
    )
    const trip = parse(md).trip!
    expect(trip.stays[0]!.room).toBe('0812')
    expect(trip.journeys[0]!.transports[0]).toMatchObject({ number: '0507', price: '45.50', seat: '012' })
  })

  it('标题上写了不存在的日期是错误，不是「没写日期」', () => {
    for (const date of ['2026-10-32', '2026-10-2']) {
      const md = doc(`## Day 1 · ${date}\n${event('A', 'time: "09:00"', 'category: sight')}`)
      const e = find(parse(md).diagnostics, date)
      expect(e?.severity, date).toBe('error')
    }
  })

  it('时区只认 IANA 名（-07:00 进不了日历的 TZID）；大小写规整成规范写法', () => {
    const base = doc(day1(event('A', 'time: "09:00"', 'category: sight')))
    expect(find(parse(base.replace('timezone: UTC', 'timezone: "-07:00"')).diagnostics, '-07:00')?.severity).toBe('error')
    expect(parse(base.replace('timezone: UTC', 'timezone: america/los_angeles')).trip!.timezone).toBe('America/Los_Angeles')
  })

  it('列表里某一项的提醒报在那一项的行；空项（null）算没写', () => {
    const md = doc(day1(event('A', 'time: "09:00"', 'category: sight', 'flags:', '  - optional', '  - warning', 'notes:', '  - 甲', '  - 注意: 乙')))
    const ds = parse(md).diagnostics
    expect(find(ds, '`warning` 标记已废弃')?.line).toBe(lineOf(md, '- warning'))
    expect(find(ds, '读成了键值对')?.line).toBe(lineOf(md, '- 注意: 乙'))

    const nulls = parse(doc(journey('{mode: flight, hide: [from, ~], stops: [~]}')))
    expect(nulls.diagnostics).toEqual([])
    expect(nulls.trip!.journeys[0]!.transports[0]!.hide).toEqual(['from'])
  })

  it('打赏项的 image 读不出来只报一条', () => {
    const space = '---\nname: 甲\ntips:\n  - {label: 乙, image: [x]}\n---\n'
    expect(parseSpace(space).diagnostics).toHaveLength(1)
  })
})
