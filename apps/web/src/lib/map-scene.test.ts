import { describe, expect, it } from 'vitest'
import type { Day, Leg, Place, Trip, TripEvent } from '@jjj/schema'
import { decodePolyline } from '@jjj/tripmd'
import {
  cardFocusOffset,
  dashCasing,
  dayPaths,
  FLAG_SIZE,
  pinOffsets,
  PIN_SIZE,
  sceneBounds,
  stopKey,
  startFlagOffset,
  stopNeighbors,
  straightSegments,
} from './map-scene.ts'

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

const day = (index: number, events: TripEvent[], legs: Leg[] = []): Day => ({
  index,
  date: `2026-10-0${index}`,
  weekday: '周四',
  color: `#c${index}`,
  intro: '',
  events,
  legs,
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

/** 把一天的 segments 摊成坐标数组，方便断言 */
const segCoords = (p: { segments: { coords: [number, number][] }[] }) => p.segments.map((s) => s.coords)
/** 同上但只看 real 标记 */
const segReal = (p: { segments: { real: boolean }[] }) => p.segments.map((s) => s.real)

const leg = (afterEventId: string | null, from: string, to: string, geometry: string | null): Leg => ({
  id: `l-${afterEventId}`,
  afterEventId,
  from,
  to,
  mode: 'drive',
  durationMin: null,
  distanceKm: null,
  geometry,
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
    expect(segCoords(p!)).toEqual([[SEA, UW]])
  })

  it('无坐标地点跳过且不断链', () => {
    const t = trip(
      [day(1, [ev('e1', 'a'), ev('e2', 'nc'), ev('e3', 'b'), ev('e4', null)])],
      [place('a', SEA), place('nc', null), place('b', UW)],
    )
    const [p] = dayPaths(t)
    expect(p!.stops.map((s) => s.placeId)).toEqual(['a', 'b'])
    expect(segCoords(p!)).toEqual([[SEA, UW]])
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
    expect(segCoords(p!)).toEqual([[SEA, UW], [UW, SEA]])
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

describe('dayPaths · 开场段（住处 → 第一站）', () => {
  it('住处成为当天第 1 站，其余序号顺延', () => {
    const t = trip(
      [day(1, [ev('e1', 'b')], [leg(null, 'hotel', 'b', null)])],
      [place('hotel', SEA), place('b', UW)],
    )
    const [p] = dayPaths(t)
    expect(p!.stops.map((s) => s.placeId)).toEqual(['hotel', 'b'])
    expect(p!.stops.map((s) => s.seq)).toEqual([1, 2])
    expect(segCoords(p!)).toEqual([[SEA, UW]])
  })

  it('开场站没有事件 —— 它不是一项安排', () => {
    const t = trip(
      [day(1, [ev('e1', 'b')], [leg(null, 'hotel', 'b', null)])],
      [place('hotel', SEA), place('b', UW)],
    )
    const [p] = dayPaths(t)
    expect(p!.stops[0]!.eventIds).toEqual([])
    expect(p!.stops[0]!.origin).toBe('stay')
    expect(p!.stops[1]!.origin).toBe('event')
  })

  it('开场段有几何画实线，端点对不上就退回虚线', () => {
    const poly = '_p~iF~ps|U_ulLnnqC'
    const good = trip(
      [day(1, [ev('e1', 'b')], [leg(null, 'hotel', 'b', poly)])],
      [place('hotel', SEA), place('b', UW)],
    )
    expect(segReal(dayPaths(good)[0]!)).toEqual([true])
    expect(segCoords(dayPaths(good)[0]!)).toEqual([decodePolyline(poly)])

    // 几何算的是到别的地点去的路 —— 端点一比就露馅
    const drifted = trip(
      [day(1, [ev('e1', 'b')], [leg(null, 'hotel', 'elsewhere', poly)])],
      [place('hotel', SEA), place('b', UW)],
    )
    expect(segReal(dayPaths(drifted)[0]!)).toEqual([false])
  })

  it('住处没坐标时不加站，也不断链', () => {
    const t = trip(
      [day(1, [ev('e1', 'a'), ev('e2', 'b')], [leg(null, 'hotel', 'a', null)])],
      [place('hotel', null), place('a', SEA), place('b', UW)],
    )
    const [p] = dayPaths(t)
    expect(p!.stops.map((s) => s.placeId)).toEqual(['a', 'b'])
    expect(segCoords(p!)).toEqual([[SEA, UW]])
  })

  it('开场段与后续 to_next 各走各的几何，互不串门', () => {
    const t = trip(
      [
        day(
          1,
          [ev('e1', 'b'), ev('e2', 'c')],
          [leg(null, 'hotel', 'b', null), leg('e1', 'b', 'c', '_p~iF~ps|U_ulLnnqC')],
        ),
      ],
      [place('hotel', SEA), place('b', UW), place('c', RAINIER)],
    )
    const [p] = dayPaths(t)
    expect(segReal(p!)).toEqual([false, true])
  })
})

describe('pinOffsets', () => {
  /** 同坐标两处：Astra 与它顶层的酒吧 */
  const ASTRA: [number, number] = [-122.3368, 47.6211]

  it('不重合的 pin 不动', () => {
    const paths = dayPaths(
      trip([day(1, [ev('e1', 'a'), ev('e2', 'b')])], [place('a', SEA), place('b', UW)]),
    )
    const off = pinOffsets(paths)
    expect(off.get(stopKey(1, 1))).toEqual([0, 0])
    expect(off.get(stopKey(1, 2))).toEqual([0, 0])
  })

  it('两枚重合 → 上下对开，间距刚好一枚 pin', () => {
    const paths = dayPaths(
      trip(
        [day(1, [ev('e1', 'hotel'), ev('e2', 'b'), ev('e3', 'bar')])],
        [place('hotel', ASTRA), place('b', UW), place('bar', ASTRA)],
      ),
    )
    const off = pinOffsets(paths)
    expect(off.get(stopKey(1, 1))).toEqual([0, -12])
    expect(off.get(stopKey(1, 3))).toEqual([0, 12])
    expect(off.get(stopKey(1, 2))).toEqual([0, 0])
  })

  it('跨天一起聚 —— 选中哪天都不改变位置', () => {
    const paths = dayPaths(
      trip(
        [day(1, [ev('e1', 'hotel')]), day(2, [ev('e2', 'hotel')]), day(3, [ev('e3', 'hotel')])],
        [place('hotel', ASTRA)],
      ),
    )
    const off = pinOffsets(paths)
    // 三枚排在半径 12/sin(60°) ≈ 13.86 的圆上，正上方起顺时针
    expect(off.get(stopKey(1, 1))).toEqual([0, -13.86])
    expect(off.get(stopKey(2, 1))).toEqual([12, 6.93])
    expect(off.get(stopKey(3, 1))).toEqual([-12, 6.93])
  })

  it('容差之内算重合，之外各归各位', () => {
    const near: [number, number] = [ASTRA[0] + 1e-6, ASTRA[1]]
    const far: [number, number] = [ASTRA[0] + 1e-3, ASTRA[1]]
    const paths = dayPaths(
      trip(
        [day(1, [ev('e1', 'a'), ev('e2', 'far'), ev('e3', 'near')])],
        [place('a', ASTRA), place('near', near), place('far', far)],
      ),
    )
    const off = pinOffsets(paths)
    expect(off.get(stopKey(1, 1))).toEqual([0, -12])
    expect(off.get(stopKey(1, 3))).toEqual([0, 12])
    expect(off.get(stopKey(1, 2))).toEqual([0, 0])
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

/** 只含两个点的一小段，够画一条线（解码本身的测试在 tripmd 的 geometry.test.ts） */
const GEOM = '_p~iF~ps|U_ulLnnqC'

describe('dayPaths 的分段', () => {
  const places3 = [place('a', SEA), place('b', UW), place('c', RAINIER)]

  it('没有 leg 时全是兜底直连', () => {
    const [p] = dayPaths(trip([day(1, [ev('e1', 'a'), ev('e2', 'b')])], places3))
    expect(segReal(p!)).toEqual([false])
    expect(segCoords(p!)).toEqual([[SEA, UW]])
  })

  it('leg 带几何且两端对得上 → 这一段是真路', () => {
    const t = trip([day(1, [ev('e1', 'a'), ev('e2', 'b')], [leg('e1', 'a', 'b', GEOM)])], places3)
    const [p] = dayPaths(t)
    expect(segReal(p!)).toEqual([true])
    expect(p!.segments[0]!.coords).toEqual(decodePolyline(GEOM))
  })

  it('leg 端点与两站对不上 → 回退直连，绝不画错的路', () => {
    // leg 通往 c，但下一站是 b：这段几何不是这两站之间的路
    const t = trip([day(1, [ev('e1', 'a'), ev('e2', 'b')], [leg('e1', 'a', 'c', GEOM)])], places3)
    expect(segReal(dayPaths(t)[0]!)).toEqual([false])
  })

  it('中间夹无坐标地点时回退 —— 那条 leg 通往的是被跳过的点', () => {
    const t = trip(
      [day(1, [ev('e1', 'a'), ev('e2', 'nc'), ev('e3', 'b')], [leg('e1', 'a', 'nc', GEOM)])],
      [...places3, place('nc', null)],
    )
    const [p] = dayPaths(t)
    expect(p!.stops.map((s) => s.placeId)).toEqual(['a', 'b'])
    expect(segReal(p!)).toEqual([false])
    expect(segCoords(p!)).toEqual([[SEA, UW]])
  })

  it('几何解不开时回退直连', () => {
    const t = trip(
      [day(1, [ev('e1', 'a'), ev('e2', 'b')], [leg('e1', 'a', 'b', '坏掉的串')])],
      places3,
    )
    expect(segReal(dayPaths(t)[0]!)).toEqual([false])
  })

  it('真路与兜底在同一天里共存', () => {
    const t = trip(
      [day(1, [ev('e1', 'a'), ev('e2', 'b'), ev('e3', 'c')], [leg('e1', 'a', 'b', GEOM)])],
      places3,
    )
    expect(segReal(dayPaths(t)[0]!)).toEqual([true, false])
  })

  it('不足两站时没有段', () => {
    expect(dayPaths(trip([day(1, [ev('e1', 'a')])], places3))[0]!.segments).toEqual([])
  })
})

describe('startFlagOffset', () => {
  it('跟着 1 号 pin 的错位走 —— 水平分量原样保留', () => {
    expect(startFlagOffset([12, -7])[0]).toBe(12)
  })

  it('旗子至少是 pin 的 1.5 倍', () => {
    expect(FLAG_SIZE).toBeGreaterThanOrEqual(PIN_SIZE * 1.5)
  })

  it('旗杆插在 pin 上 —— 两者重叠，中间不留缝', () => {
    // 两者都以中心定位：旗子底边 = -抬升 + 旗高/2，pin 顶边 = -pin 直径/2
    const lift = -startFlagOffset([0, 0])[1]
    expect(-lift + FLAG_SIZE / 2).toBeGreaterThan(-PIN_SIZE / 2)
  })

  it('旗子主体仍在 pin 之上 —— 不能盖住序号', () => {
    const lift = -startFlagOffset([0, 0])[1]
    expect(lift).toBeGreaterThan(PIN_SIZE / 2)
  })

  it('相对错位量向上抬，而不是抬到绝对位置', () => {
    const flat = startFlagOffset([0, 0])[1]
    const moved = startFlagOffset([0, -30])[1]
    expect(moved).toBe(flat - 30)
  })
})

describe('straightSegments', () => {
  const places3 = [place('a', SEA), place('b', UW), place('c', RAINIER)]
  const threeStops = trip(
    [day(1, [ev('e1', 'a'), ev('e2', 'b'), ev('e3', 'c')], [leg('e1', 'a', 'b', GEOM)])],
    places3,
  )

  it('把动线压成站点两点直连 —— 真路的中间顶点全丢掉', () => {
    const [p] = dayPaths(threeStops)
    // 前提：这一天第一段本来是真路，顶点比两站多
    expect(p!.segments[0]!.coords).toEqual(decodePolyline(GEOM))

    expect(straightSegments(p!.stops).map((s) => s.coords)).toEqual([
      [SEA, UW],
      [UW, RAINIER],
    ])
  })

  it('每一段都算估计 —— 这个模式下不再有真假之分', () => {
    const [p] = dayPaths(threeStops)
    expect(straightSegments(p!.stops).map((s) => s.real)).toEqual([false, false])
  })

  it('不足两站时没有线可画', () => {
    const [p] = dayPaths(trip([day(1, [ev('e1', 'a')])], places3))
    expect(straightSegments(p!.stops)).toEqual([])
    expect(straightSegments([])).toEqual([])
  })
})

describe('sceneBounds 与真实路线', () => {
  it('路线绕出站点包络框时，框跟着扩大', () => {
    const t = trip(
      [day(1, [ev('e1', 'a'), ev('e2', 'b')], [leg('e1', 'a', 'b', GEOM)])],
      [place('a', SEA), place('b', UW)],
    )
    const paths = dayPaths(t)
    const withRoute = sceneBounds(paths, 1)!
    const stopsOnly = sceneBounds([{ ...paths[0]!, segments: [] }], 1)!
    // 样例几何落在 (38.5,-120.2)~(40.7,-120.95)：在西雅图的东边、南边
    expect(withRoute[1][0]).toBeGreaterThan(stopsOnly[1][0]) // 东界被推出去
    expect(withRoute[0][1]).toBeLessThan(stopsOnly[0][1]) // 南界被推下去
    expect(withRoute[0][0]).toEqual(stopsOnly[0][0]) // 西界不动 —— 站点仍是最西

  })

  it('单站日仍给零面积框 —— 段为空不等于没有场景', () => {
    const t = trip([day(1, [ev('e1', 'a')])], [place('a', SEA)])
    expect(sceneBounds(dayPaths(t), 1)).toEqual([SEA, SEA])
  })
})

describe('dashCasing', () => {
  it('描边加宽后 dash 按比例缩回，实际像素节奏不变', () => {
    const c = dashCasing(2.5, 2)
    expect(c.width).toBe(4.5)
    // 正线：2.5 × 2 = 5px 一段。描边必须还是 5px 一段，否则白头露在彩线两端
    expect(c.width * c.dasharray[0]).toBeCloseTo(2.5 * 2, 10)
    expect(c.dasharray[0]).toBe(c.dasharray[1])
  })

  it('像素节奏守恒对任何宽度与加宽量都成立', () => {
    for (const [w, d, extra] of [
      [2, 3, 1],
      [4, 2, 2],
      [1.5, 4, 0.5],
    ] as const) {
      const c = dashCasing(w, d, extra)
      expect(c.width).toBe(w + extra)
      expect(c.width * c.dasharray[0]).toBeCloseTo(w * d, 10)
    }
  })

  it('不加宽时原样返回 —— 没有可缩的', () => {
    expect(dashCasing(2.5, 2, 0)).toEqual({ width: 2.5, dasharray: [2, 2] })
  })
})
