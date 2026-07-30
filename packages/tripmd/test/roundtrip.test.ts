import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from '../src/parse.ts'
import { serialize } from '../src/serialize.ts'

/**
 * 语义幂等 —— hub-and-spoke 架构的地基。
 *
 *     parse(serialize(parse(md)))  深等于  parse(md)
 *
 * 这条不成立，「UI 编辑 → 写回 TripMD → 重新导入」的循环就会越转越烂。
 * 注意锁的是语义（Trip 对象深等），不是字节：注释、排版、区块顺序允许丢。
 */

const FIXTURES = ['seattle-2026-10', '_example'] as const

const load = (dir: string) =>
  readFileSync(join(__dirname, '../../../apps/web/public/data', dir, 'plan.md'), 'utf8')

describe('语义幂等', () => {
  for (const dir of FIXTURES) {
    it(`${dir}: parse ∘ serialize ∘ parse = parse`, () => {
      const once = parse(load(dir))
      expect(once.trip, `${dir} 应能解析`).not.toBeNull()

      const md2 = serialize(once.trip!)
      const twice = parse(md2)
      // 序列化产物必须零错误可解析（警告允许：如自动建档地点提示消失/出现）
      expect(
        twice.diagnostics.filter((d) => d.severity === 'error'),
        `serialize 产物应零错误\n----\n${md2.slice(0, 2000)}`,
      ).toEqual([])
      expect(twice.trip).not.toBeNull()

      expect(twice.trip).toEqual(once.trip)
    })

    it(`${dir}: 二次往返字节稳定（serialize ∘ parse 是投影）`, () => {
      const once = parse(load(dir))
      const md2 = serialize(once.trip!)
      const md3 = serialize(parse(md2).trip!)
      expect(md3).toBe(md2)
    })
  }
})
