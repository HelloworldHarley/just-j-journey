import {
  JourneySchema,
  PlaceSchema,
  RentalSchema,
  StaySchema,
  TransportSchema,
  TripSchema,
  type Journey,
  type Place,
  type Rental,
  type Stay,
  type Transport,
  type Trip,
} from '@jjj/schema'
import { detailIndex } from './resolve.ts'
import { timelineDates } from './transport-dates.ts'

/**
 * 公开版抹除 —— 构建期跑一次，纯函数：parse → sanitize → serialize → 再 parse 验收。
 *
 * 规则（spec 第一节，已拍板）：
 * - 只抹**前置块**：长途 / 住宿 / 租车；事件卡、正文、附录、事件散项 cost 一字不动
 * - **硬约束整块不进公开版**：它全站没有任何渲染（backlog 里「露出硬约束」还没做），却会原样
 *   躺在公开版 plan.md 里被人 fetch 到，而作者往 label / note 里写的正是班次号、确认号、
 *   倒推链这类排期脚手架 —— 读者一个字都看不到，风险却全在。留着它抹别处就白抹了
 * - 长途按**首次引用落在哪一天**判：最早被引用的那天 = 抵达（只留到达端）、最晚那天 = 离开（只留出发端）、
 *   中间 = 行程内部移动（两端全留）；traveler / mode 总是留（多人汇合、画图标）。
 *   「最早 / 最晚」看的是**各长途首次引用日期的跨度**而不是行程首末日：行程首日在家收拾、末日在家歇着的写法
 *   很常见，按行程首末日判会把去程和返程都当成内部移动，两端全留 —— 家门口的机场就发出去了。
 *   跨度规则是首末日规则的超集：落在 Day 1 的长途必然是最早的
 * - 住宿 / 租车只抹 cost
 * - 民宿（homestay）坐标模糊到约 1 公里，删 en / note（en 常常就是门牌）
 * - **预订信息整个不进公开版**（Harley 2026-09-30 裁决）：每个事件的 booking 块（需预订 / 已预订 / 截止 / 备注）
 *   与 needs-booking 标记（待订）全去掉 —— 那是作者自己的订票进度，不是给读者的攻略；
 *   去在数据这一层，公开版的 plan.md 被人直接下载也看不到，界面也就不必为这些角标再写公开版分支
 * - **抵达 / 离开事件的正文不进公开版**（Harley 2026-09-29 追加）：引用了抵达或离开长途的事件，
 *   其摘要、全文、注意条目、变体、预订块全清 —— 这些卡讲的是作者自己的接驳（谁几点落地、
 *   经哪里回、确认号在哪），票面抹了它们却在正文里原样复述。行程内部移动的事件正文照留
 *
 * **白名单写法**：每个记录都是重新拼出来的，只有显式抄过去的字段能进公开版；
 * schema 以后新增的字段默认被抹（zod parse 还会顺手剥掉 schema 之外的键）。
 */

export type TransportRole = 'arrival' | 'departure' | 'internal' | 'unreferenced'

/**
 * 各**长途**首次引用日期的跨度；没有任何长途被引用时退回行程首末日。
 * 只收长途：住宿、租车也走 `detail:`，出发前一晚在机场旁取车、落地后再住一晚这类引用
 * 会把跨度撑到长途之外，去程就被判成内部移动、出发机场原样发出去
 */
export function referencedSpan(firstRefDate: ReadonlyMap<string, string>, dates: Trip['dates']): Trip['dates'] {
  const days = [...firstRefDate.values()].sort()
  return days.length > 0 ? { start: days[0]!, end: days[days.length - 1]! } : dates
}

/**
 * 一条长途在行程里扮演什么 —— firstRefDate 来自 detailIndex（按日期序的首次引用），
 * span 来自 referencedSpan。跨度只有一天（单日行程、去回都在同一天）时全部按抵达处理：
 * 只留到达端是两种错法里保守的那一种 —— 多抹一个出发机场，好过把回家那班的目的地发出去
 */
export function transportRole(firstRefDate: string | undefined, span: Trip['dates']): TransportRole {
  if (firstRefDate === undefined) return 'unreferenced'
  if (firstRefDate <= span.start) return 'arrival'
  if (firstRefDate >= span.end) return 'departure'
  return 'internal'
}

export function sanitizeTransport(t: Transport, role: TransportRole, eventDate: string | undefined): Transport {
  const keep: Partial<Transport> = { traveler: t.traveler, mode: t.mode }
  if (role === 'arrival' || role === 'internal') {
    keep.to = t.to
    keep.arrTime = t.arrTime
    // 出发端抹掉之后「钟点回卷」没了锚点，arr_day_offset 也失去参照 ——
    // 把完整版派生出来的到达日期落成显式 arr_date，公开版不用再推
    keep.arrDate = timelineDates(t, eventDate).arr
  }
  if (role === 'departure' || role === 'internal') {
    keep.from = t.from
    keep.depTime = t.depTime
    // dep_date 不留（规范：全部抹掉）—— 出发日就是事件所在那天，公开版由此派生
  }
  return TransportSchema.parse(keep)
}

function sanitizeJourney(j: Journey, role: TransportRole, eventDate: string | undefined): Journey {
  return JourneySchema.parse({
    what: j.what,
    transports: j.transports.map((t) => sanitizeTransport(t, role, eventDate)),
  })
}

// 住宿 / 租车也按白名单重拼：规范说「只抹 cost、其余照留」，但「其余」要逐个点名 ——
// 以后 schema 加了新字段，默认是抹掉而不是发出去，想公开得回到这里加一行
function sanitizeStay(s: Stay): Stay {
  return StaySchema.parse({
    what: s.what,
    platform: s.platform,
    from: s.from,
    to: s.to,
    refund: s.refund,
    note: s.note,
    placeId: s.placeId,
    stars: s.stars,
    room: s.room,
    parking: s.parking,
    breakfast: s.breakfast,
  })
}

function sanitizeRental(r: Rental): Rental {
  return RentalSchema.parse({
    what: r.what,
    platform: r.platform,
    from: r.from,
    to: r.to,
    refund: r.refund,
    note: r.note,
    mileage: r.mileage,
    insurance: r.insurance,
    pickupPlaceId: r.pickupPlaceId,
    dropoffPlaceId: r.dropoffPlaceId,
  })
}

/** 约 1 公里：两位小数。民宿的门口不该出现在公开地图上，但「大概在哪片」对读者有用 */
export function blurCoord(c: [number, number]): [number, number] {
  return [Math.round(c[0] * 100) / 100, Math.round(c[1] * 100) / 100]
}

/**
 * 民宿地点按白名单重拼：坐标模糊后，任何能反查到门口的字段都得走 ——
 * en 常常就是门牌、note 写着怎么找门、url 是房源页、gmaps_place_id 直接指到那栋楼。
 * 其他类别（酒店 / 景点 / 餐厅）是公开商业地址，原样。
 */
function sanitizePlace(p: Place): Place {
  if (p.category !== 'homestay') return p
  return PlaceSchema.parse({
    id: p.id,
    name: p.name,
    coord: p.coord ? blurCoord(p.coord) : null,
    category: p.category,
    tentative: p.tentative,
    geo: { ...p.geo, query: p.name },
  })
}

export function sanitize(trip: Trip): Trip {
  const idx = detailIndex(trip.days)
  const journeyRefs = new Map(
    trip.journeys.flatMap((j) => {
      const date = idx.firstRefDate.get(j.what)
      return date === undefined ? [] : [[j.what, date] as const]
    }),
  )
  const span = referencedSpan(journeyRefs, trip.dates)
  const roles = new Map(trip.journeys.map((j) => [j.what, transportRole(idx.firstRefDate.get(j.what), span)]))
  const journeys = trip.journeys.map((j) => sanitizeJourney(j, roles.get(j.what)!, idx.firstRefDate.get(j.what)))
  // 首次引用的事件上灌着同一份 transports —— serialize 不写它，但内存里的 Trip 不能留真值
  const byWhat = new Map(journeys.map((j) => [j.what, j.transports]))
  // 抵达 / 离开卡的正文讲的是作者自己的接驳，票面抹了它却在这里原样复述 —— 整段不进公开版。
  // 挨着这张卡的两段路（进来的与出去的）的 label / note 同理：「到达层走到 Link 站」「还车前加满油」
  // 写在 trip-event / trip-day 围栏里，不属于「正文按设计不抹」的豁免。抵达的接驳在卡后、离开的在卡前，两边都清
  const isEndpoint = (ref: string | undefined): boolean => {
    const role = ref === undefined ? undefined : roles.get(ref)
    return role === 'arrival' || role === 'departure'
  }
  const days = trip.days.map((d) => {
    const endpointEvents = new Set(d.events.filter((e) => isEndpoint(e.detailRef)).map((e) => e.id))
    // 腿按 afterEventId 挂在前一个事件上：出去的那段挂在端点卡自己身上，进来的那段挂在它前一张卡上
    // （端点卡是当天第一张时，进来的就是 afterEventId 为 null 的开场通勤）
    const touching = new Set<string | null>()
    d.events.forEach((e, i) => {
      if (!endpointEvents.has(e.id)) return
      touching.add(e.id)
      touching.add(i === 0 ? null : d.events[i - 1]!.id)
    })
    return {
      ...d,
      events: d.events.map((e) => {
        const out = { ...e, booking: undefined, flags: e.flags.filter((f) => f !== 'needs-booking') }
        if (!e.detailRef || !byWhat.has(e.detailRef)) return out
        if (e.transports.length > 0) out.transports = byWhat.get(e.detailRef)!
        return endpointEvents.has(e.id) ? { ...out, summary: '', detail: '', notes: [], variants: [] } : out
      }),
      legs: d.legs.map((l) => (touching.has(l.afterEventId) ? { ...l, label: undefined, note: undefined } : l)),
    }
  })
  return TripSchema.parse({
    ...trip,
    // 硬约束是作者的排期脚手架，不渲染、却会随 plan.md 发出去 —— 整块不进公开版
    constraints: [],
    journeys,
    stays: trip.stays.map(sanitizeStay),
    rentals: trip.rentals.map(sanitizeRental),
    places: trip.places.map(sanitizePlace),
    days,
  })
}
