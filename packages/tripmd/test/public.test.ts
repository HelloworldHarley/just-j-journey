import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findLeaks } from '../src/leaks.ts'
import { parse } from '../src/parse.ts'
import { publicPlan } from '../src/public.ts'
import { sanitize } from '../src/sanitize.ts'
import { serialize } from '../src/serialize.ts'

const md = readFileSync(join(__dirname, 'fixtures/sanitize-full.md'), 'utf8')
const trip = () => parse(md).trip!

describe('publicPlan', () => {
  it('一条链走完：文本 = serialize(sanitize)，再解析零错误，结构块零命中，正文命中另放', () => {
    const p = publicPlan(trip())
    expect(p.md).toBe(serialize(sanitize(trip())))
    expect(p.trip).not.toBeNull()
    expect(p.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(p.fatal).toEqual([])
    expect(p.prose.every((l) => !l.inFence)).toBe(true)
  })

  it('负向对照：把完整版当公开版喂进去，结构块命中非空（抹除漏字段时就是这个形状）', () => {
    // publicPlan 自己会 sanitize，这里绕过它直接验 fatal 的口径：完整版文本对自己的黑名单必然满是命中
    const t = trip()
    const fatal = findLeaks(serialize(t), t).filter((l) => l.inFence)
    expect(fatal.length).toBeGreaterThan(0)
  })
})
