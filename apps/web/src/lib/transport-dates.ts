import type { Transport } from '@jjj/schema'

/**
 * 换乘时间轴上每个节点落在哪一天 —— **时刻是输入，日期是派生**。
 *
 * 作者照票面写时刻（出发 / 中转到达 / 中转再出发 / 最终到达），
 * 这里沿时间轴走一遍把日期推出来，界面据此自动补红色 `+n` 角标。
 * 所有节点用同一条规则、同一个基准（出发日）算偏移，不存在两套口径。
 *
 * 推导优先级，每个节点都一样：
 *   1. 作者显式写的日期（`dep_date` / `arr_date` / 中转的 `arr_date`·`dep_date`）—— 锚点，后续从这里继续走
 *   2. 最终到达还接受 `arr_day_offset`（相对出发日），这是跨时区唯一能表达的方式
 *   3. 同一地点的停留：用 `wait` 时长推进。**这是唯一能正确处理超过 24 小时停留的路径**
 *   4. 兜底：钟点回卷 —— 后一个时刻比前一个小就进一天
 *
 * **为什么第 4 条不够、必须留显式日期这条路：**
 * 跨时区时无法从时长反推天数。DL7 从 LAX 08:05 飞 14h25m 到 HND 15:30 次日 ——
 * 本地钟点只走了 7h25m，差出来的 17 小时是时区偏移，不是飞行时间。
 * 没有时区数据就解不出来，所以跨日期变更线的航班必须写 `arr_date` 或 `arr_day_offset`。
 * 而中转停留发生在**同一个机场**、必然同时区，所以第 3 条总是准的。
 */

export interface TimelineDates {
  dep: string | undefined
  /** 与 transport.stops 一一对应 */
  stops: { arr: string | undefined; dep: string | undefined }[]
  arr: string | undefined
}

const DAY = 1440

/** "HH:MM" → 距零点分钟数；不合法返回 null */
export function clockMin(t?: string): number | null {
  const m = t ? /^(\d{1,2}):(\d{2})$/.exec(t.trim()) : null
  if (!m) return null
  const h = Number(m[1])
  const mi = Number(m[2])
  return h <= 24 && mi <= 59 ? h * 60 + mi : null
}

export function plusDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function diffDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00Z`) - Date.parse(`${from}T00:00Z`)) / 86_400_000)
}

export function timelineDates(t: Transport, eventDate?: string): TimelineDates {
  // 出发日：作者写的优先，否则就是事件所在那天
  const dep = t.depDate ?? eventDate
  let cur = dep
  let prevClock = clockMin(t.depTime)

  /**
   * 走一步。authored 是锚点；elapsedMin 只在「同地点停留」时给
   * （那种场景同时区，按时长推进能跨过 24 小时）；其余情况靠钟点回卷。
   */
  const step = (
    authored: string | undefined,
    time: string | undefined,
    elapsedMin: number | null,
  ): string | undefined => {
    const clock = clockMin(time)
    if (authored) {
      cur = authored
      if (clock !== null) prevClock = clock
      return authored
    }
    if (!cur) return undefined
    if (elapsedMin !== null && prevClock !== null) {
      const total = prevClock + elapsedMin
      cur = plusDays(cur, Math.floor(total / DAY))
      prevClock = clock ?? ((total % DAY) + DAY) % DAY
      return cur
    }
    if (clock === null) return undefined
    if (prevClock !== null && clock < prevClock) cur = plusDays(cur, 1)
    prevClock = clock
    return cur
  }

  const stops = t.stops.map((s) => ({
    // 到达中转点：这一跳在移动，可能跨时区 → 只能靠作者或钟点回卷
    arr: step(s.arrDate, s.arrTime, null),
    // 从中转点再出发：人没挪窝，同时区 → 有 wait 就用它，能正确跨过 24 小时
    dep: step(s.depDate, s.depTime, s.waitMin),
  }))

  let arr: string | undefined
  if (t.arrDate) {
    arr = t.arrDate
  } else if (t.arrDayOffset !== 0 && dep) {
    // 规范里 arr_day_offset 是「相对出发日第几天」
    arr = plusDays(dep, t.arrDayOffset)
  } else {
    arr = step(undefined, t.arrTime, null)
  }

  return { dep, stops, arr }
}

/**
 * 某个节点相对出发日跨了几天。0 = 当天，界面据此决定要不要标红色 `+n`。
 * 所有节点（含中转）都走这一个函数 —— 这就是「口径统一」的落点。
 */
export function dayOffsetOf(dep: string | undefined, node: string | undefined): number {
  if (!dep || !node) return 0
  return Math.max(0, diffDays(dep, node))
}
