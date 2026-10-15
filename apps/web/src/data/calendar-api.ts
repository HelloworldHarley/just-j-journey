/**
 * 完整站的日历订阅索引 —— 构建时（vite 插件 jjj:data，vite/calendar-feeds.ts）写进 `data/`，
 * 浏览器（MarkdownTripRepository.calendarFeed）读。文件名与形状只在这里定义。
 *
 * 为什么要有它：完整站挡在 Cloudflare Access 后面，日历 App 轮询订阅地址时带不了登录态，
 * `data/<id>/calendar.ics` 对它永远是一个登录页。于是完整版构建时把订阅文件另放一份到
 * `cal/<密钥>/<id>.ics`，Access 只对 `cal/` 放行 —— 地址里的密钥猜不到，链接本身就是钥匙
 * （Google 日历「私密 iCal 地址」同一做法）。密钥只写在这份索引里，而索引在 `data/` 下、
 * 仍在 Access 后面：只有登录的人能看到订阅按钮背后的地址。
 *
 * 没有索引（dev、没配密钥的构建）时，订阅地址退回 `data/<id>/calendar.ics`。
 */
export const CALENDAR_INDEX = 'calendar.json'

export interface CalendarIndex {
  /** 行程 id → 订阅文件路径，相对站点根（BASE_URL） */
  feeds: Record<string, string>
}
