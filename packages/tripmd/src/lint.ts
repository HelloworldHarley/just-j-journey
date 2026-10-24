import type { Place, Trip } from '@jjj/schema'
import { DiagnosticBag } from './diagnostics.ts'
import type { DayFlow } from './days.ts'
import { legsOf } from './resolve.ts'
import { formatLatLng, placeKey } from './values.ts'

/**
 * 语义 lint —— 在**已建好的结构**上跑的检查，不参与产出 Trip。
 *
 * 这些是 TripMD 的「吵闹诊断」里最值钱的部分：时间倒退、装不下的通勤、
 * 没人引用的预订、飞到别的大洲的坐标 —— 每一条都是作者自己极难看出来、
 * 出了错整天崩盘的东西。规则集中在这里，单独可测、单独可扩。
 */

/** 时间倒退 / 时段重叠 / 通勤余量 —— 排行程最容易犯、最难自己看出来的错。 */
export function lintDayFlow(bag: DiagnosticBag, flows: DayFlow[]): void {
  for (const flow of flows) {
    const { events, legs, toNext } = flow

    // 有 to_next 的相邻事件由下面的余量检查覆盖（报得更准），这里只管没有通勤段的那些：
    // 否则「10:00–12:00」后面跟「11:00–13:00」这种手滑，全链路没有任何地方会吭声。
    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1]
      const cur = events[i]
      if (!prev || !cur) continue
      if (cur.timeKind === 'allday' || prev.timeKind === 'allday') continue
      if (cur.startMin < prev.startMin) {
        bag.warn(
          flow.line,
          `Day ${flow.index}：「${cur.title}」(${cur.timeRaw}) 早于上一个事件「${prev.title}」(${prev.timeRaw})`,
          '事件应按时间先后书写；确实跨午夜的话忽略此条',
        )
      } else if (
        !toNext.has(i - 1) &&
        cur.timeKind !== 'period' &&
        prev.timeKind !== 'period' &&
        cur.startMin < prev.endMin
      ) {
        bag.warn(
          flow.line,
          `Day ${flow.index} 时段重叠：「${prev.title}」(${prev.timeRaw}) 还没结束，` +
            `「${cur.title}」(${cur.timeRaw}) 就开始了`,
          `重叠 ${prev.endMin - cur.startMin} 分钟。改掉其中一个时段，或补上 to_next 说明这段路怎么走`,
        )
      }
    }

    // 余量检查：两个事件之间的空档，装不装得下中间那段路？
    // 这正是原始 MD 逼着人在脑子里算的东西 —— 算错了整天崩盘，而且自己极难看出来。
    // 开场段（住处 → 第一站）没有「上一个事件的结束时刻」可减，余量无从算起，只看事件出发的那些
    const { after } = legsOf({ legs })
    for (const [fromIdx, from] of events.entries()) {
      const leg = after.get(from.id)
      const to = events[fromIdx + 1]
      if (!leg || leg.durationMin === null || !to) continue
      if (from.timeKind === 'period' || to.timeKind === 'period') continue
      const slack = to.startMin - from.endMin - leg.durationMin
      if (slack < 0) {
        bag.warn(
          toNext.get(fromIdx) ?? flow.line,
          `Day ${flow.index} 时间冲突：「${from.title}」${from.timeKind === 'point' ? '' : '结束'}` +
            `到「${to.title}」开始只有 ${to.startMin - from.endMin} 分钟，` +
            `但这段路要 ${leg.durationMin} 分钟`,
          `差 ${-slack} 分钟。把前一个事件提早结束，或把后一个推后`,
        )
      }
    }
  }
}

/**
 * 少了开场那一段路：当天在住处醒来，第一个事件却在别处，也没写 `from_stay`。
 *
 * 这是「静默丢数据」的一种 —— 一天凭空从半路开始，列表和地图都看不出
 * 你是怎么到那儿的。作者自己极难发现，因为缺的东西本来就不在纸上。
 *
 * 该不该有全从 `trip-stays` 推（见 `stayOfMorning`）：落地当天没有住宿区间覆盖，
 * 首个事件就在住处的日子也不需要 —— 例外不用作者手工标，所以这条警告不会误伤。
 */
export function lintDayOpening(bag: DiagnosticBag, flows: DayFlow[]): void {
  for (const flow of flows) {
    const { stay, declared } = flow.opening
    const first = flow.events[0]
    if (declared || !stay || !first) continue
    if (stay.placeId && stay.placeId === first.placeId) continue
    bag.warn(
      flow.line,
      `Day ${flow.index} 在「${stay.what}」醒来，第一个事件却是「${first.title}」—— 中间这段路没有交代`,
      '在 ```trip-day 里加 `from_stay: {mode: walk, minutes: 20}`（起点自动认领当晚住处）',
    )
  }
}

/** 没人引用的前置记录：信息模块不会出现在行程里，大概率是漏了 detail: —— 提醒指到那条记录自己 */
export function lintUnreferenced(
  bag: DiagnosticBag,
  blocks: { journeys: Trip['journeys']; stays: Trip['stays']; rentals: Trip['rentals'] },
  referenced: ReadonlySet<string> | Map<string, unknown>,
  lines: ReadonlyMap<string, number>,
): void {
  for (const list of [blocks.journeys, blocks.stays, blocks.rentals] as const) {
    for (const item of list) {
      if (!referenced.has(item.what)) {
        bag.warn(
          lines.get(item.what) ?? 1,
          `前置记录「${item.what}」没有任何事件用 \`detail:\` 引用`,
          '它的信息模块不会出现在行程里；在对应事件上加 `detail: ' + item.what + '`',
        )
      }
    }
  }
}

/** 一趟旅行里，离最近的地点超过这么多度（纬度或经度，≈1100km）就值得看一眼 */
const OUTLIER_DEG = 10

type Located = Place & { coord: [number, number] }

/** 两点在纬度、经度上差得较多的那一维（度）—— 只用来判「远不远」，不是距离 */
const degreesApart = (a: readonly [number, number], b: readonly [number, number]): number =>
  Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]))

/** 大圆距离（km），只用在提示文字里 */
function kmApart(a: readonly [number, number], b: readonly [number, number]): number {
  const rad = Math.PI / 180
  const dLat = (b[1] - a[1]) * rad
  const dLng = (b[0] - a[0]) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * 坐标离群检测（无需联网）。
 * 西经漏负号会把西雅图画到中国境内，而且完全静默。不做 geocoding 也能抓到它：
 * 地点按「彼此相距不超过 10 度」连成几团，最大的那团是行程的主体，其余每一团试三种常见手误 ——
 * 经度符号、纬度符号、经纬写反：改完整团都落进主体了，那几乎肯定是手误，逐个报错误并给出改法。
 *
 * 按「团」而不是按单个点判：两个点犯了同样的错会互为邻居，只看最近邻就放过了它们；
 * 也不按全体中位数判：两座城市各占一半的行程（东京两处 + 檀香山两处）会被整半边报错。
 * 怎么改都落不进主体的：单独一个点只提醒（可能真是远处的一站），成团的是另一座城市，不报
 */
export function checkCoordOutliers(
  bag: DiagnosticBag,
  places: Place[],
  lines: Map<string, number>,
): void {
  const withCoord = places.filter((p): p is Located => p.coord !== null)
  // 两个点分不出谁错了
  if (withCoord.length < 3) return

  const near = (a: readonly [number, number], b: readonly [number, number]): boolean => degreesApart(a, b) <= OUTLIER_DEG

  // 单链接聚团：挨着的点归同一团
  const groups: Located[][] = []
  const seen = new Set<Located>()
  for (const start of withCoord) {
    if (seen.has(start)) continue
    const group = [start]
    seen.add(start)
    for (let i = 0; i < group.length; i++) {
      for (const other of withCoord) {
        if (!seen.has(other) && near(group[i]!.coord, other.coord)) {
          seen.add(other)
          group.push(other)
        }
      }
    }
    groups.push(group)
  }
  const main = groups.reduce((a, b) => (b.length > a.length ? b : a))

  const fixes: { apply: (c: [number, number]) => [number, number]; hint: (c: [number, number]) => string }[] = [
    { apply: ([lng, lat]) => [-lng, lat], hint: ([lng]) => `经度符号反了 —— 应为 ${(-lng).toFixed(4)}（西经是负数）` },
    { apply: ([lng, lat]) => [lng, -lat], hint: ([, lat]) => `纬度符号反了 —— 应为 ${(-lat).toFixed(4)}（南纬是负数）` },
    { apply: ([lng, lat]) => [lat, lng], hint: ([lng, lat]) => `纬度和经度写反了 —— 应为 \`coord: ${lng}, ${lat}\`（纬度在前）` },
  ]
  const intoMain = (c: [number, number]): boolean => Math.abs(c[1]) <= 90 && main.some((m) => near(c, m.coord))

  for (const group of groups) {
    if (group === main) continue
    const fix = fixes.find((f) => group.every((p) => intoMain(f.apply(p.coord))))
    if (!fix && group.length > 1) continue
    for (const p of group) {
      const line = lines.get(placeKey(p.name)) ?? 1
      const message = `地点 "${p.name}" 的坐标 ${formatLatLng(p.coord)} 离其余地点都很远`
      if (fix) {
        bag.error(line, message, fix.hint(p.coord))
      } else {
        const closest = withCoord.filter((o) => o !== p).reduce((a, b) => (degreesApart(p.coord, b.coord) < degreesApart(p.coord, a.coord) ? b : a))
        const km = Math.round(kmApart(p.coord, closest.coord))
        bag.warn(line, message, `最近的「${closest.name}」也在约 ${km} km 外；确实要去那么远的话忽略此条`)
      }
    }
  }
}
