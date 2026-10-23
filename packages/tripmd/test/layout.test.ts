import { describe, expect, it } from 'vitest'
import { CALENDAR_FILE, isSecretFeed, secretFeedPath, tripFile } from '../src/layout.ts'

describe('数据布局', () => {
  it('行程目录里的文件：id 做 URL 编码，与浏览器 fetch 同一口径', () => {
    expect(tripFile('a b', CALENDAR_FILE)).toBe('a%20b/calendar.ics')
  })
  it('cal/ 下的才是带钥匙的订阅', () => {
    expect(secretFeedPath('k1', 'trip')).toBe('cal/k1/trip.ics')
    expect(isSecretFeed(secretFeedPath('k1', 'trip'))).toBe(true)
    expect(isSecretFeed(`data/${tripFile('trip', CALENDAR_FILE)}`)).toBe(false)
  })
})
