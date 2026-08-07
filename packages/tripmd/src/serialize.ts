import type { Day, Leg, Place, Transport, Trip, TripEvent } from '@jjj/schema'
import { formatDurationCompact } from './values.ts'

/**
 * Trip → 规范 TripMD。parse() 的逆操作。
 *
 * 这是 hub-and-spoke 架构的另一半：Trip 对象（程序形态）和 TripMD 文本
 * （人/LLM 形态）互为双形态，本函数保证从对象侧回到文本侧。
 *
 * 硬性质（roundtrip.test.ts 锁定）：**语义幂等，非字节一致**
 *
 *     parse(serialize(parse(md)))  深等于  parse(md)
 *
 * 为此的取舍：
 * - `time` / `cost` 回写原文（timeRaw / cost.raw），不重新格式化
 * - 派生量不序列化（day.color、事件 id、leg geometry、place.geo）
 * - 区块按规范顺序重排；作者的注释与自定义排版丢失 —— 规范明言非无损往返
 * - 有坐标就写坐标，无论来源（enrich 补的坐标写回后视为 authored，
 *   否则一次写回就把 geocoding 成果丢了）
 */

// ── YAML 标量 ───────────────────────────────────────────────────

/**
 * 按需加引号。宁可多引不可少引 —— "13:11" 不引会被 YAML 1.1 解析器
 * 读成六十进制 791，布尔/空值形似字符串同理。
 */
function scalar(v: string): string {
  if (v === '') return '""'
  const needsQuote =
    /[:#{}[\],&*!|>'"%@`\\\n]/.test(v) ||
    /^[\s-?]/.test(v) ||
    /\s$/.test(v) ||
    /^(true|false|null|yes|no|on|off|~)$/i.test(v) ||
    /^[\d.+-]/.test(v) // 数字开头（含 "13:11"、"2 件 23kg"）统一引起来最稳
  return needsQuote ? JSON.stringify(v) : v
}

/**
 * 流式 map：{k1: v1, k2: v2}。跳过 undefined/null。
 * 值三种形态：字符串走 scalar() 引号规则；数字原样；{raw} 已渲染好的 YAML 片段
 * （嵌套流式列表用，不能再被引号包一层）。
 */
type FlowVal = string | number | { raw: string } | undefined | null

function flowMap(entries: [string, FlowVal][]): string {
  const parts = entries
    .filter((e): e is [string, string | number | { raw: string }] => e[1] !== undefined && e[1] !== null)
    .map(([k, v]) =>
      typeof v === 'number' ? `${k}: ${v}` : typeof v === 'string' ? `${k}: ${scalar(v)}` : `${k}: ${v.raw}`,
    )
  return `{${parts.join(', ')}}`
}

// ── 各区块 ──────────────────────────────────────────────────────

function frontmatter(trip: Trip): string {
  const L = ['---']
  L.push(`id: ${scalar(trip.id)}`)
  L.push(`title: ${scalar(trip.title)}`)
  if (trip.subtitle) L.push(`subtitle: ${scalar(trip.subtitle)}`)
  L.push(`destination: ${scalar(trip.destination)}`)
  L.push(`timezone: ${scalar(trip.timezone)}`)
  L.push(`start: ${trip.dates.start}`)
  L.push(`end: ${trip.dates.end}`)
  if (trip.travelers !== undefined) L.push(`travelers: ${trip.travelers}`)
  if (trip.currency) L.push(`currency: ${scalar(trip.currency)}`)
  L.push('---')
  return L.join('\n')
}

function constraintsBlock(trip: Trip): string | null {
  if (trip.constraints.length === 0) return null
  const L = ['## 硬约束', '', '```trip-constraints']
  for (const c of trip.constraints) {
    L.push(`- kind: ${c.kind}`)
    L.push(`  at: ${scalar(c.at)}`)
    L.push(`  label: ${scalar(c.label)}`)
    if (c.note) L.push(`  note: ${scalar(c.note)}`)
  }
  L.push('```')
  return L.join('\n')
}

function journeysBlock(trip: Trip): string | null {
  if (trip.journeys.length === 0) return null
  const L = ['## 长途', '', '```trip-transports']
  for (const j of trip.journeys) {
    L.push(`- what: ${scalar(j.what)}`)
    if (j.cost) L.push(`  cost: ${scalar(j.cost.raw)}`)
    if (j.transports.length === 1) {
      L.push(`  transport: ${transportValue(j.transports[0]!)}`)
    } else if (j.transports.length > 1) {
      L.push('  transport:')
      for (const t of j.transports) L.push(`    - ${transportValue(t)}`)
    }
  }
  L.push('```')
  return L.join('\n')
}

function staysBlock(trip: Trip, placeById: Map<string, Place>): string | null {
  if (trip.stays.length === 0) return null
  const L = ['## 住宿', '', '```trip-stays']
  for (const st of trip.stays) {
    L.push(`- what: ${scalar(st.what)}`)
    if (st.platform) L.push(`  platform: ${scalar(st.platform)}`)
    L.push(`  from: ${scalar(st.from.raw)}`)
    L.push(`  to: ${scalar(st.to.raw)}`)
    if (st.cost) L.push(`  cost: ${scalar(st.cost.raw)}`)
    // 地点名与 what 相同时省掉这行 —— 解析器缺省就按 what 去找
    const place = st.placeId ? placeById.get(st.placeId) : undefined
    if (place && place.name !== st.what) L.push(`  place: ${scalar(place.name)}`)
    if (st.stars) L.push(`  stars: ${st.stars}`)
    if (st.room) L.push(`  room: ${scalar(st.room)}`)
    if (st.parking) L.push(`  parking: ${scalar(st.parking)}`)
    if (st.breakfast) L.push(`  breakfast: ${scalar(st.breakfast)}`)
    if (st.refund) L.push(`  refund: ${scalar(st.refund)}`)
    if (st.note) L.push(`  note: ${scalar(st.note)}`)
  }
  L.push('```')
  return L.join('\n')
}

function rentalsBlock(trip: Trip, placeById: Map<string, Place>): string | null {
  if (trip.rentals.length === 0) return null
  const L = ['## 租车', '', '```trip-rentals']
  for (const r of trip.rentals) {
    L.push(`- what: ${scalar(r.what)}`)
    if (r.platform) L.push(`  platform: ${scalar(r.platform)}`)
    L.push(`  from: ${scalar(r.from.raw)}`)
    L.push(`  to: ${scalar(r.to.raw)}`)
    if (r.cost) L.push(`  cost: ${scalar(r.cost.raw)}`)
    const pickup = r.pickupPlaceId ? placeById.get(r.pickupPlaceId) : undefined
    const dropoff = r.dropoffPlaceId ? placeById.get(r.dropoffPlaceId) : undefined
    if (pickup) L.push(`  pickup: ${scalar(pickup.name)}`)
    if (dropoff) L.push(`  dropoff: ${scalar(dropoff.name)}`)
    if (r.mileage) L.push(`  mileage: ${scalar(r.mileage)}`)
    if (r.insurance) L.push(`  insurance: ${scalar(r.insurance)}`)
    if (r.refund) L.push(`  refund: ${scalar(r.refund)}`)
    if (r.note) L.push(`  note: ${scalar(r.note)}`)
  }
  L.push('```')
  return L.join('\n')
}

function placesBlock(trip: Trip): string | null {
  if (trip.places.length === 0) return null
  const L = ['## 地点表', '', '```trip-places']
  for (const p of trip.places) {
    L.push(`- name: ${scalar(p.name)}`)
    if (p.nameEn) L.push(`  en: ${scalar(p.nameEn)}`)
    if (p.coord) L.push(`  coord: ${p.coord[1]}, ${p.coord[0]}`) // 作者格式：纬度在前
    L.push(`  category: ${p.category}`)
    if (p.tentative) L.push(`  tentative: true`)
    if (p.gmapsPlaceId) L.push(`  gmaps_place_id: ${scalar(p.gmapsPlaceId)}`)
    if (p.url) L.push(`  url: ${scalar(p.url)}`)
    if (p.note) L.push(`  note: ${scalar(p.note)}`)
  }
  L.push('```')
  return L.join('\n')
}

function dayBlock(day: Day): string | null {
  const L: string[] = []
  if (day.theme) L.push(`theme: ${scalar(day.theme)}`)
  if (day.sunrise) L.push(`sunrise: ${scalar(day.sunrise)}`)
  if (day.sunset) L.push(`sunset: ${scalar(day.sunset)}`)
  if (L.length === 0) return null
  return ['```trip-day', ...L, '```'].join('\n')
}

function transportValue(t: Transport): string {
  const stops =
    t.stops.length > 0
      ? {
          raw: `[${t.stops
            .map((s) =>
              flowMap([
                ['airport', s.airport],
                ['dep_airport', s.depAirport],
                ['arr_time', s.arrTime],
                ['dep_time', s.depTime],
                ['arr_date', s.arrDate],
                ['dep_date', s.depDate],
                ['leg', s.legMin !== null ? formatDurationCompact(s.legMin) : undefined],
                ['wait', s.waitMin !== null ? formatDurationCompact(s.waitMin) : undefined],
              ]),
            )
            .join(', ')}]`,
        }
      : undefined
  return flowMap([
    ['traveler', t.traveler],
    // mode 总是显式写出 —— 规范形态不留默认值歧义，二次往返字节稳定
    ['mode', t.mode],
    ['carrier', t.carrier],
    ['number', t.number],
    ['from', t.from],
    ['to', t.to],
    ['dep_date', t.depDate],
    ['dep_time', t.depTime],
    ['arr_time', t.arrTime],
    ['arr_date', t.arrDate],
    ['arr_day_offset', t.arrDayOffset !== 0 ? t.arrDayOffset : undefined],
    ['duration', t.durationMin !== null ? formatDurationCompact(t.durationMin) : undefined],
    ['cabin', t.cabin],
    ['baggage', t.baggage],
    ['through_check', t.throughCheck],
    ['refund', t.refund],
    ['price', t.price],
    ['stops', stops],
    ['note', t.note],
  ])
}

function eventBlock(ev: TripEvent, placeById: Map<string, Place>, leg: Leg | undefined): string {
  const L = ['```trip-event']
  L.push(`time: ${scalar(ev.timeRaw)}`)
  L.push(`category: ${ev.category}`)
  const place = ev.placeId ? placeById.get(ev.placeId) : undefined
  if (place) L.push(`place: ${scalar(place.name)}`)
  if (ev.flags.length > 0) L.push(`flags: [${ev.flags.join(', ')}]`)
  if (ev.cost) L.push(`cost: ${scalar(ev.cost.raw)}`)
  if (ev.booking) {
    L.push(
      `booking: ${flowMap([
        ['status', ev.booking.status],
        ['deadline', ev.booking.deadline],
        ['note', ev.booking.note],
      ])}`,
    )
  }
  if (ev.notes.length > 0) {
    L.push('notes:')
    for (const n of ev.notes) L.push(`  - ${scalar(n)}`)
  }
  // 大段事务的明细全部住在前置块里，事件只留一根指针
  if (ev.detailRef) L.push(`detail: ${scalar(ev.detailRef)}`)
  if (leg) {
    const to = leg.to ? placeById.get(leg.to) : undefined
    void to
    L.push(
      `to_next: ${flowMap([
        ['mode', leg.mode],
        ['minutes', leg.durationMin ?? undefined],
        ['km', leg.distanceKm ?? undefined],
        ['label', leg.label],
        ['note', leg.note],
      ])}`,
    )
  }
  L.push('```')
  return L.join('\n')
}

// ── 主入口 ──────────────────────────────────────────────────────

export function serialize(trip: Trip): string {
  const placeById = new Map(trip.places.map((p) => [p.id, p]))
  const chunks: (string | null)[] = []

  chunks.push(frontmatter(trip))
  chunks.push(`# ${trip.title}`)
  chunks.push(constraintsBlock(trip))
  chunks.push(journeysBlock(trip))
  chunks.push(staysBlock(trip, placeById))
  chunks.push(rentalsBlock(trip, placeById))
  chunks.push(placesBlock(trip))

  for (const day of trip.days) {
    const parts: (string | null)[] = [`## Day ${day.index} · ${day.date}`]
    parts.push(dayBlock(day))
    if (day.intro) parts.push(day.intro)

    const legByEvent = new Map(day.legs.map((l) => [l.afterEventId, l]))
    for (const ev of day.events) {
      parts.push(`### ${ev.title}`)
      parts.push(eventBlock(ev, placeById, legByEvent.get(ev.id)))
      const body = [ev.summary, ev.detail].filter(Boolean).join('\n\n')
      if (body) parts.push(body)
      for (const v of ev.variants) {
        parts.push(`#### 变体 · ${v.when}`)
        if (v.body) parts.push(v.body)
      }
    }
    chunks.push(parts.filter(Boolean).join('\n\n'))
  }

  for (const ref of trip.reference) {
    const parts = [
      `## 附录 · ${ref.title}`,
      ['```trip-ref', `id: ${scalar(ref.id)}`, ...(ref.icon ? [`icon: ${scalar(ref.icon)}`] : []), '```'].join('\n'),
    ]
    if (ref.markdown) parts.push(ref.markdown)
    chunks.push(parts.join('\n\n'))
  }

  return chunks.filter(Boolean).join('\n\n') + '\n'
}
