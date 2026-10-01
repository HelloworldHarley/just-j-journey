import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from '../src/parse.ts'
import { serialize } from '../src/serialize.ts'
import { sanitize } from '../src/sanitize.ts'
import { constraintValues, findLeaks, sensitiveValues } from '../src/leaks.ts'

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
  it('抹过的公开版一处都不该命中（黑名单本身非空，断言不是空对空）', () => {
    const t = trip()
    expect(sensitiveValues(t).length).toBeGreaterThan(10)
    expect(findLeaks(serialize(sanitize(t)), t)).toEqual([])
  })

  it('没抹的完整版在结构块里命中（inFence）', () => {
    const t = trip()
    const leaks = findLeaks(serialize(t), t)
    expect(leaks.some((l) => l.value === '$842' && l.inFence)).toBe(true)
    expect(leaks.some((l) => l.value === '777 Made Up Road' && l.inFence)).toBe(true)
  })

  it('硬约束的 label / note 单独成名单 —— 不靠别处恰好也写了同一个值', () => {
    // 加一条只出现在硬约束里的值：值机码、门锁密码这类东西作者只会写在这里
    const t = trip()
    t.constraints.push({ kind: 'deadline', at: '2026-11-22 12:00', label: '退房 · 门锁密码 9Z7Q', note: '值机码 K2LM8' })
    expect(constraintValues(t)).toEqual(expect.arrayContaining(['退房 · 门锁密码 9Z7Q', '值机码 K2LM8']))
    expect(sensitiveValues(t)).not.toContain('值机码 K2LM8') // 不进通用黑名单：它们只在两处查，见下两条
    // 完整版文本里它们躺在 trip-constraints 围栏里 → 结构块命中（sanitize 若没丢掉整块，就是这个形状）
    const leaks = findLeaks(serialize(t), t)
    expect(leaks.some((l) => l.value === '值机码 K2LM8' && l.inFence)).toBe(true)
    // 抹过的公开版整块没了 → 零命中；正文里复述了 → 提醒
    expect(findLeaks(serialize(sanitize(t)), t).filter((l) => l.value.includes('K2LM8'))).toEqual([])
    const prose = findLeaks(serialize(sanitize(t)) + '\n记得带值机码 K2LM8 的截图\n', t).filter((l) => l.value === '值机码 K2LM8')
    expect(prose.map((l) => l.inFence)).toEqual([false])
  })

  it('硬约束的 label 与地点同名：在别的结构块里出现不算泄漏 —— 自由文本撞上地点名很正常，不能把构建打挂', () => {
    const t = trip()
    t.constraints.push({ kind: 'deadline', at: '2026-11-22 15:00', label: '羽田机场' })
    const leaks = findLeaks(serialize(sanitize(t)), t)
    expect(leaks.filter((l) => l.value === '羽田机场')).toEqual([])
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
