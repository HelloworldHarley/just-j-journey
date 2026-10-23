/**
 * 行程日历的订阅链接 —— 订阅文件放在哪由数据源决定（TripRepository.calendarFeed）：
 * dev 与没配密钥的构建是行程目录里 data:check 生成的那份，完整站是带钥匙的 `cal/…`（@jjj/tripmd 的 layout.ts）。
 * 这里只把那条路径拼成两种链接：
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
