import { groupKeyOf, type Day, type Trip, type TripSummary } from '@jjj/schema'

/**
 * Trip → 首页卡片摘要。
 *
 * 单工件架构下没有构建期的 index.json 了，摘要在浏览器里现算 ——
 * 所以这段逻辑住在包里（CLI 校验和前端共用），不再住在 tools 里。
 */

/**
 * 一天的构成：玩/吃/其他各占多少分钟，加上当天跨度。
 *
 * 首页卡片的竖条、日程轨的构成条、月视图格子的密度条 —— 三处画的是同一件事，
 * 所以公式只能有一份（含「时间点事件给 15 分钟名义值」这条约定）。
 *
 * **全天事件不算**：一张周游券的名义窗口是 00:00–24:00，按 1440 分钟计入的话
 * 它一个人就占掉整根条的八九成，真正安排的十几个小时反而看不见 ——
 * 和 `daySpan` 排除全天事件是同一个道理、同一个口径。
 */
export function dayComposition(day: Day): TripSummary['dayShape'][number] {
  const timed = day.events.filter((e) => e.timeKind !== 'allday')
  const acc = { play: 0, food: 0, other: 0 }
  for (const e of timed) {
    // 时间点事件（时长 0）给一个名义值，否则它在条里完全不可见
    acc[groupKeyOf(e.category)] += Math.max(e.endMin - e.startMin, 15)
  }
  const span =
    timed.length === 0
      ? 0
      : Math.max(...timed.map((e) => e.endMin)) - Math.min(...timed.map((e) => e.startMin))
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
    dayShape: trip.days.map(dayComposition),
  }
}
