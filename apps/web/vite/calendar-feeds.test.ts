import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { calendarToken, writeCalendarFeeds } from './calendar-feeds.ts'

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
    data = realpathSync(mkdtempSync(join(tmpdir(), 'jjj-cal-data-')))
    out = realpathSync(mkdtempSync(join(tmpdir(), 'jjj-cal-out-')))
    for (const id of ['trip-a', 'trip-b', '_demo']) mkdirSync(join(data, id))
    writeFileSync(join(data, 'trip-a', 'calendar.ics'), 'BEGIN:VCALENDAR A')
    writeFileSync(join(data, '_demo', 'calendar.ics'), 'BEGIN:VCALENDAR DEMO')
    // trip-b 没有 calendar.ics（data:check 没跑过或解析失败）
  })
  afterAll(() => {
    rmSync(data, { recursive: true, force: true })
    rmSync(out, { recursive: true, force: true })
  })

  it('有订阅文件的真行程拷到 cal/<密钥>/<id>.ics，示范目录与没有文件的跳过；索引写进 data/', () => {
    expect(writeCalendarFeeds(data, out, TOKEN)).toEqual(['trip-a'])
    expect(readdirSync(join(out, 'cal', TOKEN))).toEqual(['trip-a.ics'])
    expect(readFileSync(join(out, 'cal', TOKEN, 'trip-a.ics'), 'utf8')).toBe('BEGIN:VCALENDAR A')
    expect(JSON.parse(readFileSync(join(out, 'data', 'calendar.json'), 'utf8'))).toEqual({
      feeds: { 'trip-a': `cal/${TOKEN}/trip-a.ics` },
    })
    expect(existsSync(join(out, 'cal', TOKEN, '_demo.ics'))).toBe(false)
  })
})
