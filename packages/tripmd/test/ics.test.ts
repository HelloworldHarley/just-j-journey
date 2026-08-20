import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from '../src/parse.ts'
import { toIcs } from '../src/ics.ts'

/**
 * .ics 导出的结构合同。这份文件要被 Apple / Google 的解析器吃下去，
 * 坏一行整份日历就订阅失败，而且失败发生在别人的服务器上，没有日志可看 ——
 * 所以结构错误必须在这里、在本机就红。
 */

const load = (dir: string) =>
  readFileSync(join(__dirname, '../../../apps/web/public/data', dir, 'plan.md'), 'utf8')

/** 注入固定时间戳 —— DTSTAMP 默认取当前时刻，不注入的话断言无法复现 */
const NOW = '20260820T000000Z'

const trip = parse(load('_example')).trip!
const ics = toIcs(trip, { now: NOW })
const lines = ics.split('\r\n')

describe('toIcs 结构', () => {
  it('BEGIN/END 逐层配对，整份以 VCALENDAR 包裹', () => {
    const stack: string[] = []
    for (const l of lines) {
      if (l.startsWith('BEGIN:')) stack.push(l.slice(6))
      if (l.startsWith('END:')) expect(stack.pop()).toBe(l.slice(4))
    }
    expect(stack).toEqual([])
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines.at(-2)).toBe('END:VCALENDAR') // 末尾必须留一个 CRLF，所以最后一项是空串
    expect(lines.at(-1)).toBe('')
  })

  it('每个事件恰好一个 VEVENT，UID 稳定且全局唯一', () => {
    const uids = lines.filter((l) => l.startsWith('UID:'))
    const eventCount = trip.days.reduce((n, d) => n + d.events.length, 0)
    // 事件之外还有硬约束的 VEVENT，UID 也必须不撞
    expect(uids.length).toBe(eventCount + trip.constraints.length)
    expect(new Set(uids).size).toBe(uids.length)
    // UID 由解析器的稳定 id 派生 —— 内容不变则重新生成不变，订阅端才认得出"同一个事件"
    expect(uids[0]).toMatch(new RegExp(`@${trip.id}\\.jjj$`))
  })

  it('注入 now 之后输出是字节级确定的 —— 订阅文件不该无谓抖动', () => {
    expect(toIcs(trip, { now: NOW })).toBe(ics)
  })

  it('单行不超过 75 字节，续行以空格开头（RFC 5545 折行）', () => {
    const enc = new TextEncoder()
    for (const l of lines) {
      expect(enc.encode(l).length, l).toBeLessThanOrEqual(75)
    }
    // 长中文描述必然触发折行 —— 确认折行真的发生过，这条测试才有对象
    expect(lines.some((l) => l.startsWith(' '))).toBe(true)
  })

  it('折行不劈开 UTF-8 多字节序列 —— 重新拼合后能无损解码', () => {
    // 拼回逻辑行后不应出现替换字符 U+FFFD（劈开序列的典型症状）
    const unfolded = ics.replace(/\r\n /g, '')
    expect(unfolded.includes('�')).toBe(false)
  })

  it('时区随行程走，浮动本地时间配 TZID', () => {
    expect(lines).toContain(`X-WR-TIMEZONE:${trip.timezone}`)
    expect(lines.some((l) => l.startsWith(`DTSTART;TZID=${trip.timezone}:`))).toBe(true)
  })
})
