import { describe, expect, it } from 'vitest'
import { calendarLinks } from './calendar-link.ts'

describe('calendarLinks', () => {
  it('订阅路径拼上部署 base', () => {
    const l = calendarLinks('https://helloworldharley.github.io', '/just-j-journey/', 'data/trip-2026/calendar.ics')
    expect(l.ics).toBe('https://helloworldharley.github.io/just-j-journey/data/trip-2026/calendar.ics')
  })

  it('webcal 链接只换协议，路径与 https 完全一致', () => {
    const l = calendarLinks('https://x.pages.dev', '/', 'cal/abc/trip-2026.ics')
    expect(l.ics).toBe('https://x.pages.dev/cal/abc/trip-2026.ics')
    expect(l.webcal).toBe('webcal://x.pages.dev/cal/abc/trip-2026.ics')
  })

  it('dev 的根 base 与 http 协议同样成立', () => {
    const l = calendarLinks('http://localhost:5173', '/', 'data/x/calendar.ics')
    expect(l.ics).toBe('http://localhost:5173/data/x/calendar.ics')
    expect(l.webcal).toBe('webcal://localhost:5173/data/x/calendar.ics')
  })
})
