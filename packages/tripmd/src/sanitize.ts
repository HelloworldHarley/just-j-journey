import {
  DaySchema,
  EventSchema,
  JourneySchema,
  LegSchema,
  PlaceSchema,
  RentalSchema,
  StaySchema,
  TransportSchema,
  TripSchema,
  type Cost,
  type Day,
  type Journey,
  type Leg,
  type Moment,
  type Place,
  type Reference,
  type Rental,
  type Stay,
  type Transport,
  type TransportEnd,
  type Trip,
  type TripEvent,
  type Variant,
} from '@jjj/schema'
import { adjacentLegs, detailIndex, referencedPlaceIds } from './resolve.ts'
import { timelineDates, type TimelineDates } from './transport-dates.ts'
import { parseClock } from './values.ts'

/**
 * 公开版抹除 —— 一张逐字段的策略表，构建期跑一次，纯函数。
 *
 * 每种记录、每个字段都写明进不进公开版：`keep` 原样、`omit` 拿掉、或一个改写函数。
 * 表是 `Policy<T>`：schema 加了字段而这里没写，typecheck 直接失败 —— 新字段默认不会悄悄公开。
 * 拿掉的敏感值（票价、班次、座位、备注、民宿门牌与精确坐标、被藏起来的那一端……）在同一张表里报进黑名单，
 * findLeaks 拿它去扫重新解析出来的公开版：黑名单与抹除规则是同一份，不会再各写各的。
 *
 * 规则（Harley 的裁定）：
 * - **长途两端按作者写的 `hide` 藏**：被藏那端的地点、时刻、日期都不发；没写就两端公开。工具不猜哪端是家 ——
 *   旅伴晚一天到、单程、往返写成一条，猜错的都是家门口的机场
 * - 引用了带 hide 长途的事件卡是作者自己的接驳：正文、注意条目、变体清空，前后两段路的说明也清（同一个开关）
 * - **钱照发**（Harley 2026-10-20）：住宿、租车、行程中间的长途、当场散项都是照着走一遍的人也要花的真实成本；
 *   只有接驳长途（带 hide 的去程、返程）的 cost 与票价不发 —— 从哪出发、买的什么票，每个人都不一样
 * - 民宿那条住宿的备注抹掉（入住说明、门锁密码最常写在那里）
 * - 民宿（homestay）坐标模糊到约 1 公里，英文名 / 备注 / 链接 / 地图 id 全抹（en 常常就是门牌）；
 *   进出民宿的那几段路去掉时长、距离与说明 —— 否则「步行 3 分钟到某咖啡馆」把模糊过的位置又算回来
 * - 没人引用的地点与长途不发：界面永远不画它们，留着只是多一份风险
 * - **预订信息整个不进公开版**：booking 块与 needs-booking 标记是作者的订票进度，不是给读者的攻略
 * - **硬约束整块不进公开版**：从不渲染，写的却正是班次号、确认号这类排期脚手架
 * - 正文（标题、摘要、全文、变体、附录）不抹 —— 那是作者写给读者的话，命中黑名单只提醒
 */

/** sanitize 拿掉的值 —— 公开版里任何地方再出现它就是泄漏 */
export type Secret =
  /**
   * code = 班次号、座位这类编号（复合写法「DL281 · DL167」拆开逐段找）；text = 备注、门牌、被藏的那端地点；
   * money = 票价房费的原文（连同里面的数字一起找）。loose = 自由文本、常与地点同名，命中只提醒
   */
  | { kind: 'code' | 'text' | 'money'; value: string; source: string; loose?: boolean }
  /** 民宿的精确坐标（[lng, lat]），模糊后真的变了才算 */
  | { kind: 'coord'; coord: [number, number]; source: string }

export interface Sanitized {
  trip: Trip
  secrets: Secret[]
}

// ── 策略表的形状 ────────────────────────────────────────────────

interface Ctx {
  /** 这条记录在完整版里的位置，写进 Secret.source，报泄漏时告诉作者值从哪来 */
  where: string
  secrets: Secret[]
}

/** 一个字段怎么进公开版：原样、拿掉、或改写（返回 undefined = 拿掉；拿掉的敏感值自己报进 ctx.secrets） */
type Rule<V, C> = 'keep' | 'omit' | ((value: V, ctx: C, key: string) => V | undefined)

/** 每个字段都得有一条规则 —— 少一个，typecheck 失败（导出只为让测试钉住这一点） */
export type Policy<T, C> = { readonly [K in keyof Required<T>]: Rule<T[K], C> }

function apply<T extends object, C extends Ctx>(record: T, policy: Policy<T, C>, ctx: C): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(policy) as (keyof T & string)[]) {
    const rule = policy[key] as Rule<unknown, C>
    if (rule === 'omit') continue
    const kept = rule === 'keep' ? record[key] : rule(record[key], ctx, key)
    if (kept !== undefined) out[key] = kept
  }
  return out
}

/** 嵌套记录同样逐字段过表 —— 子 schema（费用、变体、时刻……）加了字段也编译不过，不会被整块原样带出去 */
function sub<T extends object, C extends Ctx>(policy: Policy<T, C>) {
  return <V extends T | undefined>(value: V, ctx: C): V => (value === undefined ? value : (apply(value, policy, ctx) as V))
}
function subs<T extends object, C extends Ctx>(policy: Policy<T, C>) {
  return (values: T[], ctx: C): T[] => values.map((v) => apply(v, policy, ctx) as T)
}

const COST: Policy<Cost, Ctx> = { raw: 'keep', amount: 'keep', currency: 'keep', optional: 'keep' }
const MOMENT: Policy<Moment, Ctx> = { raw: 'keep', date: 'keep', minute: 'keep' }
const VARIANT: Policy<Variant, Ctx> = { when: 'keep', body: 'keep' }
const REFERENCE: Policy<Reference, Ctx> = { id: 'keep', icon: 'keep', title: 'keep', markdown: 'keep' }
const DATES: Policy<Trip['dates'], Ctx> = { start: 'keep', end: 'keep' }

/** 拿掉，原文按 kind 进黑名单 */
const secretOf =
  (kind: 'code' | 'text' | 'money') =>
  <C extends Ctx>(value: string | undefined, ctx: C, key: string): undefined => {
    if (value) ctx.secrets.push({ kind, value, source: `${ctx.where} · ${key}` })
    return undefined
  }
const secret = secretOf('text')
const secretCode = secretOf('code')
const secretMoney = secretOf('money')
const secretCost = <C extends Ctx>(cost: Cost | undefined, ctx: C, key: string): undefined =>
  secretMoney(cost?.raw, ctx, key)

/** 约 1 公里：两位小数。民宿的门口不该出现在公开地图上，但「大概在哪片」对读者有用 */
export function blurCoord(c: [number, number]): [number, number] {
  return [Math.round(c[0] * 100) / 100, Math.round(c[1] * 100) / 100]
}

/** 民宿 = 别人的家：位置模糊、能反查到门口的字段全抹。其他类别（酒店 / 景点 / 餐厅）是公开的商业地址 */
export function isPrivatePlace(p: Pick<Place, 'category'>): boolean {
  return p.category === 'homestay'
}

// ── 长途 ────────────────────────────────────────────────────────

interface TransportCtx extends JourneyCtx {
  hide: ReadonlySet<TransportEnd>
  /** 完整版推出来的各节点日期 —— 出发端被藏后「钟点回卷」没了锚点，到达日要写成显式日期 */
  dates: TimelineDates
}

const unlessHidden =
  (end: TransportEnd) =>
  <V>(value: V, ctx: TransportCtx): V | undefined =>
    ctx.hide.has(end) ? undefined : value

const TRANSPORT: Policy<Transport, TransportCtx> = {
  traveler: 'keep',
  mode: 'keep',
  // 被藏那端的地点就是家门口：进黑名单。时刻与日期只是拿掉（「10:10」到处都撞，不当黑名单）
  from: (v, c, k) => (c.hide.has('from') ? secret(v, c, k) : v),
  depTime: unlessHidden('from'),
  // 出发日只在它不是事件那天时写（夜行车、挂在到达日的航班）；否则公开版按事件日推，免得先到后发
  depDate: (_, c) => (c.hide.has('from') || c.dates.dep === c.eventDate ? undefined : c.dates.dep),
  to: (v, c, k) => (c.hide.has('to') ? secret(v, c, k) : v),
  arrTime: unlessHidden('to'),
  arrDate: (_, c) => (c.hide.has('to') ? undefined : c.dates.arr),
  arrDayOffset: 'omit', // 到达日已经写成显式 arr_date
  hide: 'omit', // 公开版里已经没有可藏的了
  carrier: 'omit', // 「达美」这种通用词正文里到处合法出现，不进黑名单
  number: secretCode,
  price: (v, c, k) => (c.connection ? secretMoney(v, c, k) : v), // 接驳长途的票价因人而异，不发
  durationMin: 'omit',
  cabin: 'omit',
  seat: secretCode,
  baggage: 'omit',
  refund: 'omit',
  stops: 'omit',
  legs: (legs, c, k) => {
    legs.forEach((l, i) => {
      secretCode(l.number, c, `${k}[${i}].number`)
      secretCode(l.seat, c, `${k}[${i}].seat`)
    })
    return undefined
  },
  note: secret,
}

interface JourneyCtx extends Ctx {
  eventDate: string | undefined
  /** 带 hide 的长途（去程、返程）：作者自己的接驳，钱不发 */
  connection: boolean
}

const JOURNEY: Policy<Journey, JourneyCtx> = {
  what: 'keep',
  cost: (v, c, k) => (c.connection ? secretCost(v, c, k) : sub(COST)(v, c)),
  transports: (ts, c) =>
    ts.map((t, i) =>
      TransportSchema.parse(
        apply(t, TRANSPORT, {
          ...c,
          where: `${c.where} · 第 ${i + 1} 条交通`,
          hide: new Set(t.hide),
          dates: timelineDates(t, c.eventDate),
        }),
      ),
    ),
}

// ── 住宿 / 租车 / 地点 ─────────────────────────────────────────

interface PrivacyCtx extends Ctx {
  /** 民宿，或指向民宿的记录 */
  private: boolean
}

const privateSecret = <C extends PrivacyCtx>(v: string | undefined, c: C, k: string): string | undefined =>
  c.private ? secret(v, c, k) : v

const STAY: Policy<Stay, PrivacyCtx> = {
  what: 'keep',
  platform: 'keep',
  from: sub(MOMENT),
  to: sub(MOMENT),
  cost: sub(COST),
  refund: 'keep',
  note: privateSecret, // 民宿的入住说明、门锁密码最常写在住宿备注里
  placeId: 'keep',
  stars: 'keep',
  room: 'keep',
  parking: 'keep',
  breakfast: 'keep',
}

const RENTAL: Policy<Rental, Ctx> = {
  what: 'keep',
  platform: 'keep',
  from: sub(MOMENT),
  to: sub(MOMENT),
  cost: sub(COST),
  refund: 'keep',
  note: 'keep',
  mileage: 'keep',
  insurance: 'keep',
  pickupPlaceId: 'keep',
  dropoffPlaceId: 'keep',
}

interface PlaceCtx extends PrivacyCtx {
  name: string
}

const PLACE: Policy<Place, PlaceCtx> = {
  id: 'keep',
  name: 'keep',
  nameEn: privateSecret, // en 常常就是门牌
  coord: (v, c) => {
    if (!c.private || !v) return v
    const blurred = blurCoord(v)
    // 已经只有两位小数的坐标模糊前后相同（比如一份本来就是公开版的行程再过一遍），留着不算泄漏
    if (blurred[0] !== v[0] || blurred[1] !== v[1]) c.secrets.push({ kind: 'coord', coord: v, source: `${c.where} · coord` })
    return blurred
  },
  category: 'keep',
  tentative: 'keep',
  gmapsPlaceId: privateSecret,
  url: privateSecret,
  note: privateSecret, // 怎么找门
  geo: sub<Place['geo'], PlaceCtx>({
    source: 'keep',
    confidence: 'keep',
    query: (q, c) => (c.private ? c.name : q), // 民宿的地理编码查询词常常就是门牌
  }),
}

// ── 每一天 ──────────────────────────────────────────────────────

interface DayCtx extends Ctx {
  day: Day
  /** 带 hide 的长途名：引用它们的事件卡是作者自己的接驳 */
  connections: ReadonlySet<string>
  privatePlaces: ReadonlySet<string>
}

interface EventCtx extends Ctx {
  connection: boolean
}

/** 接驳卡上这些字段整段不发：票面抹了，正文里却原样复述谁几点落地、经哪里回 */
const unlessConnection = <V>(v: V, c: EventCtx): V | undefined => (c.connection ? undefined : v)

const EVENT: Policy<TripEvent, EventCtx> = {
  id: 'keep',
  title: 'keep',
  category: 'keep',
  startMin: 'keep',
  endMin: 'keep',
  timeKind: 'keep',
  timeRaw: 'keep',
  placeId: 'keep',
  flags: (f) => f.filter((x) => x !== 'needs-booking'),
  cost: sub(COST), // 当场散项（门票、停车），不是作者的订单
  booking: (b, c, k) => secret(b?.note, c, `${k}.note`), // 整块不发；备注（取车码之类）进黑名单
  detailRef: 'keep',
  summary: unlessConnection,
  detail: unlessConnection,
  notes: unlessConnection,
  variants: (v, c) => (c.connection ? undefined : subs(VARIANT)(v, c)),
}

interface LegCtx extends PrivacyCtx {
  /** 挨着接驳卡：说明文字（「到达层走到 Link 站」）讲的是作者自己的接驳 */
  quiet: boolean
}

const LEG: Policy<Leg, LegCtx> = {
  id: 'keep',
  afterEventId: 'keep',
  from: 'keep',
  to: 'keep',
  mode: 'keep',
  // 一端是民宿：时长与距离会把模糊过的位置算回来
  durationMin: (v, c) => (c.private ? null : v),
  distanceKm: (v, c) => (c.private ? null : v),
  label: (v, c) => (c.quiet || c.private ? undefined : v),
  note: (v, c) => (c.quiet || c.private ? undefined : v),
  geometry: (v, c) => (c.private ? null : v),
}

const DAY: Policy<Day, DayCtx> = {
  index: 'keep',
  date: 'keep',
  weekday: 'keep',
  theme: 'keep',
  color: 'keep',
  sunrise: 'keep',
  sunset: 'keep',
  intro: 'keep',
  events: (events, c) =>
    events.map((e) =>
      EventSchema.parse(
        apply(e, EVENT, {
          ...c,
          where: `${c.where} ·「${e.title}」`,
          connection: e.detailRef !== undefined && c.connections.has(e.detailRef),
        }),
      ),
    ),
  legs: (legs, c) => {
    // 接驳卡前后两段：进来的接驳在卡前、离开的在卡后，两边都清
    const quiet = new Set<Leg>()
    c.day.events.forEach((e, i) => {
      if (!e.detailRef || !c.connections.has(e.detailRef)) return
      const { incoming, outgoing } = adjacentLegs(c.day, i)
      if (incoming) quiet.add(incoming)
      if (outgoing) quiet.add(outgoing)
    })
    const isPrivate = (id: string | null): boolean => id !== null && c.privatePlaces.has(id)
    return legs.map((l, i) =>
      LegSchema.parse(
        apply(l, LEG, {
          ...c,
          where: `${c.where} · 第 ${i + 1} 段路`,
          quiet: quiet.has(l),
          private: isPrivate(l.from) || isPrivate(l.to),
        }),
      ),
    )
  },
}

// ── 整份行程 ────────────────────────────────────────────────────

interface TripCtx extends Ctx {
  trip: Trip
  privatePlaces: ReadonlySet<string>
  /** 带 hide 的长途名：它们的钱不发，引用它们的事件卡是作者自己的接驳 */
  connections: ReadonlySet<string>
}

const TRIP: Policy<Trip, TripCtx> = {
  id: 'keep',
  title: 'keep',
  subtitle: 'keep',
  destination: 'keep',
  timezone: 'keep',
  dates: sub(DATES),
  travelers: 'keep',
  currency: 'keep',
  visibility: 'keep',
  // 整块不发；label / note 是自由文本，常与地点同名（「派克市场」），所以只按「提醒」级进黑名单
  constraints: (cs, c) => {
    for (const k of cs) {
      for (const value of [k.label, k.note]) {
        if (value) c.secrets.push({ kind: 'text', value, source: `硬约束「${k.label}」`, loose: true })
      }
    }
    return []
  },
  // 没被引用的长途也过一遍表 —— 它的班次、座位照样进黑名单 —— 然后不发
  journeys: (js, c) => {
    const { firstRefDate } = detailIndex(c.trip.days)
    return js.flatMap((j) => {
      const eventDate = firstRefDate.get(j.what)
      const out = JourneySchema.parse(apply(j, JOURNEY, { ...c, where: `长途「${j.what}」`, eventDate, connection: c.connections.has(j.what) }))
      return eventDate === undefined ? [] : [out]
    })
  },
  stays: (ss, c) => {
    // 民宿那条住宿：记录指向民宿，或者入住卡就在民宿（住宿名与地点名写得不一样时 ——「Alice 的公寓」住在「Alice 家」）
    const atPrivatePlace = new Set(
      c.trip.days.flatMap((d) => d.events).flatMap((e) => (e.detailRef && e.placeId && c.privatePlaces.has(e.placeId) ? [e.detailRef] : [])),
    )
    return ss.map((s) => {
      const isPrivate = (s.placeId !== null && c.privatePlaces.has(s.placeId)) || atPrivatePlace.has(s.what)
      return StaySchema.parse(apply(s, STAY, { ...c, where: `住宿「${s.what}」`, private: isPrivate }))
    })
  },
  rentals: (rs, c) => rs.map((r) => RentalSchema.parse(apply(r, RENTAL, { ...c, where: `租车「${r.what}」` }))),
  // 没被引用的地点同样先过表（民宿的门牌照样进黑名单），然后不发
  places: (ps, c) => {
    const referenced = referencedPlaceIds(c.trip)
    return ps.flatMap((p) => {
      const out = PlaceSchema.parse(apply(p, PLACE, { ...c, where: `地点「${p.name}」`, private: isPrivatePlace(p), name: p.name }))
      return referenced.has(p.id) ? [out] : []
    })
  },
  days: (days, c) => days.map((d) => DaySchema.parse(apply(d, DAY, { ...c, where: `Day ${d.index}`, day: d }))),
  reference: subs(REFERENCE),
}

export function sanitize(trip: Trip): Sanitized {
  const secrets: Secret[] = []
  const privatePlaces = new Set(trip.places.filter(isPrivatePlace).map((p) => p.id))
  const connections = new Set(trip.journeys.filter((j) => j.transports.some((t) => t.hide.length > 0)).map((j) => j.what))
  const out = TripSchema.parse(apply(trip, TRIP, { where: '行程', secrets, trip, privatePlaces, connections }))
  return { trip: out, secrets }
}

// ── 提醒：可能忘了写 hide 的地方 ───────────────────────────────

/**
 * 公开版构建时打印、不拦截 —— 家门口那端只有作者知道，这里只把最可能漏写的地方指出来：
 * - 首日或末日首次引用、两端都写了却一端都没藏的长途交通：几乎总是去程或返程。
 *   只写了一端的不算 —— 那一端多半是目的地，或者这本来就是抹过的公开副本（示范行程），再报只是噪音
 * - 接驳卡的时段盖住了被藏那端的时刻（出发卡盖住被藏的出发时刻、到达卡盖住被藏的到达时刻）却挂着地点：
 *   地点照常公开，地图上会把家门口的机场钉出来。按时刻对端，免得每张落在目的地机场的接驳卡都来报一次
 * 已知缺口：旅伴第二天才到的那班不在首末日，不会被提醒。
 */
export function hideReminders(trip: Trip): string[] {
  const { firstRefDate } = detailIndex(trip.days)
  const out: string[] = []
  for (const j of trip.journeys) {
    const date = firstRefDate.get(j.what)
    if (date !== trip.dates.start && date !== trip.dates.end) continue
    j.transports.forEach((t, i) => {
      if (t.hide.length > 0 || !t.from || !t.to) return
      const who = t.traveler ? `（${t.traveler}）` : ''
      const when = date === trip.dates.start ? '首日' : '末日'
      out.push(`长途「${j.what}」第 ${i + 1} 条交通${who}在${when}，两端都会公开 —— 家门口那端写 hide: from 或 hide: to`)
    })
  }
  const places = new Map(trip.places.map((p) => [p.id, p]))
  const journeys = new Map(trip.journeys.map((j) => [j.what, j]))
  for (const day of trip.days) {
    for (const e of day.events) {
      const j = e.detailRef ? journeys.get(e.detailRef) : undefined
      const place = e.placeId ? places.get(e.placeId) : undefined
      if (!j || !place) continue
      const covers = (clock: string | undefined): boolean => {
        const m = clock === undefined ? null : parseClock(clock)
        return m !== null && e.startMin <= m && m <= e.endMin
      }
      const atHiddenEnd = j.transports.some(
        (t) => (t.hide.includes('from') && covers(t.depTime)) || (t.hide.includes('to') && covers(t.arrTime)),
      )
      if (atHiddenEnd) {
        out.push(`Day ${day.index}「${e.title}」落在被藏的那一端，却挂着地点「${place.name}」—— 它会照常出现在公开版和地图上`)
      }
    }
  }
  return out
}
