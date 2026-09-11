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
 * - 长途按**首次引用落在哪一天**判：Day 1 = 抵达（只留到达端）、末日 = 离开（只留出发端）、
 *   中间日 = 行程内部移动（两端全留）；traveler / mode 总是留（多人汇合、画图标）
 * - 住宿 / 租车只抹 cost
 * - 民宿（homestay）坐标模糊到约 1 公里，删 en / note（en 常常就是门牌）
 *
 * **白名单写法**：每个记录都是重新拼出来的，只有显式抄过去的字段能进公开版；
 * schema 以后新增的字段默认被抹（zod parse 还会顺手剥掉 schema 之外的键）。
 */

export type TransportRole = 'arrival' | 'departure' | 'internal' | 'unreferenced'

/** 一条长途在行程里扮演什么 —— firstRefDate 来自 detailIndex（按日期序的首次引用） */
export function transportRole(firstRefDate: string | undefined, dates: Trip['dates']): TransportRole {
  if (firstRefDate === undefined) return 'unreferenced'
  if (firstRefDate <= dates.start) return 'arrival'
  if (firstRefDate >= dates.end) return 'departure'
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
  const journeys = trip.journeys.map((j) => {
    const date = idx.firstRefDate.get(j.what)
    return sanitizeJourney(j, transportRole(date, trip.dates), date)
  })
  // 首次引用的事件上灌着同一份 transports —— serialize 不写它，但内存里的 Trip 不能留真值
  const byWhat = new Map(journeys.map((j) => [j.what, j.transports]))
  const days = trip.days.map((d) => ({
    ...d,
    events: d.events.map((e) =>
      e.detailRef && e.transports.length > 0 && byWhat.has(e.detailRef)
        ? { ...e, transports: byWhat.get(e.detailRef)! }
        : e,
    ),
  }))
  return TripSchema.parse({
    ...trip,
    journeys,
    stays: trip.stays.map(sanitizeStay),
    rentals: trip.rentals.map(sanitizeRental),
    places: trip.places.map(sanitizePlace),
    days,
  })
}
