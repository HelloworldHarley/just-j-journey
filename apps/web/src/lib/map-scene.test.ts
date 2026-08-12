import { describe, expect, it } from 'vitest'
import type { Day, Place, Trip, TripEvent } from '@jjj/schema'
import { cardFocusOffset, dayPaths, missingCoords, sceneBounds, stopNeighbors } from './map-scene.ts'

const place = (id: string, coord: [number, number] | null): Place => ({
  id,
  name: id,
  coord,
  category: 'sight',
  tentative: false,
  geo: { source: coord ? 'authored' : 'none', confidence: coord ? 'high' : 'unknown' },
})

const ev = (id: string, placeId: string | null): TripEvent => ({
  id,
  title: id,
  category: 'sight',
  startMin: 600,
  endMin: 660,
  timeKind: 'exact',
  timeRaw: '',
  placeId,
  flags: [],
  transports: [],
  summary: '',
  detail: '',
  notes: [],
  variants: [],
})

const day = (index: number, events: TripEvent[]): Day => ({
  index,
  date: `2026-10-0${index}`,
  weekday: '周四',
  color: `#c${index}`,
  intro: '',
  events,
  legs: [],
})

const trip = (days: Day[], places: Place[], over: Partial<Trip> = {}): Trip => ({
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
  ...over,
})

const SEA: [number, number] = [-122.33, 47.6]
const UW: [number, number] = [-122.3, 47.65]
const RAINIER: [number, number] = [-121.7, 46.9]

describe('dayPaths', () => {
  it('按事件顺序取有坐标地点，读 day.color 不重新推导', () => {
    const t = trip(
      [day(1, [ev('e1', 'a'), ev('e2', 'b')])],
      [place('a', SEA), place('b', UW)],
    )
    const [p] = dayPaths(t)
    expect(p!.color).toBe('#c1')
    expect(p!.stops.map((s) => s.placeId)).toEqual(['a', 'b'])
    expect(p!.stops.map((s) => s.seq)).toEqual([1, 2])
    expect(p!.line).toEqual([SEA, UW])
  })

  it('无坐标地点跳过且不断链', () => {
    const t = trip(
      [day(1, [ev('e1', 'a'), ev('e2', 'nc'), ev('e3', 'b'), ev('e4', null)])],
      [place('a', SEA), place('nc', null), place('b', UW)],
    )
    const [p] = dayPaths(t)
    expect(p!.stops.map((s) => s.placeId)).toEqual(['a', 'b'])
    expect(p!.line).toEqual([SEA, UW])
  })

  it('同一地点连续出现合并为一站，eventIds 追加', () => {
    const t = trip(
      [day(1, [ev('e1', 'a'), ev('e2', 'a'), ev('e3', 'b')])],
      [place('a', SEA), place('b', UW)],
    )
    const [p] = dayPaths(t)
    expect(p!.stops).toHaveLength(2)
    expect(p!.stops[0]!.eventIds).toEqual(['e1', 'e2'])
    expect(p!.stops[1]!.seq).toBe(2)
  })

  it('非连续重复（晚上回酒店）保留折返', () => {
    const t = trip(
      [day(1, [ev('e1', 'hotel'), ev('e2', 'b'), ev('e3', 'hotel')])],
      [place('hotel', SEA), place('b', UW)],
    )
    const [p] = dayPaths(t)
    expect(p!.stops.map((s) => s.placeId)).toEqual(['hotel', 'b', 'hotel'])
    expect(p!.line).toEqual([SEA, UW, SEA])
  })

  it('中间夹无坐标地点的同点重复不合并 —— 只合并「连续」', () => {
    // a → (无坐标) → a：动线上确实离开又回来，只是那一站画不出来
    const t = trip(
      [day(1, [ev('e1', 'a'), ev('e2', 'nc'), ev('e3', 'a')])],
      [place('a', SEA), place('nc', null)],
    )
    // 设计取舍：nc 被跳过后 a 与 a 相邻，合并为一站 —— 折返画不出中间点时，
    // 来回两根重叠的线段没有信息量，宁可少画
    const [p] = dayPaths(t)
    expect(p!.stops).toHaveLength(1)
    expect(p!.stops[0]!.eventIds).toEqual(['e1', 'e3'])
  })
})

describe('sceneBounds', () => {
  const paths = dayPaths(
    trip(
      [day(1, [ev('e1', 'a'), ev('e2', 'b')]), day(2, [ev('e3', 'c')])],
      [place('a', SEA), place('b', UW), place('c', RAINIER)],
    ),
  )

  it('全程 = 所有天的包络框', () => {
    expect(sceneBounds(paths, null)).toEqual([
      [-122.33, 46.9],
      [-121.7, 47.65],
    ])
  })

  it('选中某天只框那天', () => {
    expect(sceneBounds(paths, 1)).toEqual([
      [-122.33, 47.6],
      [-122.3, 47.65],
    ])
  })

  it('单点返回零面积框（组件配 maxZoom 落点）', () => {
    expect(sceneBounds(paths, 2)).toEqual([
      [-121.7, 46.9],
      [-121.7, 46.9],
    ])
  })

  it('没有任何点返回 null（空态信号）', () => {
    expect(sceneBounds([], null)).toBeNull()
    expect(sceneBounds(paths, 99)).toBeNull()
  })
})

describe('missingCoords', () => {
  it('被事件引用且无坐标的入列；有坐标或没人引用的不入', () => {
    const t = trip(
      [day(1, [ev('e1', 'a'), ev('e2', 'nc')])],
      [place('a', SEA), place('nc', null), place('orphan', null)],
    )
    expect(missingCoords(t).map((p) => p.id)).toEqual(['nc'])
  })

  it('住宿与租车取还点也算引用', () => {
    const t = trip([day(1, [ev('e1', 'a')])], [place('a', SEA), place('h', null), place('lot', null)], {
      stays: [
        {
          what: 'H',
          placeId: 'h',
          from: { raw: '', date: '2026-10-01', minute: 1080 },
          to: { raw: '', date: '2026-10-02', minute: 600 },
        },
      ],
      rentals: [
        {
          what: 'Car',
          pickupPlaceId: 'lot',
          dropoffPlaceId: null,
          from: { raw: '', date: '2026-10-01', minute: 0 },
          to: { raw: '', date: '2026-10-02', minute: 0 },
        },
      ],
    })
    expect(missingCoords(t).map((p) => p.id).sort()).toEqual(['h', 'lot'])
  })
})

describe('cardFocusOffset', () => {
  it('把 pin 顶到「地图减去小卡」那块的中心', () => {
    // 卡片 140 + 间距 8 → 上移 74，正好让可视区 0..652 的中心落在 pin 上
    expect(cardFocusOffset(800, 140)).toEqual([0, -74])
  })

  it('卡片相对视口过高时收敛，不把 pin 顶出画面', () => {
    // (300 + 8) / 2 = 154 会超过 400 的 30%，收敛到 120
    expect(cardFocusOffset(400, 300)).toEqual([0, -120])
  })

  it('间距可调，且只跟卡片高有关 —— 与地图高无关', () => {
    expect(cardFocusOffset(800, 140, 0)).toEqual([0, -70])
    expect(cardFocusOffset(2000, 140)).toEqual(cardFocusOffset(800, 140))
  })

  it('没有卡片或量不到尺寸时不动镜头', () => {
    expect(cardFocusOffset(800, 0)).toEqual([0, 0])
    expect(cardFocusOffset(0, 140)).toEqual([0, 0])
  })
})

describe('stopNeighbors', () => {
  const paths = dayPaths(
    trip(
      [
        day(1, [ev('e1', 'a'), ev('e2', 'b'), ev('e3', 'c')]),
        day(2, [ev('e4', 'a')]),
      ],
      [place('a', SEA), place('b', UW), place('c', RAINIER)],
    ),
  )

  it('中间一站前后都有', () => {
    const { prev, next } = stopNeighbors(paths, 1, 2)
    expect(prev?.placeId).toBe('a')
    expect(next?.placeId).toBe('c')
  })

  it('首尾各缺一侧 —— 到头返回 null 而不是绕回去', () => {
    expect(stopNeighbors(paths, 1, 1).prev).toBeNull()
    expect(stopNeighbors(paths, 1, 1).next?.placeId).toBe('b')
    expect(stopNeighbors(paths, 1, 3).next).toBeNull()
    expect(stopNeighbors(paths, 1, 3).prev?.placeId).toBe('b')
  })

  it('只有一站的一天两侧都是 null', () => {
    expect(stopNeighbors(paths, 2, 1)).toEqual({ prev: null, next: null })
  })

  it('不跨天：某天的最后一站不会接到下一天的第一站', () => {
    // day1 第 3 站之后是 day2 第 1 站，但序号语义是「当日第几站」，跨天会跳回 1
    expect(stopNeighbors(paths, 1, 3).next).toBeNull()
  })

  it('天或序号不存在时安全返回', () => {
    expect(stopNeighbors(paths, 99, 1)).toEqual({ prev: null, next: null })
    expect(stopNeighbors(paths, 1, 99)).toEqual({ prev: null, next: null })
  })
})
