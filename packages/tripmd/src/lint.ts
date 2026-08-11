import type { Place, Trip } from '@jjj/schema'
import { DiagnosticBag } from './diagnostics.ts'
import type { DayFlow } from './days.ts'
import { placeKey } from './values.ts'

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
    for (const leg of legs) {
      if (leg.durationMin === null) continue
      const fromIdx = events.findIndex((e) => e.id === leg.afterEventId)
      const from = events[fromIdx]
      const to = events[fromIdx + 1]
      if (!from || !to) continue
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

/** 没人引用的前置记录：信息模块不会出现在行程里，大概率是漏了 detail: */
export function lintUnreferenced(
  bag: DiagnosticBag,
  blocks: { journeys: Trip['journeys']; stays: Trip['stays']; rentals: Trip['rentals'] },
  referenced: ReadonlySet<string> | Map<string, unknown>,
): void {
  for (const list of [blocks.journeys, blocks.stays, blocks.rentals] as const) {
    for (const item of list) {
      if (!referenced.has(item.what)) {
        bag.warn(
          1,
          `前置记录「${item.what}」没有任何事件用 \`detail:\` 引用`,
          '它的信息模块不会出现在行程里；在对应事件上加 `detail: ' + item.what + '`',
        )
      }
    }
  }
}

/**
 * 坐标离群检测（无需联网）。
 * 西经漏负号会把西雅图画到中国境内，而且完全静默。
 * 不做 geocoding 也能抓到它：所有坐标本该聚成一团，离群的那个就是错的。
 */
export function checkCoordOutliers(
  bag: DiagnosticBag,
  places: Place[],
  lines: Map<string, number>,
): void {
  const withCoord = places.filter((p): p is Place & { coord: [number, number] } => p.coord !== null)
  if (withCoord.length < 3) return

  const median = (xs: number[]): number => {
    const s = [...xs].sort((a, b) => a - b)
    return s[Math.floor(s.length / 2)] ?? 0
  }
  const mLng = median(withCoord.map((p) => p.coord[0]))
  const mLat = median(withCoord.map((p) => p.coord[1]))

  // 一趟旅行的地点通常在几度之内。10 度 ≈ 1100km，超出必是录入错误而非真的跑那么远。
  const LIMIT = 10

  for (const p of withCoord) {
    const [lng, lat] = p.coord
    const dLng = Math.abs(lng - mLng)
    const dLat = Math.abs(lat - mLat)
    if (dLng <= LIMIT && dLat <= LIMIT) continue

    const line = lines.get(placeKey(p.name)) ?? 1
    let hint = `其余地点集中在 ${mLat.toFixed(2)}, ${mLng.toFixed(2)} 附近`

    if (Math.abs(-lng - mLng) <= LIMIT && dLat <= LIMIT) {
      hint = `经度符号反了 —— 应为 ${(-lng).toFixed(4)}（西经是负数）`
    } else if (Math.abs(-lat - mLat) <= LIMIT && dLng <= LIMIT) {
      hint = `纬度符号反了 —— 应为 ${(-lat).toFixed(4)}（南纬是负数）`
    } else if (Math.abs(lat - mLng) <= LIMIT && Math.abs(lng - mLat) <= LIMIT) {
      hint = `纬度和经度写反了 —— 应为 \`coord: ${lng}, ${lat}\`（纬度在前）`
    }

    bag.error(line, `地点 "${p.name}" 的坐标 ${lat}, ${lng} 离其余地点太远`, hint)
  }
}
