import {
  TRANSPORT_ENDS,
  type CategoryKey,
  type Constraint,
  type Place,
  type Transport,
  type Trip,
} from '@jjj/schema'
import { DiagnosticBag, suggest } from './diagnostics.ts'
import {
  clock,
  count,
  dateTime,
  display,
  duration,
  eachRecord,
  integer,
  isoDate,
  latLng,
  listOf,
  nested,
  oneOf,
  readRecord,
  text,
  yesNo,
  type Cursor,
  type Fields,
  type Rec,
  type RecordSpec,
  type Values,
} from './read.ts'
import { parseCost } from './cost.ts'
import type { Fence } from './sections.ts'
import { CATEGORY, CONSTRAINT_KIND, TRANSPORT_END, TRANSPORT_MODE } from './vocab.ts'
import { DEFAULT_MINUTE, placeId as makePlaceId, placeKey } from './values.ts'

/**
 * 前置块的语义解析 —— 地点表 / 硬约束 / 长途 / 住宿 / 长租。
 *
 * 输入是 sections 扫出来的围栏值，输出是 Trip 的对应数组。每种记录一张字段表（read.ts 的 readRecord），
 * 允许的键、别名、读法、报错级别都只写在表里。
 * 除了 places 这张会被事件引用继续长大的表，这里没有跨块状态。
 */

/** 解析期共享的少量上下文 —— 金额换算要用的人数与默认币种 */
export interface ParseCtx {
  bag: DiagnosticBag
  travelers: number
  currency: string | undefined
}

// ── 字段表 ──────────────────────────────────────────────────────

const PLACE = {
  block: 'trip-places',
  fields: {
    name: { read: text, required: '每个地点以 `- name: ...` 开头' },
    // 地点 id 从英文名派生，它读歪了 id 就跟着变 —— 是结构字段，不是显示字段
    en: { read: text, aliases: ['nameEn'] },
    coord: { read: latLng },
    category: { read: oneOf(CATEGORY) },
    tentative: { read: yesNo, level: 'warning' },
    gmaps_place_id: { ...display, aliases: ['gmapsPlaceId'] },
    url: display,
    note: display,
  },
} satisfies RecordSpec<Fields>

const CONSTRAINT = {
  block: 'trip-constraints',
  fields: {
    kind: { read: oneOf(CONSTRAINT_KIND), required: `可选值：${CONSTRAINT_KIND.keys.join(' / ')}` },
    at: { read: dateTime(DEFAULT_MINUTE.other), required: '格式为 `2026-10-05 11:20`' },
    label: { read: text, required: '这条约束叫什么，如 `label: 落地`' },
    note: display,
  },
} satisfies RecordSpec<Fields>

/** 三个前置块的名字字段：事件的 `detail:` 按它引用 */
const WHAT = { read: text, aliases: ['item', 'name'], required: '写成 `- what: 名字`，事件用 `detail: 名字` 引用它' } as const
const WHAT_KEYS = ['what', ...WHAT.aliases]

// 长途换乘段 —— 所有字段都可空：票常常晚于行程定下来，UI 会为缺的字段留「待填」空位
const TRANSPORT = {
  block: 'transport',
  fields: {
    traveler: { ...display, aliases: ['who'] },
    mode: { read: oneOf(TRANSPORT_MODE), level: 'warning', otherwise: '按 flight 处理' },
    carrier: { ...display, aliases: ['airline'] },
    number: { ...display, aliases: ['flight_no', 'flightNo', 'no'] },
    from: { read: text },
    to: { read: text },
    // 写错是错误不是提醒：认不出的值若当没写，这一端就按「两端公开」发出去了 —— 正是作者想藏的那端
    hide: { read: listOf(oneOf(TRANSPORT_END), { split: /[,，]/ }) },
    dep_date: { read: isoDate, aliases: ['depDate'] },
    dep_time: { read: clock, aliases: ['depTime', 'dep'] },
    arr_time: { read: clock, aliases: ['arrTime', 'arr'] },
    arr_date: { read: isoDate, aliases: ['arrDate'] },
    arr_day_offset: { read: integer, aliases: ['arrDayOffset'] },
    price: { ...display, aliases: ['fare'] },
    duration: { read: duration },
    cabin: { ...display, aliases: ['class'] },
    seat: display,
    baggage: display,
    refund: { ...display, aliases: ['change_policy', 'change'] },
    stops: { read: nested },
    legs: { read: nested },
    note: display,
  },
} satisfies RecordSpec<Fields>

const STOP = {
  block: 'stops',
  fields: {
    airport: { read: text, aliases: ['station', 'place'] },
    dep_airport: { read: text, aliases: ['dep_station', 'dep_place', 'depAirport'] },
    arr_time: { read: clock, aliases: ['arr', 'arrTime'] },
    dep_time: { read: clock, aliases: ['dep', 'depTime'] },
    arr_date: { read: isoDate, aliases: ['arrDate'] },
    dep_date: { read: isoDate, aliases: ['depDate'] },
    leg: { read: duration },
    wait: { read: duration },
  },
} satisfies RecordSpec<Fields>

const LEG = {
  block: 'legs',
  fields: {
    number: { ...display, aliases: ['flight_no', 'flightNo', 'no'] },
    cabin: { ...display, aliases: ['class'] },
    seat: display,
  },
} satisfies RecordSpec<Fields>

const JOURNEY = {
  block: 'trip-transports',
  fields: {
    what: WHAT,
    cost: { read: text },
    transport: { read: nested, aliases: ['transports'] },
  },
} satisfies RecordSpec<Fields>

// 住宿与长租是同一种东西：有起止时刻的资产占用。骨架共用一份字段，各自只加自己特有的
function reservationFields(defaultFrom: number, defaultTo: number) {
  const when = '格式为 `2026-10-02 11:30`，只写 `2026-10-02` 则按保底时刻算'
  return {
    what: WHAT,
    platform: { ...display, aliases: ['brand', 'company'] },
    from: { read: dateTime(defaultFrom), required: when },
    to: { read: dateTime(defaultTo), required: when },
    cost: { read: text },
    refund: { ...display, aliases: ['cancellation'] },
    note: display,
  } satisfies Fields
}

const STAY = {
  block: 'trip-stays',
  fields: {
    ...reservationFields(DEFAULT_MINUTE.checkIn, DEFAULT_MINUTE.checkOut),
    place: { read: text },
    stars: { read: count, aliases: ['star'], level: 'warning' },
    room: display,
    parking: display,
    breakfast: display,
  },
} satisfies RecordSpec<Fields>

const RENTAL = {
  block: 'trip-rentals',
  fields: {
    ...reservationFields(DEFAULT_MINUTE.other, DEFAULT_MINUTE.other),
    pickup: { read: text },
    dropoff: { read: text },
    mileage: { ...display, aliases: ['miles'] },
    insurance: display,
  },
} satisfies RecordSpec<Fields>

// ── 读取 ────────────────────────────────────────────────────────

/** 报错里怎么称呼一条记录：有名字用名字，没有就说是第几项 */
function whereOf(noun: string, rec: Rec, keys: readonly string[], index: number): string {
  const name = keys.map((k) => rec[k]).find((v) => typeof v === 'string' || typeof v === 'number')
  return name !== undefined && String(name).trim() ? `${noun}「${String(name).trim()}」` : `${noun}第 ${index + 1} 项`
}

/** 每个前置块都是「- 开头的一串记录」，列表形状校验只写一遍 */
function eachItem(bag: DiagnosticBag, fences: Fence[], block: string, fn: (rec: Rec, at: Cursor, index: number) => void): void {
  for (const fence of fences) {
    if (fence.value === null) continue
    if (!Array.isArray(fence.value)) {
      bag.error(fence.line, `\`${block}\` 必须是一个列表`, '每项以 `- ` 开头')
      continue
    }
    eachRecord(bag, fence, `\`${block}\` `, fn)
  }
}

export function readPlaces(
  bag: DiagnosticBag,
  placeFences: Fence[],
): { places: Map<string, Place>; placeLines: Map<string, number> } {
  const places = new Map<string, Place>()
  const placeLines = new Map<string, number>()

  eachItem(bag, placeFences, 'trip-places', (rec, at, i) => {
    const v = readRecord(bag, at, rec, PLACE, whereOf('地点', rec, ['name'], i))
    if (!v.name) return
    const key = placeKey(v.name)
    const first = placeLines.get(key)
    if (first !== undefined) {
      bag.warn(at.line, `地点「${v.name}」重复声明（第一次在第 ${first} 行），后一条已忽略`)
      return
    }
    const coord = v.coord ?? null
    places.set(key, {
      id: makePlaceId(v.name, v.en),
      name: v.name,
      nameEn: v.en,
      coord,
      category: v.category ?? 'sight',
      tentative: v.tentative ?? false,
      gmapsPlaceId: v.gmaps_place_id,
      url: v.url,
      note: v.note,
      geo: {
        source: coord ? 'authored' : 'none',
        confidence: coord ? 'high' : 'unknown',
        query: v.en ?? v.name,
      },
    })
    placeLines.set(key, at.line)
  })
  return { places, placeLines }
}

export type PlaceResolver = (name: string, line: number, category: CategoryKey) => string

/** 事件引用了未声明的地点 → 自动建档并提醒，而不是报错中断。 */
export function makePlaceResolver(bag: DiagnosticBag, places: Map<string, Place>): PlaceResolver {
  return (name, line, category) => {
    const key = placeKey(name)
    const hit = places.get(key)
    if (hit) return hit.id
    const near = suggest(name, [...places.values()].map((p) => p.name))
    bag.warn(
      line,
      `地点 "${name}" 未在 \`trip-places\` 中声明`,
      near ? `是否指 "${near}"？名称需完全一致` : '将按名称生成地图链接；补进地点表可获得坐标',
    )
    const created: Place = {
      id: makePlaceId(name),
      name,
      coord: null,
      category,
      tentative: false,
      geo: { source: 'none', confidence: 'unknown', query: name },
    }
    places.set(key, created)
    return created.id
  }
}

export function readConstraints(bag: DiagnosticBag, constraintFences: Fence[]): Constraint[] {
  const constraints: Constraint[] = []
  eachItem(bag, constraintFences, 'trip-constraints', (rec, at, i) => {
    const v = readRecord(bag, at, rec, CONSTRAINT, whereOf('约束', rec, ['label'], i))
    if (!v.kind || !v.at || !v.label) return
    constraints.push({ kind: v.kind, at: v.at.raw, date: v.at.date, minute: v.at.minute, label: v.label, note: v.note })
  })
  return constraints
}

function readTransport(bag: DiagnosticBag, at: Cursor, rec: Rec, where: string): Transport {
  const v = readRecord(bag, at, rec, TRANSPORT, where)
  const stops: Transport['stops'] = []
  eachRecord(bag, v.stops, `${where}的 stops `, (r, a, j) => {
    const s = readRecord(bag, a, r, STOP, `${where}第 ${j + 1} 个经停`)
    stops.push({
      airport: s.airport,
      depAirport: s.dep_airport,
      arrTime: s.arr_time,
      depTime: s.dep_time,
      arrDate: s.arr_date,
      depDate: s.dep_date,
      legMin: s.leg ?? null,
      waitMin: s.wait ?? null,
    })
  })
  const legs: Transport['legs'] = []
  eachRecord(bag, v.legs, `${where}的 legs `, (r, a, j) => {
    const l = readRecord(bag, a, r, LEG, `${where}第 ${j + 1} 段`)
    legs.push({ number: l.number, cabin: l.cabin, seat: l.seat })
  })
  // 分段信息与行进段一一对应，对不上就大声说
  if (legs.length > 0 && legs.length !== stops.length + 1) {
    bag.warn(
      v.legs?.cursor.line ?? at.line,
      `${where}：legs 有 ${legs.length} 段，但按 stops 应是 ${stops.length + 1} 段（stops + 1）`,
      '每个行进段一条 legs 记录，顺序与时间轴一致',
    )
  }
  return {
    traveler: v.traveler,
    mode: v.mode ?? 'flight',
    carrier: v.carrier,
    number: v.number,
    from: v.from,
    to: v.to,
    hide: TRANSPORT_ENDS.filter((e) => v.hide?.includes(e)),
    depDate: v.dep_date,
    depTime: v.dep_time,
    arrTime: v.arr_time,
    arrDate: v.arr_date,
    arrDayOffset: v.arr_day_offset ?? null,
    price: v.price,
    durationMin: v.duration ?? null,
    cabin: v.cabin,
    seat: v.seat,
    baggage: v.baggage,
    refund: v.refund,
    stops,
    legs,
    note: v.note,
  }
}

// ── 预订（住宿 / 长租）──
interface ReservationBase {
  what: string
  platform?: string
  from: Trip['rentals'][number]['from']
  to: Trip['rentals'][number]['to']
  cost?: Trip['rentals'][number]['cost']
  refund?: string
  note?: string
}

export interface FrontBlocks {
  journeys: Trip['journeys']
  stays: Trip['stays']
  rentals: Trip['rentals']
  /** detail: 引用的名字空间（what → 声明它的块名），三个前置块共享 */
  detailNames: Map<string, string>
  /** 每条前置记录在文件里的行（what → 行号）—— 「没人引用」的提醒指到它自己 */
  detailLines: Map<string, number>
}

export function readFrontBlocks(
  ctx: ParseCtx,
  fences: { journeyFences: Fence[]; stayFences: Fence[]; rentalFences: Fence[] },
  resolvePlaceRef: PlaceResolver,
): FrontBlocks {
  const { bag } = ctx
  const cost = (raw: string | undefined) =>
    raw ? parseCost(raw, ctx.travelers, ctx.currency) : undefined

  const reservationOf = (
    v: Values<ReturnType<typeof reservationFields>>,
    at: Cursor,
    where: string,
  ): ReservationBase | null => {
    if (!v.what || !v.from || !v.to) return null
    const { from, to } = v
    if (to.date < from.date || (to.date === from.date && to.minute <= from.minute)) {
      bag.error(at.lineOf('to'), `${where}的结束时刻不晚于开始时刻`)
      return null
    }
    return { what: v.what, platform: v.platform, from, to, cost: cost(v.cost), refund: v.refund, note: v.note }
  }

  // 事件 detail: 引用的名字空间 —— 三个前置块共享。
  // 撞名会让引用分不清指谁，所以注册时就报，带着两处行号。
  const detailNames = new Map<string, string>()
  const detailLines = new Map<string, number>()
  const registerDetailName = (what: string, block: string, line: number): boolean => {
    const existing = detailNames.get(what)
    if (existing) {
      bag.error(
        line,
        `「${what}」在 ${existing} 里已经声明过（第 ${detailLines.get(what)} 行）`,
        '事件的 `detail:` 按名字引用，长途/住宿/长租之间名字必须唯一',
      )
      return false
    }
    detailNames.set(what, block)
    detailLines.set(what, line)
    return true
  }

  const journeys: Trip['journeys'] = []
  eachItem(bag, fences.journeyFences, 'trip-transports', (rec, at, i) => {
    const where = whereOf('长途', rec, WHAT_KEYS, i)
    const v = readRecord(bag, at, rec, JOURNEY, where)
    if (!v.what || !registerDetailName(v.what, 'trip-transports', at.line)) return
    const transports: Transport[] = []
    eachRecord(bag, v.transport, `${where}的 transport `, (r, a, j) => {
      transports.push(readTransport(bag, a, r, `${where}第 ${j + 1} 条交通`))
    })
    journeys.push({ what: v.what, cost: cost(v.cost), transports })
  })

  const stays: Trip['stays'] = []
  eachItem(bag, fences.stayFences, 'trip-stays', (rec, at, i) => {
    const where = whereOf('住宿', rec, WHAT_KEYS, i)
    const v = readRecord(bag, at, rec, STAY, where)
    const base = reservationOf(v, at, where)
    if (!base || !registerDetailName(base.what, 'trip-stays', at.line)) return
    stays.push({
      ...base,
      // 酒店名通常就是地点名，省掉 `place:` 这行重复
      placeId: resolvePlaceRef(v.place ?? base.what, at.lineOf('place'), 'hotel'),
      stars: v.stars,
      room: v.room,
      parking: v.parking,
      breakfast: v.breakfast,
    })
  })

  const rentals: Trip['rentals'] = []
  eachItem(bag, fences.rentalFences, 'trip-rentals', (rec, at, i) => {
    const where = whereOf('长租', rec, WHAT_KEYS, i)
    const v = readRecord(bag, at, rec, RENTAL, where)
    const base = reservationOf(v, at, where)
    if (!base || !registerDetailName(base.what, 'trip-rentals', at.line)) return
    rentals.push({
      ...base,
      mileage: v.mileage,
      insurance: v.insurance,
      pickupPlaceId: v.pickup ? resolvePlaceRef(v.pickup, at.lineOf('pickup'), 'logistics') : null,
      dropoffPlaceId: v.dropoff ? resolvePlaceRef(v.dropoff, at.lineOf('dropoff'), 'logistics') : null,
    })
  })

  // 两个块都按开始时刻排 —— 日历的区间带、列表的「住/行」视图都按时间顺序读
  const byStart = (a: ReservationBase, b: ReservationBase): number =>
    a.from.date.localeCompare(b.from.date) || a.from.minute - b.from.minute
  stays.sort(byStart)
  rentals.sort(byStart)

  return { journeys, stays, rentals, detailNames, detailLines }
}
