import { describe, expect, it } from 'vitest'
import { calendarLinks } from './calendar-link.ts'

describe('calendarLinks', () => {
  it('订阅文件躺在行程数据目录里，路径带上部署 base', () => {
    const l = calendarLinks('https://helloworldharley.github.io', '/just-j-journey/', 'seattle-2026-10')
    expect(l.ics).toBe('https://helloworldharley.github.io/just-j-journey/data/seattle-2026-10/calendar.ics')
  })

  it('webcal 链接只换协议，路径与 https 完全一致', () => {
    const l = calendarLinks('https://helloworldharley.github.io', '/just-j-journey/', 'seattle-2026-10')
    expect(l.webcal).toBe('webcal://helloworldharley.github.io/just-j-journey/data/seattle-2026-10/calendar.ics')
  })

  it('dev 的根 base 与 http 协议同样成立', () => {
    const l = calendarLinks('http://localhost:5173', '/', 'x')
    expect(l.ics).toBe('http://localhost:5173/data/x/calendar.ics')
    expect(l.webcal).toBe('webcal://localhost:5173/data/x/calendar.ics')
  })

  it('行程 id 里的特殊字符要编码 —— 与仓库 fetch plan.md 的口径一致', () => {
    expect(calendarLinks('http://h', '/', 'a b').ics).toBe('http://h/data/a%20b/calendar.ics')
  })
})
