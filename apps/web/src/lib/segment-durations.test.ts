import { describe, expect, it } from 'vitest'
import type { Transport } from '@jjj/schema'
import { segFlyDurations } from './segment-durations.ts'

const t = (over: Partial<Transport>): Transport => ({
  mode: 'flight',
  arrDayOffset: 0,
  durationMin: null,
  stops: [],
  legs: [],
  ...over,
})

const stop = (over: Partial<Transport['stops'][number]>): Transport['stops'][number] => ({
  legMin: null,
  waitMin: null,
  ...over,
})

describe('segFlyDurations', () => {
  it('直飞无全程时长：单段 null（UI 画等宽）', () => {
    expect(segFlyDurations(t({}))).toEqual([null])
  })

  it('直飞有全程时长：全给唯一一段', () => {
    expect(segFlyDurations(t({ durationMin: 715 }))).toEqual([715])
  })

  it('缺任何一个 wait 就不均分 —— 剩余时间无从谈起', () => {
    const r = segFlyDurations(
      t({ durationMin: 715, stops: [stop({ waitMin: null })] }),
    )
    expect(r).toEqual([null, null])
  })

  it('均分 + 末段收余数：各段与停留加起来恒等于全程', () => {
    // 715 全程 − 100 停留 = 615 行进，两段均分 = 307 + 308
    const r = segFlyDurations(t({ durationMin: 715, stops: [stop({ waitMin: 100 })] }))
    expect(r).toEqual([307, 308])
    expect(r.reduce((a, m) => a! + m!, 0)! + 100).toBe(715)
  })

  it('作者已填的 leg 是锚点，只有未填的段参与均分', () => {
    // 800 − 60(wait) − 500(已填) = 240 给剩下 1 段
    const r = segFlyDurations(
      t({ durationMin: 800, stops: [stop({ legMin: 500, waitMin: 60 })] }),
    )
    expect(r).toEqual([500, 240])
  })

  it('三段两停，末段吃到不能整除的余数', () => {
    // 1000 − 2×60 = 880 行进，三段 → 293 + 293 + 294
    const r = segFlyDurations(
      t({ durationMin: 1000, stops: [stop({ waitMin: 60 }), stop({ waitMin: 60 })] }),
    )
    expect(r).toEqual([293, 293, 294])
    expect(r.reduce((a, m) => a! + m!, 0)! + 120).toBe(1000)
  })

  it('已填段超出全程（数据自相矛盾）：不硬造负数，未填段保持 null', () => {
    const r = segFlyDurations(
      t({ durationMin: 400, stops: [stop({ legMin: 500, waitMin: 60 })] }),
    )
    expect(r).toEqual([500, null])
  })
})
