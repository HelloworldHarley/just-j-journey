import { copyFileSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { insideDir, tripDirs } from '@jjj/datadir'
import { isFixtureId } from '@jjj/tripmd'
import { CALENDAR_INDEX, type CalendarIndex } from '../src/data/calendar-api.ts'

/**
 * 完整站的日历订阅：带密钥的路径 `cal/<密钥>/<id>.ics`。为什么这么做见 src/data/calendar-api.ts。
 * 只在**完整版构建**时发生；dev 与公开版都不碰它。
 */

/**
 * 读 JJJ_CALENDAR_TOKEN 并把关。返回 null 表示这次构建不发订阅地址。
 * - 公开版构建里出现它 → 直接报错：它是完整日历的钥匙，混进公开站就等于把完整行程公开了
 * - 太短或带奇怪字符 → 报错：它要当 URL 路径段，也要猜不到（`openssl rand -hex 24` 生成 48 位）
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
 * 把数据目录里每份行程的 calendar.ics（data:check 生成）拷到产物的 `cal/<token>/<id>.ics`，
 * 再写 `data/calendar.json` 索引。`_` 前缀的示范目录不发；没有 calendar.ics 的行程跳过。
 * 返回写出了订阅的行程 id。
 */
export function writeCalendarFeeds(dataRoot: string, outDir: string, token: string): string[] {
  const feeds: CalendarIndex['feeds'] = {}
  for (const id of tripDirs(dataRoot)) {
    if (isFixtureId(id)) continue
    const src = insideDir(dataRoot, join(id, 'calendar.ics'))
    if (!src || !statSync(src, { throwIfNoEntry: false })?.isFile()) continue
    const rel = `cal/${token}/${id}.ics`
    mkdirSync(join(outDir, 'cal', token), { recursive: true })
    copyFileSync(src, join(outDir, rel))
    feeds[id] = rel
  }
  mkdirSync(join(outDir, 'data'), { recursive: true })
  writeFileSync(join(outDir, 'data', CALENDAR_INDEX), JSON.stringify({ feeds } satisfies CalendarIndex))
  return Object.keys(feeds)
}
