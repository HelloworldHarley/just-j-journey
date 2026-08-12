import type { Place, Trip } from '@jjj/schema'

/**
 * 地图视图的场景模型 —— 纯函数，零依赖 maplibre，组件只画。
 *
 * 与日历的 calendar-grid / week-axis 同构：投影到「画什么」为止，
 * 「怎么画」（layer/source/marker）全在 MapView 组件里。
 */

export interface DayStop {
  /** 当日序号，从 1 起。pin 上的数字 */
  seq: number
  placeId: string
  name: string
  nameEn?: string
  /** [lng, lat] —— GeoJSON 顺序，与 Place.coord 一致 */
  coord: [number, number]
  /** 这一站对应的事件（同一地点连续出现时合并进来） */
  eventIds: string[]
}

export interface DayPath {
  dayIndex: number
  date: string
  /** 解析器已按 dayColor(index) 算好挂在 Day 上 —— 单一来源，这里只读 */
  color: string
  stops: DayStop[]
  /** 虚线路径顶点，与 stops 一一对应 */
  line: [number, number][]
}

/**
 * 每天按事件顺序取有坐标的地点，串成当天动线。
 *
 * - 无坐标的地点跳过，**不断链**（前后两站直接相连）；
 * - 同一地点**连续**出现（酒店放行李 → 酒店晚餐）合并为一站，eventIds 追加 ——
 *   否则同一坐标叠两枚序号 pin；
 * - **非连续**重复（早上出发、晚上回酒店）保留为新站：折返是真实动线。
 */
export function dayPaths(trip: Trip): DayPath[] {
  const places = new Map(trip.places.map((p) => [p.id, p]))
  return trip.days.map((day) => {
    const stops: DayStop[] = []
    for (const ev of day.events) {
      const place = ev.placeId ? places.get(ev.placeId) : undefined
      if (!place?.coord) continue
      const last = stops[stops.length - 1]
      if (last && last.placeId === place.id) {
        last.eventIds.push(ev.id)
        continue
      }
      stops.push({
        seq: stops.length + 1,
        placeId: place.id,
        name: place.name,
        nameEn: place.nameEn,
        coord: place.coord,
        eventIds: [ev.id],
      })
    }
    return {
      dayIndex: day.index,
      date: day.date,
      color: day.color,
      stops,
      line: stops.map((s) => s.coord),
    }
  })
}

/**
 * fitBounds 的边界框：[[west, south], [east, north]]。
 * dayIndex null = 全程。一个点也没有时返回 null —— 组件据此渲染空态。
 * 单点也返回（零面积框），fitBounds 配 maxZoom 即可正常落点。
 */
export function sceneBounds(
  paths: DayPath[],
  dayIndex: number | null,
): [[number, number], [number, number]] | null {
  const pts = paths
    .filter((p) => dayIndex === null || p.dayIndex === dayIndex)
    .flatMap((p) => p.line)
  if (pts.length === 0) return null
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const [lng, lat] of pts) {
    if (lng < west) west = lng
    if (lng > east) east = lng
    if (lat < south) south = lat
    if (lat > north) north = lat
  }
  return [
    [west, south],
    [east, north],
  ]
}

/**
 * 当天动线上这一站的前后邻居 —— 小卡左右切换 / 手机滑动切换的数据来源。
 *
 * 只在**当天之内**走：序号本身就是当日序号（「第 3 站」），跨天翻页会让这个数字
 * 突然跳回 1，语义断掉。到头就返回 null，由组件把按钮置灰而不是循环 ——
 * 循环会让「还有没有下一站」这件事变得看不出来。
 */
export function stopNeighbors(
  paths: DayPath[],
  dayIndex: number,
  seq: number,
): { prev: DayStop | null; next: DayStop | null } {
  const stops = paths.find((p) => p.dayIndex === dayIndex)?.stops ?? []
  const i = stops.findIndex((s) => s.seq === seq)
  if (i < 0) return { prev: null, next: null }
  return { prev: stops[i - 1] ?? null, next: stops[i + 1] ?? null }
}

/**
 * 点开地点小卡时把该 pin 居中的镜头偏移（像素 `[dx, dy]`，直接喂 maplibre 的 `easeTo.offset`）。
 *
 * 小卡贴着地图底部通栏，所以真正看得见的是「地图高度减掉卡片」那一块 ——
 * 要让 pin 落在这块的中心，就得相对视口中心上移 (卡片高 + 间距) / 2。
 * 只跟卡片高有关，与地图高无关，除非卡片高到会把 pin 顶出画面：
 * 那时收敛到视口高的 30%，宁可稍微偏下也不能让点飞出去。
 */
export function cardFocusOffset(
  mapHeight: number,
  cardHeight: number,
  gap = 8,
): [number, number] {
  if (mapHeight <= 0 || cardHeight <= 0) return [0, 0]
  return [0, -Math.min((cardHeight + gap) / 2, mapHeight * 0.3)]
}

/**
 * 被行程引用（事件 / 住宿 / 租车取还）但没有坐标的地点 ——
 * 地图上的「N 个地点缺坐标」提示条，同时是下一轮 Agent 补数据的工作清单。
 * 未被引用的无坐标地点不算：它们本来就不上地图。
 */
export function missingCoords(trip: Trip): Place[] {
  const referenced = new Set<string>()
  for (const day of trip.days) {
    for (const ev of day.events) if (ev.placeId) referenced.add(ev.placeId)
  }
  for (const s of trip.stays) if (s.placeId) referenced.add(s.placeId)
  for (const r of trip.rentals) {
    if (r.pickupPlaceId) referenced.add(r.pickupPlaceId)
    if (r.dropoffPlaceId) referenced.add(r.dropoffPlaceId)
  }
  return trip.places.filter((p) => p.coord === null && referenced.has(p.id))
}
