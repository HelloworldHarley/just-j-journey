import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parse, publicPlan, routableLegs, setFrontmatterScalar } from '@jjj/tripmd'
import { stagePublic } from './stage-public.ts'

/**
 * 公开版暂存目录的生成 —— 拿合成 fixture 拼一个数据目录：一份 public（带路网缓存）、一份 private、一份 `_` 示范、名片 + 头像。
 * 路网缓存里三条记录：一条对得上公开版 trip（留）、一条按完整版民宿 id 与精确坐标算的（丢 —— 这就是门牌从旁路泄漏的那条）、一条无人认领（丢）。
 */
const FIXTURE = readFileSync(join(import.meta.dirname, '../../packages/tripmd/test/fixtures/sanitize-full.md'), 'utf8')
/** 只含两个点的一小段 polyline5，够画一条线 */
const GEOM = '_p~iF~ps|U_ulLnnqC'
let src: string
let stage: string

beforeAll(() => {
  src = realpathSync(mkdtempSync(join(tmpdir(), 'jjj-stage-src-')))
  stage = join(realpathSync(mkdtempSync(join(tmpdir(), 'jjj-stage-out-'))), 'public')
  const full = parse(FIXTURE).trip!
  const pub = publicPlan(full).trip!
  const kept = routableLegs(pub)[0]!
  const leaked = routableLegs(full).find((n) => n.key !== kept.key) ?? routableLegs(full)[0]!
  const doc = {
    version: 1,
    routes: {
      [kept.key]: { poly: GEOM, from: kept.from.coord, to: kept.to.coord },
      [leaked.key]: { poly: GEOM, from: leaked.from.coord, to: leaked.to.coord },
      'drive|p-nobody|p-nowhere': { poly: GEOM, from: [0, 0], to: [1, 1] },
    },
  }
  mkdirSync(join(src, 'pub'))
  writeFileSync(join(src, 'pub', 'plan.md'), FIXTURE) // fixture 自带 visibility: public
  writeFileSync(join(src, 'pub', 'geometry.json'), JSON.stringify(doc))
  writeFileSync(join(src, 'pub', 'calendar.ics'), 'BEGIN:VCALENDAR')
  mkdirSync(join(src, 'priv'))
  writeFileSync(join(src, 'priv', 'plan.md'), setFrontmatterScalar(FIXTURE, 'visibility', null))
  mkdirSync(join(src, '_demo'))
  writeFileSync(join(src, '_demo', 'plan.md'), FIXTURE)
  writeFileSync(join(src, 'space.md'), '---\nname: 测试\navatar: avatar.png\ntips:\n  - {label: 微信, image: tips/wx.png}\n---\n')
  writeFileSync(join(src, 'avatar.png'), 'png')
  mkdirSync(join(src, 'tips'))
  writeFileSync(join(src, 'tips', 'wx.png'), 'png')
  writeFileSync(join(src, 'stray.txt'), 'not yours')
})
afterAll(() => {
  rmSync(src, { recursive: true, force: true })
  rmSync(join(stage, '..'), { recursive: true, force: true })
})

describe('stagePublic', () => {
  it('只收 public 且非示范的行程；manifest 只有它；名片与引用的文件随行；ics 与杂物不带', () => {
    const r = stagePublic(src, stage)
    expect(r.staged.map((t) => t.id)).toEqual(['pub'])
    expect(r.skipped).toEqual(['priv'])
    expect(JSON.parse(readFileSync(join(stage, 'manifest.json'), 'utf8'))).toEqual({ trips: [{ id: 'pub', visibility: 'public' }] })
    expect(readdirSync(stage).sort()).toEqual(['avatar.png', 'manifest.json', 'pub', 'space.md', 'tips'])
    expect(readdirSync(join(stage, 'pub')).sort()).toEqual(['geometry.json', 'plan.md'])
    expect(existsSync(join(stage, 'tips', 'wx.png'))).toBe(true)
  })
  it('plan.md 是抹过的；geometry.json 只剩对得上公开版的那一条，民宿那条与孤儿都没了', () => {
    stagePublic(src, stage)
    const md = readFileSync(join(stage, 'pub', 'plan.md'), 'utf8')
    expect(md).not.toMatch(/price:|number:|seat:|trip-constraints/)
    const geo = JSON.parse(readFileSync(join(stage, 'pub', 'geometry.json'), 'utf8')) as { routes: Record<string, unknown> }
    const [staged] = stagePublic(src, stage).staged
    expect(Object.keys(geo.routes)).toHaveLength(1)
    expect(staged!.routes).toEqual({ kept: 1, total: 3 })
    // 完整版民宿的英文名（门牌形态）不能出现在任何暂存文件里
    for (const f of ['pub/plan.md', 'pub/geometry.json']) {
      expect(readFileSync(join(stage, f), 'utf8'), f).not.toMatch(/777 Made Up Road|made-up-road/i)
    }
  })
  it('数据目录不存在：抛可读的错', () => {
    expect(() => stagePublic(join(src, 'nope'), stage)).toThrow('数据目录不存在')
  })
})
