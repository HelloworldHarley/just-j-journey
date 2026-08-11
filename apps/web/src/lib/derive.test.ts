import { describe, expect, it } from 'vitest'
import type { Reference } from '@jjj/schema'
import { isBudgetRef } from './derive.ts'

const ref = (id: string, title: string): Reference => ({ id, title, markdown: '' })

describe('isBudgetRef', () => {
  it('id 为 budget 或标题含「预算」/budget 的附录归预算页', () => {
    expect(isBudgetRef(ref('budget', '随便'))).toBe(true)
    expect(isBudgetRef(ref('r1', '预算与点数策略'))).toBe(true)
    expect(isBudgetRef(ref('r2', 'Budget notes'))).toBe(true)
  })
  it('其余附录归资料页', () => {
    expect(isBudgetRef(ref('r3', '打包清单'))).toBe(false)
  })
})
