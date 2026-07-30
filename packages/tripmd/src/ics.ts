import {
  CATEGORIES,
  CONSTRAINTS,
  TRANSPORTS,
  formatMinutes,
  type Day,
  type Place,
  type Trip,
  type TripEvent,
} from '@jjj/schema'

/**
 * RFC 5545 日历导出。
 *
 * 为什么值得做：`LOCATION` 字段一填，Apple Calendar 就会按实时路况推
 * 「该出发了」。对一份主线是「别误了 11:20 还车」的行程，这比任何视图都实用。
 *
 * 而且静态文件就能订阅 —— webcal://host/data/x.ics，日历 App 自己定期拉，
 * 不需要后端。顺带解决了离线：日历 App 会缓存，山里没信号照样看得到今天的安排。
 */

// 用 TextEncoder 而非 Buffer —— Phase 6 这段代码要在 Cloudflare Workers 里跑，
// 那里没有 Node 的 Buffer。TextEncoder 在 Node / 浏览器 / Workers 三处都有。
const enc = new TextEncoder()
const dec = new TextDecoder()

/** 折行：RFC 5545 规定单行不超过 75 字节，续行以单个空格开头。按字节而非字符切。 */
function fold(line: string): string {
  const bytes = enc.encode(line)
  if (bytes.length <= 75) return line

  const out: string[] = []
  let start = 0
  let limit = 75
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length)
    // 不能把一个 UTF-8 多字节序列劈开：0b10xxxxxx 是续字节，往回退
    while (end > start && end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end--
    out.push(dec.decode(bytes.subarray(start, end)))
    start = end
    limit = 74 // 续行前面要加一个空格，可用字节少一个
  }
  return out.join('\r\n ')
}

/** 转义 TEXT 值：反斜杠、分号、逗号、换行。 */
function esc(v: string): string {
  return v
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** "2026-10-01" + 1105 → "20261001T182500"（浮动本地时间，配 TZID） */
function localStamp(date: string, minute: number): string {
  const dayOffset = Math.floor(minute / 1440)
  const m = ((minute % 1440) + 1440) % 1440
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dayOffset)
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '')
  return `${ymd}T${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}00`
}

function dateStamp(date: string, dayOffset = 0): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dayOffset)
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

/**
 * LOCATION 是这份 .ics 的核心价值 —— Apple Calendar 靠它算「该出发了」。
 * 英文名对地图服务命中率更高；有坐标时用 GEO 属性补一道保险。
 */
function locationOf(place: Place | undefined): string | null {
  if (!place) return null
  return place.nameEn ?? place.name
}

interface Line {
  key: string
  value: string
}

function push(lines: string[], key: string, value: string): void {
  lines.push(fold(`${key}:${value}`))
}

export interface IcsOptions {
  /** 提前多少分钟提醒 starred 事件。0 或负数表示不加提醒。 */
  reminderMin?: number
  /** 硬约束提前多少分钟提醒 */
  deadlineReminderMin?: number
  /** 生成时间戳（可注入以保证幂等测试可重现） */
  now?: string
}

export function toIcs(trip: Trip, opts: IcsOptions = {}): string {
  const reminder = opts.reminderMin ?? 30
  const deadlineReminder = opts.deadlineReminderMin ?? 60
  const dtstamp = opts.now ?? new Date().toISOString().replace(/[-:]|\.\d{3}/g, '')
  const places = new Map(trip.places.map((p) => [p.id, p]))
  const tz = trip.timezone

  const L: string[] = []
  L.push('BEGIN:VCALENDAR')
  push(L, 'VERSION', '2.0')
  push(L, 'PRODID', '-//Just J Journey//TripMD v1//EN')
  push(L, 'CALSCALE', 'GREGORIAN')
  push(L, 'METHOD', 'PUBLISH')
  push(L, 'X-WR-CALNAME', esc(trip.title))
  push(L, 'X-WR-TIMEZONE', tz)
  if (trip.subtitle) push(L, 'X-WR-CALDESC', esc(trip.subtitle))
  // 订阅方多久回来拉一次。Apple 会尊重；Google 忽略它，固定 8–24 小时。
  push(L, 'REFRESH-INTERVAL;VALUE=DURATION', 'PT12H')
  push(L, 'X-PUBLISHED-TTL', 'PT12H')

  for (const day of trip.days) {
    for (const ev of day.events) {
      L.push(...eventBlock(trip, day, ev, places, { dtstamp, tz, reminder }))
    }
  }

  for (const [i, c] of trip.constraints.entries()) {
    L.push(...constraintBlock(trip, c, i, { dtstamp, tz, deadlineReminder }))
  }

  L.push('END:VCALENDAR')
  return L.join('\r\n') + '\r\n'
}

function eventBlock(
  trip: Trip,
  day: Day,
  ev: TripEvent,
  places: Map<string, Place>,
  ctx: { dtstamp: string; tz: string; reminder: number },
): string[] {
  const L: string[] = []
  const place = ev.placeId ? places.get(ev.placeId) : undefined
  const cat = CATEGORIES[ev.category]

  L.push('BEGIN:VEVENT')
  push(L, 'UID', `${ev.id}@${trip.id}.jjj`)
  push(L, 'DTSTAMP', ctx.dtstamp)

  if (ev.timeKind === 'allday') {
    push(L, 'DTSTART;VALUE=DATE', dateStamp(day.date))
    push(L, 'DTEND;VALUE=DATE', dateStamp(day.date, 1))
  } else {
    push(L, `DTSTART;TZID=${ctx.tz}`, localStamp(day.date, ev.startMin))
    // 时间点事件（时长 0）给 30 分钟，否则很多日历 App 渲染成看不见的一条线
    const end = ev.endMin > ev.startMin ? ev.endMin : ev.startMin + 30
    push(L, `DTEND;TZID=${ctx.tz}`, localStamp(day.date, end))
  }

  push(L, 'SUMMARY', esc(`${cat.zh === ev.title ? '' : ''}${ev.title}`))
  push(L, 'CATEGORIES', esc(cat.zh))

  const loc = locationOf(place)
  if (loc) {
    push(L, 'LOCATION', esc(loc))
    if (place?.coord) push(L, 'GEO', `${place.coord[1]};${place.coord[0]}`)
  }

  const desc = describeEvent(trip, day, ev, places)
  if (desc) push(L, 'DESCRIPTION', esc(desc))

  // 时间未定的时段事件标为 TENTATIVE，日历里显示为待定
  if (ev.timeKind === 'period' || ev.flags.includes('tentative')) {
    push(L, 'STATUS', 'TENTATIVE')
  } else {
    push(L, 'STATUS', 'CONFIRMED')
  }
  push(L, 'TRANSP', 'OPAQUE')

  // 提醒给「待订」和「注意」类事件。收藏是用户在界面上标的，
  // .ics 是构建期产物读不到，Phase 6 有后端后再按收藏加提醒。
  if (ctx.reminder > 0 && (ev.flags.includes('needs-booking') || ev.flags.includes('warning'))) {
    L.push('BEGIN:VALARM')
    push(L, 'ACTION', 'DISPLAY')
    push(L, 'TRIGGER', `-PT${ctx.reminder}M`)
    push(L, 'DESCRIPTION', esc(ev.title))
    L.push('END:VALARM')
  }

  L.push('END:VEVENT')
  return L
}

/**
 * 描述里塞进日历本身表达不了的东西：怎么走、余量多少、变体是什么。
 * 手机上点开一个日程就能看到全部决策依据，不用再切回网页。
 */
function describeEvent(
  trip: Trip,
  day: Day,
  ev: TripEvent,
  places: Map<string, Place>,
): string {
  const parts: string[] = []

  const marks: string[] = []
  if (ev.flags.includes('warning')) marks.push('⚠ 注意')
  if (ev.flags.includes('tentative')) marks.push('待定')
  if (ev.flags.includes('optional')) marks.push('可选，赶不上可砍')
  if (ev.flags.includes('needs-booking')) marks.push('待预订')
  if (marks.length) parts.push(marks.join(' · '))

  if (ev.timeKind === 'period') parts.push(`时间未定（${ev.timeRaw}）`)
  if (ev.cost) parts.push(`费用：${ev.cost.raw}`)
  if (ev.booking?.note) parts.push(`预订：${ev.booking.note}`)

  if (ev.summary) parts.push(stripMd(ev.summary))
  if (ev.detail) parts.push(stripMd(ev.detail))

  for (const v of ev.variants) {
    parts.push(`【如果${v.when}】${stripMd(v.body)}`)
  }

  const leg = day.legs.find((l) => l.afterEventId === ev.id)
  if (leg) {
    const t = TRANSPORTS[leg.mode]
    const to = leg.to ? places.get(leg.to) : undefined
    const bits = [`→ 下一站：${t.zh}`]
    if (leg.durationMin !== null) bits.push(`${leg.durationMin} 分钟`)
    if (to) bits.push(`到 ${to.name}`)
    if (leg.label) bits.push(`（${leg.label}）`)
    parts.push(bits.join(' '))
  }

  if (day.theme) parts.push(`— Day ${day.index}：${day.theme}`)
  void trip
  return parts.join('\n\n')
}

function constraintBlock(
  trip: Trip,
  c: Trip['constraints'][number],
  index: number,
  ctx: { dtstamp: string; tz: string; deadlineReminder: number },
): string[] {
  const L: string[] = []
  const def = CONSTRAINTS[c.kind]

  L.push('BEGIN:VEVENT')
  push(L, 'UID', `constraint-${index}@${trip.id}.jjj`)
  push(L, 'DTSTAMP', ctx.dtstamp)
  push(L, `DTSTART;TZID=${ctx.tz}`, localStamp(c.date, c.minute))
  push(L, `DTEND;TZID=${ctx.tz}`, localStamp(c.date, c.minute + 15))
  push(L, 'SUMMARY', esc(`⏱ ${c.label}`))
  push(L, 'CATEGORIES', esc(def.zh))
  push(L, 'STATUS', 'CONFIRMED')
  // 硬约束标为 OPAQUE 且置顶优先级 —— 它们是整趟行程唯一不可移动的东西
  push(L, 'PRIORITY', '1')
  if (c.note) push(L, 'DESCRIPTION', esc(`${formatMinutes(c.minute)} ${c.label}\n\n${c.note}`))

  if (ctx.deadlineReminder > 0) {
    L.push('BEGIN:VALARM')
    push(L, 'ACTION', 'DISPLAY')
    push(L, 'TRIGGER', `-PT${ctx.deadlineReminder}M`)
    push(L, 'DESCRIPTION', esc(c.label))
    L.push('END:VALARM')
  }

  L.push('END:VEVENT')
  return L
}

/** 日历 App 不渲染 Markdown，把标记剥掉只留文字。 */
function stripMd(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^\s*[-*+]\s+/gm, '· ')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export type { Line }
