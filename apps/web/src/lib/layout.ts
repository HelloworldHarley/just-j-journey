import type { Day, Leg, TripEvent } from '@trip-atlas/schema'

/**
 * 列表视图的行编排。
 *
 * **不按时长设置高度。** 早期版本让事件块和空档正比于真实分钟数，想让人
 * 「看出时间的形状」。但列表里没有时间轴 —— 没有刻度可读，34px 和 92px
 * 的间隔只会被读成节奏不齐，而时长本来就已经用文字写在通勤条上了。
 * 比例高度要能被读懂，前提是旁边有一根轴，那是日历视图的活。
 *
 * 这里改成：每个事件一张等距卡片，卡片之间用通勤条连接。
 */

/** 小于这个分钟数的空档只当作卡片间距，不单独成行 */
const IDLE_FLOOR = 20

export interface EventRow {
  kind: 'event'
  key: string
  event: TripEvent
}

export interface LegRow {
  kind: 'leg'
  key: string
  leg: Leg
  /** 空档减去路上耗时。负数 = 时间冲突 */
  slackMin: number | null
  gapMin: number
}

export interface IdleRow {
  kind: 'idle'
  key: string
  minutes: number
  /** 短空档只画一小段连接线；长空档才标出「N 小时空档」 */
  labelled: boolean
}

export type TimelineRow = EventRow | LegRow | IdleRow

export function buildTimeline(day: Day): TimelineRow[] {
  const legByEvent = new Map<string, Leg>()
  for (const leg of day.legs) legByEvent.set(leg.afterEventId, leg)

  const rows: TimelineRow[] = []
  const events = day.events

  events.forEach((ev, i) => {
    const prev = i > 0 ? events[i - 1] : undefined

    if (prev) {
      const gapMin = Math.max(0, ev.startMin - prev.endMin)
      const leg = legByEvent.get(prev.id)

      if (leg) {
        rows.push({
          kind: 'leg',
          key: leg.id,
          leg,
          slackMin: leg.durationMin === null ? null : gapMin - leg.durationMin,
          gapMin,
        })
      } else {
        // 没有通勤时也要有一行 —— 否则两张卡片会贴在一起，看不出先后。
        // 大段空档额外标出分钟数：「机场等 3 小时」是有用的信息，不能静默吞掉。
        rows.push({
          kind: 'idle',
          key: `idle-${prev.id}`,
          minutes: gapMin,
          labelled: gapMin >= IDLE_FLOOR,
        })
      }
    }

    rows.push({ kind: 'event', key: ev.id, event: ev })
  })

  return rows
}

/**
 * 余量只在**为负**（真冲突）时显示。
 *
 * 一开始每段都标余量，结果 Day 4 一屏四个红色「余量 0 分」。原因是行程按
 * 「上个事件结束 + 路上耗时 = 下个事件开始」排的，0 余量是**基准而非异常** ——
 * 一个永远亮着的警告等于没有警告。
 */
export function isConflict(slackMin: number | null): boolean {
  return slackMin !== null && slackMin < 0
}

/** 当天的时间跨度，给日头用 */
export function daySpan(day: Day): { from: number; to: number } | null {
  if (day.events.length === 0) return null
  return {
    from: Math.min(...day.events.map((e) => e.startMin)),
    to: Math.max(...day.events.map((e) => e.endMin)),
  }
}
