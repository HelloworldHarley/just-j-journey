import { describe, expect, it } from 'vitest'
import { dayBarLayout } from './day-bars.ts'

describe('dayBarLayout', () => {
  it('短行程条宽触顶 20px', () => {
    expect(dayBarLayout(3, false).barW).toBe(20)
  })
  it('5 天正常算：(104 − 3×4) / 5', () => {
    const { barW, gap } = dayBarLayout(5, false)
    expect(gap).toBe(3)
    expect(barW).toBeCloseTo((104 - 3 * 4) / 5)
  })
  it('超过 12 天缝隙收窄到 1px', () => {
    expect(dayBarLayout(13, false).gap).toBe(1)
  })
  it('一个月的长行程条宽触底 3px', () => {
    expect(dayBarLayout(31, true).barW).toBe(3)
  })
  it('窄屏块宽 80，宽屏 104', () => {
    expect(dayBarLayout(5, true).blockW).toBe(80)
    expect(dayBarLayout(5, false).blockW).toBe(104)
  })
})
