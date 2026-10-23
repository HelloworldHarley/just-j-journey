/**
 * 数据目录的布局 —— 文件叫什么、站点上的路径怎么拼。浏览器（数据源）、vite 插件、CLI 与 @jjj/datadir 共用这一份。
 *
 *   <数据目录>/space.md             名片（+ 头像、打赏二维码，路径相对它）
 *   <数据目录>/manifest.json        data:check 生成：入册的行程
 *   <数据目录>/<id>/plan.md         行程；<id> 就是目录名，frontmatter 的 id 必须与它一致
 *   <数据目录>/<id>/geometry.json   enrich 的路网缓存（可选）
 *   <数据目录>/<id>/calendar.ics    data:check 生成的订阅文件（可选）
 *
 * 站点上数据目录挂在 `{BASE_URL}data/`；完整站另有带密钥的订阅目录 `cal/`（见下）。
 */
export const PLAN_FILE = 'plan.md'
export const GEOMETRY_FILE = 'geometry.json'
export const CALENDAR_FILE = 'calendar.ics'
export const MANIFEST_FILE = 'manifest.json'
export const SPACE_FILE = 'space.md'

/** 站点上数据目录的位置，相对 BASE_URL */
export const SITE_DATA_DIR = 'data'

/** 行程目录里的一个文件，相对数据目录。id 做 URL 编码 —— 拼 URL 与拼磁盘路径用同一个形状 */
export function tripFile(id: string, file: string): string {
  return `${encodeURIComponent(id)}/${file}`
}

/** 诊断里指名一份行程：`<id>/plan.md` */
export function planLabel(id: string): string {
  return `${id}/${PLAN_FILE}`
}

/**
 * 完整站的日历订阅 —— 完整站挡在 Cloudflare Access 后面，日历 App 轮询订阅地址时带不了登录态，
 * `data/<id>/calendar.ics` 对它永远是一个登录页。于是完整版构建时把订阅文件另放一份到
 * `cal/<钥匙>/<id>.ics`，Access 只对 `cal/` 放行 —— 地址里的钥匙猜不到，链接本身就是钥匙
 * （Google 日历「私密 iCal 地址」同一做法）。每份行程的钥匙各不相同，由总密钥派生：
 * 把一份行程的订阅链接分享给旅伴，换个 id 也拿不到别的行程。
 * 钥匙只写在 `data/calendar.json` 这份索引里，而索引在 `data/` 下、仍在 Access 后面。
 * 没有索引（dev、没配密钥的构建）时，订阅地址退回行程目录里那份 calendar.ics。
 */
export const CALENDAR_INDEX_FILE = 'calendar.json'

export interface CalendarIndex {
  /** 行程 id → 订阅文件路径，相对站点根（BASE_URL） */
  feeds: Record<string, string>
}

/** 带钥匙的订阅目录：Access 只对它放行 */
export const SECRET_FEED_DIR = 'cal'

export function secretFeedPath(key: string, id: string): string {
  return `${SECRET_FEED_DIR}/${key}/${encodeURIComponent(id)}.ics`
}

/** 订阅路径是不是带钥匙的那种 —— 是的话链接本身就是钥匙，界面上要提醒别外传 */
export function isSecretFeed(feedPath: string): boolean {
  return feedPath.startsWith(`${SECRET_FEED_DIR}/`)
}
