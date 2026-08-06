import { describe, expect, it } from 'vitest'
import { packLanes } from './lanes.ts'

const iv = (from: number, to: number) => ({ from, to })

describe('packLanes', () => {
  it('不重叠的区间全在第 0 道、各自独占一栏', () => {
    expect(packLanes([iv(0, 10), iv(10, 20)])).toEqual([
      { lane: 0, lanes: 1 },
      { lane: 0, lanes: 1 },
    ])
  })

  it('两个重叠摊成两栏', () => {
    expect(packLanes([iv(0, 20), iv(10, 30)])).toEqual([
      { lane: 0, lanes: 2 },
      { lane: 1, lanes: 2 },
    ])
  })

  it('按簇算栏数 —— 上午撞车不该让下午也缩成半栏', () => {
    // [0,20) 与 [10,30) 撞成一簇；[50,60) 自己一簇
    const out = packLanes([iv(0, 20), iv(10, 30), iv(50, 60)])
    expect(out.map((l) => l.lanes)).toEqual([2, 2, 1])
  })

  it('三个互相重叠摊成三栏，错开的复用第 0 道', () => {
    const out = packLanes([iv(0, 30), iv(5, 30), iv(10, 30), iv(30, 40)])
    expect(out.map((l) => l.lane)).toEqual([0, 1, 2, 0])
    expect(out[3]!.lanes).toBe(1)
  })

  it('返回值与入参同序，与书写顺序无关', () => {
    expect(packLanes([iv(10, 30), iv(0, 20)]).map((l) => l.lane)).toEqual([1, 0])
  })

  it('首尾相接不算重叠', () => {
    expect(packLanes([iv(0, 10), iv(10, 20), iv(20, 30)]).map((l) => l.lanes)).toEqual([1, 1, 1])
  })

  it('空数组不炸', () => {
    expect(packLanes([])).toEqual([])
  })
})
