import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from '../src/parse.ts'
import { serialize } from '../src/serialize.ts'
import { sanitize } from '../src/sanitize.ts'
import { findLeaks, sensitiveValues } from '../src/leaks.ts'

const md = readFileSync(join(__dirname, 'fixtures/sanitize-full.md'), 'utf8')
const trip = () => parse(md).trip!

describe('sensitiveValues', () => {
  it('收票价 / 班次 / 座位 / 预订金额 / 民宿 en 与 note 与精确坐标，金额另加裸数字', () => {
    const v = sensitiveValues(trip())
    for (const s of ['$842', '842', 'DL7', 'DL167', '36C', '22A', '$120.00', '120.00', '$88.40', '777 Made Up Road', '门牌在邮箱后面', '35.65432, 139.12345', '确认号 ABC123', 'https://example.com/listing/1', 'ChIJfakefakefake']) {
      expect(v, s).toContain(s)
    }
    // 通用词不进黑名单：正文里合法出现太多
    expect(v).not.toContain('达美')
    expect(v).not.toContain('经济舱')
    // 裸数字只从金额派生：备注里的 "ABC123" 不能长出 "123"
    expect(v).not.toContain('123')
  })

  it('逗号分组的金额（¥11,220）派生逗号形式与去逗号形式，不产生裸的 220', () => {
    const v = sensitiveValues(trip())
    expect(v).toContain('¥11,220')
    expect(v).toContain('11,220')
    expect(v).toContain('11220')
    expect(v).not.toContain('220')
  })
})

describe('findLeaks', () => {
  it('抹过的公开版一处都不该命中', () => {
    const t = trip()
    expect(findLeaks(serialize(sanitize(t)), t)).toEqual([])
  })

  it('没抹的完整版在结构块里命中（inFence）', () => {
    const t = trip()
    const leaks = findLeaks(serialize(t), t)
    expect(leaks.some((l) => l.value === '$842' && l.inFence)).toBe(true)
    expect(leaks.some((l) => l.value === '777 Made Up Road' && l.inFence)).toBe(true)
  })

  it('正文里出现票价：命中但 inFence 为 false（警告级）', () => {
    const t = trip()
    const publicMd = serialize(sanitize(t)) + '\n## 附录 · 预算\n\n```trip-ref\nid: budget\n```\n\n机票 $842，住宿 $120.00。\n'
    const leaks = findLeaks(publicMd, t)
    expect(leaks.length).toBeGreaterThan(0)
    expect(leaks.every((l) => !l.inFence)).toBe(true)
    expect(leaks.map((l) => l.value)).toContain('$842')
  })

  it('非结构围栏（~~~）里出现字面 ```trip-transports 行：不当结构块处理，命中只警告', () => {
    const t = trip()
    const publicMd =
      serialize(sanitize(t)) +
      '\n## 附录 · 示例\n\n~~~\n```trip-transports\n机票 $842\n~~~\n'
    const leaks = findLeaks(publicMd, t)
    const hit = leaks.find((l) => l.value === '$842')
    expect(hit).toBeDefined()
    expect(hit?.inFence).toBe(false)
  })
})
