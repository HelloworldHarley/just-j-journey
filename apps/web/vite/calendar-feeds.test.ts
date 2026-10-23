import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DIR, removeTrees, tempTree } from '@jjj/datadir/test-support'
import { calendarToken, feedKey, writeCalendarFeeds } from './calendar-feeds.ts'

const TOKEN = 'a'.repeat(16) + 'B_c-' + '9'.repeat(8)

describe('calendarToken', () => {
  it('没设就是不发订阅', () => {
    expect(calendarToken(undefined, false)).toBeNull()
    expect(calendarToken('', false)).toBeNull()
  })
  it('公开版构建里出现密钥直接报错 —— 它是完整日历的钥匙', () => {
    expect(() => calendarToken(TOKEN, true)).toThrow('公开版')
  })
  it('太短、带斜杠或点（会变成路径穿越）都拒绝', () => {
    expect(() => calendarToken('short', false)).toThrow('24')
    expect(() => calendarToken('../'.repeat(10), false)).toThrow()
    expect(() => calendarToken(`${TOKEN}/x`, false)).toThrow()
  })
  it('合格的原样返回', () => {
    expect(calendarToken(TOKEN, false)).toBe(TOKEN)
  })
})

describe('writeCalendarFeeds', () => {
  let data: string
  let out: string
  beforeAll(() => {
    data = tempTree('cal-data', {
      'trip-a/plan.md': 'x',
      'trip-a/calendar.ics': 'BEGIN:VCALENDAR A',
      'trip-b/plan.md': 'x', // 没有 calendar.ics（data:check 没跑过或解析失败）
      '_demo/plan.md': 'x',
      '_demo/calendar.ics': 'BEGIN:VCALENDAR DEMO',
      'images': DIR, // 不是行程
    })
    out = tempTree('cal-out')
  })
  afterAll(() => removeTrees(data, out))

  it('有订阅文件的真行程拷到 cal/<这份行程的钥匙>/<id>.ics，示范目录与没有文件的跳过；索引写进 data/', () => {
    const key = feedKey(TOKEN, 'trip-a')
    expect(writeCalendarFeeds(data, out, TOKEN)).toEqual(['trip-a'])
    expect(readdirSync(join(out, 'cal'))).toEqual([key])
    expect(readFileSync(join(out, 'cal', key, 'trip-a.ics'), 'utf8')).toBe('BEGIN:VCALENDAR A')
    expect(JSON.parse(readFileSync(join(out, 'data', 'calendar.json'), 'utf8'))).toEqual({
      feeds: { 'trip-a': `cal/${key}/trip-a.ics` },
    })
    expect(existsSync(join(out, 'cal', feedKey(TOKEN, '_demo')))).toBe(false)
  })

  it('钥匙每份行程各不相同、稳定、看不出总密钥 —— 分享一份行程的订阅链接，换个 id 拿不到别的', () => {
    expect(feedKey(TOKEN, 'trip-a')).toMatch(/^[0-9a-f]{32}$/)
    expect(feedKey(TOKEN, 'trip-a')).toBe(feedKey(TOKEN, 'trip-a'))
    expect(feedKey(TOKEN, 'trip-a')).not.toBe(feedKey(TOKEN, 'trip-b'))
    expect(feedKey(TOKEN, 'trip-a')).not.toContain(TOKEN.slice(0, 8))
    expect(feedKey(`${TOKEN}x`, 'trip-a')).not.toBe(feedKey(TOKEN, 'trip-a'))
  })
})
