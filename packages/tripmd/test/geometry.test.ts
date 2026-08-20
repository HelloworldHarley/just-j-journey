import { describe, expect, it } from 'vitest'
import type { Day, Leg, Place, Trip } from '@jjj/schema'
import { decodePolyline, mergeGeometry, routableLegs, routeKey } from '../src/geometry.ts'

/** Google 官方文档的样例：(38.5,-120.2) (40.7,-120.95) (43.252,-126.453) */
const SAMPLE = '_p~iF~ps|U_ulLnnqC_mqNvxq`@'
/** 只含两个点的一小段，够画一条线 */
const GEOM = '_p~iF~ps|U_ulLnnqC'

describe('decodePolyline', () => {
  it('解出已知样例，且是 [lng, lat] 的 GeoJSON 顺序', () => {
    expect(decodePolyline(SAMPLE)).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ])
  })

  it('空串给空数组', () => {
    expect(decodePolyline('')).toEqual([])
  })

  it('非法字符整条作废，不交出半条路线', () => {
    // 半条路线会在图上画成断在半路的实线，比回退直连更糟 —— 它看起来像是真的
    expect(decodePolyline(SAMPLE + '"')).toEqual([])
    expect(decodePolyline('中文也不行')).toEqual([])
  })

  it('被截断同样整条作废', () => {
    expect(decodePolyline(SAMPLE.slice(0, -1))).toEqual([])
    // 有 lat 没 lng 的半个点对也不行
    expect(decodePolyline('_p~iF')).toEqual([])
  })

  it('精度可调 —— 按 polyline6 解同一串，数值是 1/10', () => {
    expect(decodePolyline(SAMPLE, 6)[0]).toEqual([-12.02, 3.85])
  })
})

// ── 工厂 ────────────────────────────────────────────────────────

const A: [number, number] = [-122.33, 47.6]
const B: [number, number] = [-122.3, 47.65]

const place = (id: string, coord: [number, number] | null): Place => ({
  id,
  name: id,
  coord,
  category: 'sight',
  tentative: false,
  geo: { source: coord ? 'authored' : 'none', confidence: coord ? 'high' : 'unknown' },
})

const leg = (from: string | null, to: string | null, mode: Leg['mode'] = 'drive'): Leg => ({
  id: `l-${from}-${to}`,
  afterEventId: `e-${from}`,
  from,
  to,
  mode,
  durationMin: null,
  distanceKm: null,
  geometry: null,
})

const day = (legs: Leg[]): Day => ({
  index: 1,
  date: '2026-10-01',
  weekday: '周四',
  color: '#000',
  intro: '',
  events: [],
  legs,
})

const trip = (days: Day[], places: Place[]): Trip => ({
  id: 't',
  title: 'T',
  destination: 'X',
  timezone: 'UTC',
  dates: { start: '2026-10-01', end: '2026-10-05' },
  constraints: [],
  journeys: [],
  stays: [],
  rentals: [],
  places,
  days,
  reference: [],
})

const doc = (routes: Record<string, { poly: string; from: [number, number]; to: [number, number] }>) => ({
  version: 1,
  routes,
})

describe('routableLegs', () => {
  const places = [place('a', A), place('b', B), place('nc', null)]

  it('可路由模式 + 两端有坐标才算数', () => {
    const t = trip([day([leg('a', 'b')])], places)
    expect(routableLegs(t).map((n) => n.key)).toEqual(['drive|a|b'])
  })

  it('轨道 / 公交 / 轮渡 / 飞行没有公开线路几何，不算', () => {
    const t = trip([day([leg('a', 'b', 'rail'), leg('a', 'b', 'monorail'), leg('a', 'b', 'flight')])], places)
    expect(routableLegs(t)).toEqual([])
  })

  it('端点缺坐标、缺 placeId、首尾同点都不算', () => {
    const t = trip(
      [day([leg('a', 'nc'), leg('a', null), leg(null, 'b'), leg('a', 'a')])],
      [...places, place('a2', A)],
    )
    expect(routableLegs(t)).toEqual([])
  })

  it('一段 leg 一条 —— 同一对地点在不同天重复出现会重复计数', () => {
    const t = trip([day([leg('a', 'b')]), day([leg('a', 'b')])], places)
    const needs = routableLegs(t)
    expect(needs).toHaveLength(2)
    expect(new Set(needs.map((n) => n.key)).size).toBe(1) // 但键相同，请求前去重
  })

  it('步行与自驾是两条不同的路 —— mode 进键', () => {
    const t = trip([day([leg('a', 'b', 'walk'), leg('a', 'b', 'drive')])], places)
    expect(routableLegs(t).map((n) => n.key)).toEqual(['walk|a|b', 'drive|a|b'])
  })
})

describe('mergeGeometry', () => {
  const places = [place('a', A), place('b', B)]
  const good = doc({ [routeKey('drive', 'a', 'b')]: { poly: GEOM, from: A, to: B } })

  it('端点对得上就填进 leg.geometry', () => {
    const t = trip([day([leg('a', 'b')])], places)
    const r = mergeGeometry(t, good)
    expect(r).toEqual({ needed: 1, used: 1, stale: 0, broken: 0, orphan: 0 })
    expect(t.days[0]!.legs[0]!.geometry).toBe(GEOM)
  })

  it('地点坐标改过之后旧路线失效 —— 绝不让线连着旧位置', () => {
    const t = trip([day([leg('a', 'b')])], [place('a', [-122.4, 47.6]), place('b', B)])
    expect(mergeGeometry(t, good)).toMatchObject({ used: 0, stale: 1 })
    expect(t.days[0]!.legs[0]!.geometry).toBeNull()
  })

  it('容差之内的抖动不算改动（约 1 米）', () => {
    const t = trip([day([leg('a', 'b')])], [place('a', [A[0] + 1e-7, A[1]]), place('b', B)])
    expect(mergeGeometry(t, good)).toMatchObject({ used: 1, stale: 0 })
  })

  it('poly 解不开的整条丢弃', () => {
    const t = trip([day([leg('a', 'b')])], places)
    const bad = doc({ [routeKey('drive', 'a', 'b')]: { poly: '坏掉的串', from: A, to: B } })
    expect(mergeGeometry(t, bad)).toMatchObject({ used: 0, broken: 1 })
    expect(t.days[0]!.legs[0]!.geometry).toBeNull()
  })

  it('没人认领的记录记进 orphan —— 派生文件与 plan.md 脱节的信号', () => {
    const t = trip([day([leg('a', 'b')])], places)
    const extra = doc({
      [routeKey('drive', 'a', 'b')]: { poly: GEOM, from: A, to: B },
      [routeKey('drive', 'a', 'gone')]: { poly: GEOM, from: A, to: B },
    })
    expect(mergeGeometry(t, extra)).toMatchObject({ used: 1, orphan: 1 })
  })

  it('mode 不同的记录不会串用', () => {
    const t = trip([day([leg('a', 'b', 'walk')])], places)
    expect(mergeGeometry(t, good)).toMatchObject({ used: 0, orphan: 1 })
    expect(t.days[0]!.legs[0]!.geometry).toBeNull()
  })

  it('文档整份不可用时返回 null，且一个字节都不改 trip', () => {
    const t = trip([day([leg('a', 'b')])], places)
    for (const raw of [null, undefined, 'nope', {}, { version: 2, routes: {} }, { version: 1, routes: null }]) {
      expect(mergeGeometry(t, raw)).toBeNull()
    }
    expect(t.days[0]!.legs[0]!.geometry).toBeNull()
  })

  it('needed 是分母：轨道段不进，即使文档里有它的记录', () => {
    const t = trip([day([leg('a', 'b'), leg('a', 'b', 'rail')])], places)
    expect(mergeGeometry(t, good)).toMatchObject({ needed: 1, used: 1 })
  })
})
