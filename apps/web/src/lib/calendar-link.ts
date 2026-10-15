/**
 * 行程日历的订阅链接 —— 订阅文件放在哪由数据源决定（TripRepository.calendarFeed）：
 * dev 与没配密钥的构建是 `data/<id>/calendar.ics`（data:check 生成），
 * 完整站是 `cal/<密钥>/<id>.ics`（见 src/data/calendar-api.ts）。这里只把那条路径拼成两种链接：
 *
 * - `ics`：普通 https 地址，点开即下载一份快照；Google 日历要粘贴的也是它；
 * - `webcal`：同一地址换协议 —— 日历 App 认这个协议为「订阅」，会定期重新拉取，
 *   于是 plan.md 改了、推上线之后，订阅方的日历在下一次轮询时自动跟上。
 *
 * 纯字符串拼装，不碰 DOM：origin 与 base 由组件从 `location` / `import.meta.env`
 * 里取好递进来，这样这份口径可以直接单测。
 */
export function calendarLinks(origin: string, base: string, feedPath: string): { ics: string; webcal: string } {
  const ics = `${origin}${base}${feedPath}`
  return { ics, webcal: ics.replace(/^https?:/, 'webcal:') }
}

/** 没有订阅索引时的缺省路径：行程目录里 data:check 生成的那份。id 编码口径与仓库 fetch plan.md 一致 */
export function defaultFeedPath(tripId: string): string {
  return `data/${encodeURIComponent(tripId)}/calendar.ics`
}

/** 订阅路径是不是带密钥的那种 —— 是的话，链接本身就是钥匙，界面上要提醒别外传 */
export function isSecretFeed(feedPath: string): boolean {
  return feedPath.startsWith('cal/')
}
