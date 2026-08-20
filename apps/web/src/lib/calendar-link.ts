/**
 * 行程日历的订阅地址 —— `tools/check.ts` 在每次 `data:check` 时把 `toIcs()` 的产物
 * 写到 `data/<id>/calendar.ics`（与 plan.md、geometry.json 同一目录的派生文件），
 * 这里只负责拼出指向它的两种链接：
 *
 * - `ics`：普通 https 地址，点开即下载一份快照；
 * - `webcal`：同一地址换协议 —— 日历 App 认这个协议为「订阅」，会定期重新拉取，
 *   于是 plan.md 改了、推上线之后，订阅方的日历在下一次轮询时自动跟上。
 *
 * 纯字符串拼装，不碰 DOM：origin 与 base 由组件从 `location` / `import.meta.env`
 * 里取好递进来，这样这份口径可以直接单测。
 */
export function calendarLinks(
  origin: string,
  base: string,
  tripId: string,
): { ics: string; webcal: string } {
  const ics = `${origin}${base}data/${encodeURIComponent(tripId)}/calendar.ics`
  return { ics, webcal: ics.replace(/^https?:/, 'webcal:') }
}
