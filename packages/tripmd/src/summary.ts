import { groupKeyOf, type Day, type Trip, type TripSummary } from '@jjj/schema'

/**
 * Trip → 首页卡片摘要。
 *
 * 单工件架构下没有构建期的 index.json 了，摘要在浏览器里现算 ——
 * 所以这段逻辑住在包里（CLI 校验和前端共用），不再住在 tools 里。
 */

/** 一天的构成：分组分钟数 + 跨度。首页卡片竖条的数据源。 */
function dayShapeOf(day: Day): TripSummary['dayShape'][number] {
  const acc = { play: 0, food: 0, other: 0 }
  for (const e of day.events) {
    // 时间点事件（时长 0）给一个名义值，否则它在条里完全不可见
    acc[groupKeyOf(e.category)] += Math.max(e.endMin - e.startMin, 15)
  }
  const span =
    day.events.length === 0
      ? 0
      : Math.max(...day.events.map((e) => e.endMin)) -
        Math.min(...day.events.map((e) => e.startMin))
  return { ...acc, span }
}

export function summarize(trip: Trip): TripSummary {
  return {
    id: trip.id,
    title: trip.title,
    subtitle: trip.subtitle,
    destination: trip.destination,
    dates: trip.dates,
    travelers: trip.travelers,
    dayCount: trip.days.length,
    eventCount: trip.days.reduce((n, d) => n + d.events.length, 0),
    bookingCount: trip.days.reduce(
      (n, d) => n + d.events.filter((e) => e.flags.includes('needs-booking')).length,
      0,
    ),
    dayShape: trip.days.map(dayShapeOf),
  }
}
