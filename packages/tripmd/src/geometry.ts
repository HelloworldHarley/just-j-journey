import { TRANSPORTS, type Leg, type Place, type Trip, type TransportMode } from '@jjj/schema'

/**
 * 真实路网几何 —— 全仓唯一的一份「路线该怎么对上行程」。
 *
 * polyline 住在旁路文件 `geometry.json` 里而不是 plan.md：它是机器算出来的派生数据，
 * 塞进 plan.md 会让一份人写的文件涨一倍且全是乱码。代价是派生文件可能与 plan.md 脱节，
 * 所以这里的每条记录都带着**算它时用的起终点坐标**，对不上就整条丢弃 ——
 * 那一段回到直连虚线。**宁可不画，也不画错。**
 *
 * 三处消费同一份规则：`tools/enrich.ts`（该请求哪些段）、`MarkdownTripRepository`
 * （浏览器加载时合并）、`tools/check.ts`（体检有多少条已失效）。
 */

export interface GeometryRecord {
  /** encoded polyline（polyline5） */
  poly: string
  /** 算这条路线时用的起终点 [lng, lat] */
  from: [number, number]
  to: [number, number]
}

export interface GeometryDoc {
  version: 1
  routes: Record<string, GeometryRecord>
}

/**
 * 路线的键。用**内容派生**而不是 leg id：事件 id 里带位置序号
 * （`stableId('d{N}e', '{dayIndex}|{position}')`），某天开头插一个事件就会让后面
 * 所有 id 漂移，几何全体失配。placeId 是名字的 slug，不会漂。
 * 同一对地点走不同方式是两条不同的路，所以 mode 也进键。
 */
export function routeKey(mode: TransportMode, from: string, to: string): string {
  return `${mode}|${from}|${to}`
}

/** 约 1 米。坐标本身只有 4~6 位小数，这个容差足以吸收精度抖动又抓得住真实位移 */
const COORD_EPS = 1e-5

function same(a: [number, number] | undefined, b: [number, number] | null | undefined): boolean {
  if (!a || !b) return false
  return Math.abs(a[0] - b[0]) < COORD_EPS && Math.abs(a[1] - b[1]) < COORD_EPS
}

export interface RouteNeed {
  key: string
  mode: TransportMode
  from: Place
  to: Place
}

/**
 * 值得去算真实路线的那些 leg —— enrich 的工作清单，也是体检的分母。
 *
 * 三种排除都是「算不出来」而不是「懒得算」：`routable: false` 的模式
 * （轨道 / 公交 / 轮渡 / 飞行）没有公开线路几何；端点缺坐标无从算起；
 * 首尾同点没有路可言。**一段 leg 一条**，同一对地点在不同天重复出现会重复计数，
 * 请求前由调用方按 key 去重即可。
 */
export function routableLegs(trip: Trip): RouteNeed[] {
  const byId = new Map(trip.places.map((p) => [p.id, p]))
  const out: RouteNeed[] = []
  for (const day of trip.days) {
    for (const leg of day.legs) {
      if (!leg.from || !leg.to || !TRANSPORTS[leg.mode].routable) continue
      const from = byId.get(leg.from)
      const to = byId.get(leg.to)
      if (!from?.coord || !to?.coord) continue
      if (same(from.coord, to.coord)) continue
      out.push({ key: routeKey(leg.mode, leg.from, leg.to), mode: leg.mode, from, to })
    }
  }
  return out
}

export interface MergeReport {
  /** 值得有真实路线的段数 —— 分母 */
  needed: number
  /** 成功填上的段数 */
  used: number
  /** 端点与当前坐标对不上，已丢弃 */
  stale: number
  /** poly 解不开，已丢弃 */
  broken: number
  /** 文档里没有任何 leg 认领的记录（地点删了 / 行程改了） */
  orphan: number
}

function asGeometryDoc(raw: unknown): GeometryDoc | null {
  const doc = raw as GeometryDoc | null
  return doc && doc.version === 1 && typeof doc.routes === 'object' && doc.routes !== null ? doc : null
}

interface RouteMatch {
  leg: Leg
  key: string
  rec: GeometryRecord
  /** used = 可用；stale = 端点与当前坐标对不上；broken = poly 解不开 */
  status: 'used' | 'stale' | 'broken'
}

/**
 * 逐段 leg 对上文档里的记录并判定可用性 —— 合并（mergeGeometry）与过滤（filterGeometry）
 * 共用这一份判定，两边不会各有一套「什么算对得上」。
 */
function* matchRoutes(trip: Trip, doc: GeometryDoc): Generator<RouteMatch> {
  const byId = new Map(trip.places.map((p) => [p.id, p]))
  for (const day of trip.days) {
    for (const leg of day.legs) {
      if (!leg.from || !leg.to) continue
      const key = routeKey(leg.mode, leg.from, leg.to)
      const rec = doc.routes[key]
      if (!rec?.poly) continue
      // 端点校验：地点坐标改过之后，旧路线连的还是旧位置 —— 让它失效
      const status = !same(rec.from, byId.get(leg.from)?.coord) || !same(rec.to, byId.get(leg.to)?.coord)
        ? 'stale'
        : decodePolyline(rec.poly).length < 2
          ? 'broken'
          : 'used'
      yield { leg, key, rec, status }
    }
  }
}

/**
 * 把 geometry.json 并进 `trip.days[].legs[].geometry`（**就地改**）。
 *
 * 契约：**任何异常都只意味着「这段没有真路」**，绝不抛。整份文档不可用时返回 null，
 * 调用方照常拿着 trip 走 —— 地图画它一直在画的直连虚线。
 */
export function mergeGeometry(trip: Trip, raw: unknown): MergeReport | null {
  const doc = asGeometryDoc(raw)
  if (!doc) return null
  const claimed = new Set<string>()
  const report: MergeReport = { needed: routableLegs(trip).length, used: 0, stale: 0, broken: 0, orphan: 0 }
  for (const m of matchRoutes(trip, doc)) {
    claimed.add(m.key)
    report[m.status]++
    if (m.status === 'used') m.leg.geometry = m.rec.poly
  }
  report.orphan = Object.keys(doc.routes).filter((k) => !claimed.has(k)).length
  return report
}

/**
 * 公开版要带走的那部分 geometry.json：只留这份 trip **真会用上**的记录，其余整条丢掉。
 *
 * 路线的键是地点 id，而地点 id 派生自英文名 —— 民宿的英文名往往就是门牌；记录里还存着算路时的
 * 精确起终点坐标。plan.md 里抹掉、模糊掉的东西，原样拷 geometry.json 就等于从旁路又发了一遍。
 * 拿**抹除并重新解析后**的 trip 来过滤：民宿 id 变了、坐标模糊了，那几段对不上自然被丢掉；
 * 留下的每一条，地图本来就会画。一条都不剩时返回 null，调用方不写文件。
 */
export function filterGeometry(trip: Trip, raw: unknown): GeometryDoc | null {
  const doc = asGeometryDoc(raw)
  if (!doc) return null
  const routes: Record<string, GeometryRecord> = {}
  for (const m of matchRoutes(trip, doc)) if (m.status === 'used') routes[m.key] = m.rec
  return Object.keys(routes).length > 0 ? { version: 1, routes } : null
}

/**
 * 解码 Google encoded polyline（ORS 默认的 polyline5）。返回 **[lng, lat]** 的 GeoJSON 顺序。
 *
 * 契约是「全解开，或者什么都不给」：中途遇到非法字符或被截断就返回空数组，
 * 而不是交出半条路线。半条路线会在图上画成一条断在半路的实线 ——
 * 那比直接回退成直连虚线更糟，因为它看起来像是真的。
 */
export function decodePolyline(encoded: string, precision = 5): [number, number][] {
  const factor = 10 ** precision
  const out: [number, number][] = []
  let lat = 0
  let lng = 0
  let i = 0
  while (i < encoded.length) {
    const dLat = readSigned(encoded, i)
    const dLng = dLat ? readSigned(encoded, dLat.next) : null
    if (!dLat || !dLng) return []
    lat += dLat.value
    lng += dLng.value
    i = dLng.next
    out.push([lng / factor, lat / factor])
  }
  return out
}

/** 读一个 zigzag 变长整数；非法字符、截断、超长都返回 null（由调用方整体作废） */
function readSigned(s: string, from: number): { value: number; next: number } | null {
  let result = 0
  let shift = 0
  let byte = 0
  let i = from
  do {
    if (i >= s.length) return null
    byte = s.charCodeAt(i++) - 63
    if (byte < 0 || byte > 63) return null
    result |= (byte & 0x1f) << shift
    shift += 5
    if (shift > 30) return null
  } while (byte >= 0x20)
  return { value: result & 1 ? ~(result >> 1) : result >> 1, next: i }
}
