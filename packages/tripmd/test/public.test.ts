import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from '../src/parse.ts'
import { publicPlan } from '../src/public.ts'
import { sanitize } from '../src/sanitize.ts'
import { serialize } from '../src/serialize.ts'
import { edit } from './support/index.ts'

const md = readFileSync(join(__dirname, 'fixtures/sanitize-full.md'), 'utf8')
const trip = (src = md) => parse(src).trip!

describe('publicPlan', () => {
  it('一条链走完：文本 = serialize(sanitize)，再解析零错误，零致命命中，可以发', () => {
    const p = publicPlan(trip())
    expect(p.md).toBe(serialize(sanitize(trip()).trip))
    expect(p.trip).not.toBeNull()
    expect(p.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(p.fatal).toEqual([])
    expect(p.problem).toBeNull()
  })

  it('对已经公开的行程幂等：公开版再走一遍链，文本不变、零致命命中 —— 示范行程就是这样被 build:public 再处理一次的', () => {
    const once = publicPlan(trip())
    const twice = publicPlan(once.trip!)
    expect(twice.fatal).toEqual([])
    expect(twice.md).toBe(once.md)
    // 公开副本里去程只剩到达端、返程只剩出发端：只写了一端，不再提醒（否则演示站每次构建都报一遍）
    expect(twice.reminders).toEqual([])
  })

  it('作者在结构字段里重复写了抹掉的值：不能发，problem 写明公开版里的位置和完整版里的出处', () => {
    const repeated = edit(md, '指定席选右侧', '指定席选右侧（座位号跟去程一样 36C）')
    const inNotes = edit(repeated, 'to_next: {mode: bus, minutes: 20, label: 206 路到五条坂}', 'notes:\n  - 去程 DL7 的行李牌别丢\nto_next: {mode: bus, minutes: 20, label: 206 路到五条坂}')
    const p = publicPlan(trip(inNotes), { label: 'x' })
    expect(p.fatal.map((l) => l.where)).toEqual(['Day 2 · 「新干线去京都」 · notes[0]'])
    expect(p.problem).toContain('Day 2 · 「新干线去京都」 · notes[0]：「DL7」（完整版里在 长途「去程」 · 第 1 条交通 · number）')
    // 正文里的那一处只提醒
    expect(p.warnings.map((l) => l.where)).toContain('Day 2 · 「新干线去京都」 · summary')
  })

  it('提醒：首日或末日的长途两端都写了却没藏 —— 写了 hide 就安静', () => {
    expect(publicPlan(trip()).reminders).toEqual([])
    const bare = trip(edit(edit(md, 'to: HND T3, hide: from,', 'to: HND T3,'), 'to: SFO, hide: to,', 'to: SFO,'))
    const r = publicPlan(bare).reminders
    expect(r).toHaveLength(2)
    expect(r[0]).toContain('长途「去程」第 1 条交通（我）在首日')
    expect(r[1]).toContain('长途「返程」第 1 条交通在末日')
  })

  it('提醒：接驳卡落在被藏那端（卡的时刻等于被藏的出发时刻）却挂着地点 —— 落在目的地那端的卡不报', () => {
    expect(publicPlan(trip()).reminders).toEqual([]) // 抵达卡 15:30 落在到达端（公开），不报
    const atHome = trip(edit(md, 'time: "15:30"\ncategory: flight\nplace: 羽田机场\ndetail: 去程', 'time: "08:05"\ncategory: flight\nplace: 羽田机场\ndetail: 去程'))
    expect(publicPlan(atHome).reminders).toEqual([expect.stringContaining('Day 1「落地」落在被藏的那一端，却挂着地点「羽田机场」')])
    // 时段卡：只要时段盖住被藏的时刻就算（07:00–08:30 盖住 08:05 起飞）
    const window = trip(edit(md, 'time: "15:30"\ncategory: flight\nplace: 羽田机场\ndetail: 去程', 'time: 07:00–08:30\ncategory: flight\nplace: 羽田机场\ndetail: 去程'))
    expect(publicPlan(window).reminders).toHaveLength(1)
  })
})
