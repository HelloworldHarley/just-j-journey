import type { Leg, Trip } from '@jjj/schema'
import { decodePolyline } from '@jjj/tripmd'

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
  /** 这一站对应的事件（同一地点连续出现时合并进来）。开场站没有事件 */
  eventIds: string[]
  /** `stay` = 当天的开场站（昨晚住处），它不对应任何一项安排 */
  origin: 'event' | 'stay'
}

/** 相邻两站之间的一段。真路与兜底直连在图上画法不同，所以分开成段而不是一条整线。 */
export interface DaySegment {
  /** 折线顶点，[lng, lat] */
  coords: [number, number][]
  /** true = 来自预计算的真实路网；false = 两点直连的兜底 */
  real: boolean
}

export interface DayPath {
  dayIndex: number
  date: string
  /** 解析器已按 dayColor(index) 算好挂在 Day 上 —— 单一来源，这里只读 */
  color: string
  stops: DayStop[]
  /** 逐段的动线；stops 少于 2 站时为空 */
  segments: DaySegment[]
}

/**
 * 每天按事件顺序取有坐标的地点，串成当天动线。
 *
 * - **开场站**：`afterEventId === null` 的那条 leg（昨晚住处 → 第一站）
 *   把住处顶成当天第 1 站，其余序号顺延。它没有事件 —— 从酒店出门不是一项安排；
 * - 无坐标的地点跳过，**不断链**（前后两站直接相连）；
 * - 同一地点**连续**出现（酒店放行李 → 酒店晚餐）合并为一站，eventIds 追加 ——
 *   否则同一坐标叠两枚序号 pin；
 * - **非连续**重复（早上出发、晚上回酒店）保留为新站：折返是真实动线。
 *
 * 内部按「站 + 从这一站出发的那条 leg」配对推进，不在成段时回查 ——
 * 开场站根本没有事件 id 可查，回查这条路走不通。
 */
export function dayPaths(trip: Trip): DayPath[] {
  const places = new Map(trip.places.map((p) => [p.id, p]))
  return trip.days.map((day) => {
    const legByAfter = new Map(
      day.legs.flatMap((l) => (l.afterEventId === null ? [] : [[l.afterEventId, l] as const])),
    )
    const nodes: { stop: DayStop; depart: Leg | undefined }[] = []
    const push = (
      place: { id: string; name: string; nameEn?: string; coord: [number, number] },
      origin: DayStop['origin'],
      eventIds: string[],
      depart: Leg | undefined,
    ): void => {
      nodes.push({
        stop: {
          seq: nodes.length + 1,
          placeId: place.id,
          name: place.name,
          nameEn: place.nameEn,
          coord: place.coord,
          eventIds,
          origin,
        },
        depart,
      })
    }

    const opening = day.legs.find((l) => l.afterEventId === null)
    const from = opening?.from ? places.get(opening.from) : undefined
    if (opening && from?.coord) push({ ...from, coord: from.coord }, 'stay', [], opening)

    for (const ev of day.events) {
      const place = ev.placeId ? places.get(ev.placeId) : undefined
      if (!place?.coord) continue
      const last = nodes[nodes.length - 1]
      if (last && last.stop.placeId === place.id) {
        last.stop.eventIds.push(ev.id)
        // 合并站的出发段以**最后**一个事件为准：离开这一站走的是它的 to_next
        last.depart = legByAfter.get(ev.id)
        continue
      }
      push({ ...place, coord: place.coord }, 'event', [ev.id], legByAfter.get(ev.id))
    }

    const segments: DaySegment[] = []
    for (let i = 0; i + 1 < nodes.length; i++) {
      const a = nodes[i]!
      const b = nodes[i + 1]!
      const route = routeOf(a.depart, a.stop, b.stop)
      segments.push({ coords: route ?? [a.stop.coord, b.stop.coord], real: route !== null })
    }

    return {
      dayIndex: day.index,
      date: day.date,
      color: day.color,
      stops: nodes.map((n) => n.stop),
      segments,
    }
  })
}

/**
 * 从这一站出发的那条 leg 上的真实路线，取不到就返回 null（调用方画直连）。
 *
 * 两道闸门缺一不可：leg 的两端 placeId 必须正好是这两站、几何必须能完整解开。
 * 中间夹了无坐标地点时（A → 无坐标 → B），A 那条 leg 通往的是被跳过的那个点
 * 而不是 B —— 端点一比就露馅，于是回退直连。
 */
function routeOf(leg: Leg | undefined, a: DayStop, b: DayStop): [number, number][] | null {
  if (!leg?.geometry) return null
  if (leg.from !== a.placeId || leg.to !== b.placeId) return null
  const coords = decodePolyline(leg.geometry)
  return coords.length >= 2 ? coords : null
}

/**
 * 把一天的动线压成站点之间的直连骨架 —— 地图上「直连」那一档看的东西。
 *
 * 真实路网忠实但绕：跨湖要走桥、单行道要兜圈，站与站的先后关系反而被路况淹没。
 * 这一档把路况整个拿掉，只留顺序和方位。
 *
 * 每段都记成 `real: false`：这个模式下**没有**真假之分，图上再分实虚就是在说谎 ——
 * 哪几段有真路，切回去看。
 */
export function straightSegments(stops: readonly DayStop[]): DaySegment[] {
  const out: DaySegment[] = []
  for (let i = 0; i + 1 < stops.length; i++) {
    out.push({ coords: [stops[i]!.coord, stops[i + 1]!.coord], real: false })
  }
  return out
}

/** pin 的身份：一枚 pin = 某一天的某一站 */
export function stopKey(dayIndex: number, seq: number): string {
  return `${dayIndex}:${seq}`
}

/** pin 直径 22px，留 2px 缝 —— 相邻两枚圆心差这么多就恰好不叠 */
const PIN_GAP = 24

/** pin 直径。与 `index.css` 的 `.map-pin` 同步 —— 那边改了这边要跟 */
export const PIN_SIZE = 22
/** 起点旗的边长：pin 的 1.5 倍。它不是一枚标签，是插在 pin 上的一面旗 */
export const FLAG_SIZE = 33
/** 旗杆插进 pin 的深度：留 0 就成了「叠在上面」，插进去才像插着 */
const FLAG_BITE = 7

/**
 * 起点旗相对它那枚 1 号 pin 的偏移（像素，喂 `marker.setOffset()`）。
 *
 * 传进来的是 1 号 pin 自己的错位量：旗子**跟着 pin 走**，重合簇把 1 号散到哪儿
 * 旗子就跟到哪儿 —— 现有 pin 位置一枚不动，这是前提。
 *
 * 抬升按两者半高之和算，再减去插入深度：旗杆底端于是落在 pin 的圆面里，
 * 中间不留缝，而旗面仍完整地在 pin 之上，不盖住序号。
 */
export function startFlagOffset(base: [number, number]): [number, number] {
  return [base[0], base[1] - (FLAG_SIZE + PIN_SIZE) / 2 + FLAG_BITE]
}
/** 约 1 米。与 geometry.ts 的端点容差同一个数量级：这个距离上分不出两个地点 */
const COORD_EPS = 1e-5

/**
 * 坐标重合的 pin 该往哪儿挪 —— 键是 `stopKey`，值是像素偏移，直接喂 `marker.setOffset()`。
 *
 * 重合是真实存在的（Astra 顶层的酒吧与 Astra 同一个坐标，酒店本身又在多天出现）：
 * 精确叠起来时下面那枚等于不存在，点不到也看不见。
 *
 * - **像素偏移**而不是挪坐标：缩放时错位量恒定，折线仍连真实位置；
 * - **跨天一起聚**，与选中哪天无关 —— 只在当天内散的话，切天时 pin 会挪窝；
 * - n 枚均匀排在半径 `PIN_GAP/2 / sin(π/n)` 的圆上（相邻圆心距恰为 `PIN_GAP`），
 *   正上方起顺时针，顺序按 (天, 序号) 固定。
 */
export function pinOffsets(paths: DayPath[]): Map<string, [number, number]> {
  const clusters = new Map<string, string[]>()
  for (const p of paths) {
    for (const s of p.stops) {
      // 量化到容差格：同格即视为重合。相邻格的边界抖动不值得处理 ——
      // 差一个格的两枚 pin 本来就画在同一个像素上，谁跟谁一组都对
      const k = `${Math.round(s.coord[0] / COORD_EPS)},${Math.round(s.coord[1] / COORD_EPS)}`
      const list = clusters.get(k)
      if (list) list.push(stopKey(p.dayIndex, s.seq))
      else clusters.set(k, [stopKey(p.dayIndex, s.seq)])
    }
  }

  const out = new Map<string, [number, number]>()
  for (const members of clusters.values()) {
    if (members.length === 1) {
      out.set(members[0]!, [0, 0])
      continue
    }
    const r = PIN_GAP / 2 / Math.sin(Math.PI / members.length)
    members.forEach((key, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / members.length
      out.set(key, [px(r * Math.cos(a)), px(r * Math.sin(a))])
    })
  }
  return out
}

/** 像素取到两位小数即可；`|| 0` 顺手把 -0 归成 0 */
function px(v: number): number {
  return Math.round(v * 100) / 100 || 0
}

/**
 * fitBounds 的边界框：[[west, south], [east, north]]。
 * dayIndex null = 全程。一个点也没有时返回 null —— 组件据此渲染空态。
 * 单点也返回（零面积框），fitBounds 配 maxZoom 即可正常落点。
 *
 * 站点和路线顶点都要算：真实路网会绕出站点包络框之外（跨湖绕桥能鼓出好几公里），
 * 只框站点会把路线切掉一截。而只框路线又会漏掉孤零零的单站日。
 */
export function sceneBounds(
  paths: DayPath[],
  dayIndex: number | null,
): [[number, number], [number, number]] | null {
  const pts = paths
    .filter((p) => dayIndex === null || p.dayIndex === dayIndex)
    .flatMap((p) => [...p.stops.map((s) => s.coord), ...p.segments.flatMap((s) => s.coords)])
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
 * 虚线的白色描边该多宽、dash 数组该写多少。
 *
 * maplibre 的 `line-dasharray` **以线宽为单位**，不是像素。描边比正线宽出 `extra`
 * 之后，同一组 dash 数值画出来的实际节奏就变长了 —— 白描边的段落错开彩线，
 * 在彩线两头露出白头。所以 dash 值要按宽度反比缩回去，让 `宽 × dash` 这个像素量守恒。
 */
export function dashCasing(
  width: number,
  dash: number,
  extra = 2,
): { width: number; dasharray: [number, number] } {
  const w = width + extra
  const d = (width * dash) / w
  return { width: w, dasharray: [d, d] }
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
