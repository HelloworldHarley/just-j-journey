import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Trip } from '@jjj/schema'
import { findLeaks } from '../src/leaks.ts'
import { parse } from '../src/parse.ts'
import { sanitize, type Secret } from '../src/sanitize.ts'
import { serialize } from '../src/serialize.ts'
import { makePlace, makeTrip } from './support/index.ts'

const md = readFileSync(join(__dirname, 'fixtures/sanitize-full.md'), 'utf8')
const full = (): Trip => parse(md).trip!

/** 一个只有一个地点的公开版 —— 把要扫的文字放在地点备注（结构字段）或附录（正文）里 */
const publicWith = (opts: { note?: string; nameEn?: string; appendix?: string; coord?: [number, number]; subtitle?: string }): Trip =>
  makeTrip({
    subtitle: opts.subtitle,
    places: [makePlace({ id: 'p', note: opts.note, nameEn: opts.nameEn, coord: opts.coord ?? null })],
    reference: opts.appendix ? [{ id: 'a', title: '附录', markdown: opts.appendix }] : [],
  })
const text = (value: string, loose = false, source = '来源'): Secret => ({ kind: 'text', value, source, loose })
const money = (value: string): Secret => ({ kind: 'money', value, source: '来源' })
const code = (value: string): Secret => ({ kind: 'code', value, source: '来源' })

describe('findLeaks · 整条链', () => {
  it('抹过的公开版一处都不命中（黑名单本身非空，断言不是空对空）', () => {
    const { trip, secrets } = sanitize(full())
    expect(secrets.length).toBeGreaterThan(10)
    expect(findLeaks(parse(serialize(trip)).trip!, secrets)).toEqual([])
  })

  it('没抹的完整版：结构字段里命中即致命，并说出它在哪、从哪来', () => {
    const t = full()
    const leaks = findLeaks(t, sanitize(t).secrets)
    expect(leaks).toContainEqual({
      value: '$842',
      source: '长途「去程」 · 第 1 条交通 · price',
      where: '长途「去程」 · 第 1 条交通 · price',
      fatal: true,
    })
    expect(leaks.some((l) => l.value === '777 Made Up Road' && l.fatal)).toBe(true)
  })
})

describe('findLeaks · 怎么比', () => {
  it('数字按边界匹配：票价 758 不算出现在坐标 135.7588 里，单独写的 758 才算', () => {
    expect(findLeaks(publicWith({ note: '京都站 34.9858, 135.7588' }), [money('$758')])).toEqual([])
    expect(findLeaks(publicWith({ note: '京都站 34.9858, 135.7588' }), [money('$7588')])).toEqual([]) // 小数点后面那段也不算
    expect(findLeaks(publicWith({ note: '车费 758 日元' }), [money('$758')])).toHaveLength(1)
  })

  it('逗号分组的金额：¥11,220 认得出 11220，也不长出裸的 220', () => {
    expect(findLeaks(publicWith({ note: '一共 11220' }), [money('¥11,220')])).toHaveLength(1)
    expect(findLeaks(publicWith({ note: '房号 220' }), [money('¥11,220')])).toEqual([])
  })

  it('复合班次逐段找，大小写、全角、空白都不影响', () => {
    const secrets = [code('DL281 · DL167')]
    expect(findLeaks(publicWith({ note: '转机 Dl 167 时记得重新托运' }), secrets)).toHaveLength(1)
    expect(findLeaks(publicWith({ note: '转机ＤＬ１６７' }), secrets)).toHaveLength(1)
    expect(findLeaks(publicWith({ note: '转机 DL1670' }), secrets)).toEqual([]) // 边界：多一位就是另一班
  })

  it('自由文本整句找，不按标点拆 —— 「国际到达」这种片段到处都合法', () => {
    expect(findLeaks(publicWith({ note: '国际到达在 B 层' }), [text('国际到达，过海关后行李转盘取行李')])).toEqual([])
  })

  it('带引号、反斜杠的值照样认得出 —— 扫的是对象，不是转义过的文本', () => {
    expect(findLeaks(publicWith({ note: '地址 777 "Made Up" Road' }), [text('777 "Made Up" Road')])).toHaveLength(1)
  })

  it('正文（附录、副标题）里命中只提醒；loose 的值在结构字段里也只提醒', () => {
    const [prose] = findLeaks(publicWith({ appendix: '机票 $842，住宿另算' }), [money('$842')])
    expect(prose).toMatchObject({ where: '附录「附录」 · markdown', fatal: false })
    expect(findLeaks(publicWith({ subtitle: 'UA34 回程' }), [code('UA34')])).toMatchObject([{ fatal: false }])
    expect(findLeaks(publicWith({ note: '羽田机场 T3' }), [text('羽田机场', true)])).toMatchObject([{ fatal: false }])
  })

  it('民宿精确坐标：结构里的坐标按数值比（致命），正文里手抄的「纬度, 经度」按文字比（提醒）', () => {
    const exact: Secret = { kind: 'coord', coord: [139.12345, 35.65432], source: '来源' }
    expect(findLeaks(publicWith({ coord: [139.12345, 35.65432] }), [exact])).toMatchObject([{ where: '地点「p」 · coord', fatal: true }])
    expect(findLeaks(publicWith({ coord: [139.12, 35.65] }), [exact])).toEqual([])
    expect(findLeaks(publicWith({ appendix: '坐标 35.65432, 139.12345' }), [exact])).toMatchObject([{ fatal: false }])
  })

  it('只扫作者写的字：时区、id、指针不扫 —— 它们由名字派生或不是人写的，撞上了作者也改不掉', () => {
    const t = makeTrip({ timezone: 'Asia/Tokyo', places: [makePlace({ id: 'p-tokyo-tower', name: '东京塔' })] })
    expect(findLeaks(t, [text('Tokyo')])).toEqual([])
  })

  it('空白并成一个而不是删掉：「LAX T2 Departures」里认得出 LAX T2（致命）', () => {
    expect(findLeaks(publicWith({ nameEn: 'LAX T2 Departures' }), [text('LAX T2')])).toMatchObject([{ fatal: true }])
  })

  it('不够特异的只提醒：两个汉字、三个字母撞上别的名字很正常，致命会误杀', () => {
    expect(findLeaks(publicWith({ note: '上海菜馆' }), [text('上海')])).toMatchObject([{ fatal: false }])
    expect(findLeaks(publicWith({ nameEn: 'San Francisco Ferry Building' }), [text('SAN')])).toMatchObject([{ fatal: false }])
    expect(findLeaks(publicWith({ note: '座位 5A' }), [code('5A')])).toEqual([]) // 太短，不进黑名单
  })

  it('金额里抠出来的裸数字撞上当场价只提醒；金额原文照抄才致命', () => {
    expect(findLeaks(publicWith({ note: '套餐 ¥5000' }), [money('¥5,000')])).toMatchObject([{ fatal: false }])
    expect(findLeaks(publicWith({ note: '房费 ¥5,000 已付' }), [money('¥5,000')])).toMatchObject([{ fatal: true }])
  })

  it('同一个值既是硬约束的自由文本（只提醒）又是被藏的那端（致命）：按致命算，出处写严格的那条', () => {
    const secrets = [text('LAX T2', true, '硬约束'), text('LAX T2', false, '长途「去程」')]
    expect(findLeaks(publicWith({ note: '跟 LAX T2 同款柜台' }), secrets)).toEqual([
      { value: 'LAX T2', source: '长途「去程」', where: '地点「p」 · note', fatal: true },
    ])
  })
})
