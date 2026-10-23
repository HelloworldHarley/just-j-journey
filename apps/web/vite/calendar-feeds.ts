import { createHmac } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { copyDataFile, tripDirs } from '@jjj/datadir'
import { CALENDAR_FILE, CALENDAR_INDEX_FILE, SITE_DATA_DIR, isFixtureId, secretFeedPath, type CalendarIndex } from '@jjj/tripmd'

/**
 * 完整站的日历订阅：每份行程一把钥匙的路径 `cal/<钥匙>/<id>.ics`。为什么这么做见 @jjj/tripmd 的 layout.ts。
 * 只在**完整版构建**时发生；dev 与公开版都不碰它。
 */

/**
 * 读 JJJ_CALENDAR_TOKEN 并把关。返回 null 表示这次构建不发订阅地址。
 * - 公开版构建里出现它 → 直接报错：它是完整日历的钥匙，混进公开站就等于把完整行程公开了
 * - 太短或带奇怪字符 → 报错：每份行程的钥匙都由它派生，它自己得猜不到（`openssl rand -hex 24` 生成 48 位）
 */
export function calendarToken(raw: string | undefined, publicMode: boolean): string | null {
  if (!raw) return null
  if (publicMode) throw new Error('JJJ_CALENDAR_TOKEN 不能出现在公开版构建里 —— 它是完整日历的钥匙')
  if (!/^[A-Za-z0-9_-]{24,}$/.test(raw)) {
    throw new Error('JJJ_CALENDAR_TOKEN 至少 24 位，只能有字母、数字、_ 和 -（用 openssl rand -hex 24 生成）')
  }
  return raw
}

/**
 * 一份行程的订阅钥匙：由总密钥与行程 id 派生（HMAC-SHA256 取前 32 位十六进制）。
 * 把一份行程的订阅链接分享给旅伴，对方换个 id 也推不出别份的钥匙；换总密钥则所有订阅一起失效
 */
export function feedKey(token: string, id: string): string {
  return createHmac('sha256', token).update(id).digest('hex').slice(0, 32)
}

/**
 * 把数据目录里每份行程的 calendar.ics（data:check 生成）拷到产物的 `cal/<钥匙>/<id>.ics`，
 * 再写 `data/calendar.json` 索引。`_` 前缀的示范目录不发；没有 calendar.ics 的行程跳过。
 * 返回写出了订阅的行程 id。
 */
export function writeCalendarFeeds(dataRoot: string, outDir: string, token: string): string[] {
  const feeds: CalendarIndex['feeds'] = {}
  for (const id of tripDirs(dataRoot)) {
    if (isFixtureId(id)) continue
    const rel = secretFeedPath(feedKey(token, id), id)
    if (copyDataFile(dataRoot, join(id, CALENDAR_FILE), join(outDir, rel))) feeds[id] = rel
  }
  mkdirSync(join(outDir, SITE_DATA_DIR), { recursive: true })
  writeFileSync(join(outDir, SITE_DATA_DIR, CALENDAR_INDEX_FILE), JSON.stringify({ feeds } satisfies CalendarIndex))
  return Object.keys(feeds)
}
