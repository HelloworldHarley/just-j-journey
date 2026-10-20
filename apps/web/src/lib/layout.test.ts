import { describe, expect, it } from 'vitest'
import type { Day, Leg, TripEvent } from '@jjj/schema'
import { buildTimeline, daySpan, isConflict } from './layout.ts'
import { makeDay, makeEvent, makeLeg } from '@jjj/tripmd/test-support'

const ev = (id: string, startMin: number, endMin: number, timeKind: TripEvent['timeKind'] = 'exact'): TripEvent =>
  makeEvent({ id, startMin, endMin, timeKind })

const leg = (afterEventId: string | null, durationMin: number | null): Leg =>
  makeLeg({ id: `leg-${afterEventId}`, afterEventId, durationMin })

const day = (events: TripEvent[], legs: Leg[] = []): Day => makeDay({ events, legs })

describe('buildTimeline', () => {
  it('行序：事件-连接-事件，首事件之前没有连接行', () => {
    const rows = buildTimeline(day([ev('a', 600, 660), ev('b', 720, 780)]))
    expect(rows.map((r) => r.kind)).toEqual(['event', 'idle', 'event'])
  })

  it('开场段排在首事件之前，且不多出一张事件卡', () => {
    const rows = buildTimeline(day([ev('a', 600, 660), ev('b', 720, 780)], [leg(null, 20)]))
    expect(rows.map((r) => r.kind)).toEqual(['leg', 'event', 'idle', 'event'])
    expect(rows.filter((r) => r.kind === 'event')).toHaveLength(2)
  })

  it('开场段不算余量 —— 前面没有事件的结束时刻可减', () => {
    const rows = buildTimeline(day([ev('a', 600, 660)], [leg(null, 20)]))
    expect(rows[0]).toMatchObject({ kind: 'leg', slackMin: null, gapMin: 0 })
  })

  it('有通勤段走 leg 行并算余量：空档 60 − 路上 45 = 15', () => {
    const rows = buildTimeline(day([ev('a', 600, 660), ev('b', 720, 780)], [leg('a', 45)]))
    expect(rows[1]).toMatchObject({ kind: 'leg', slackMin: 15, gapMin: 60 })
  })

  it('路上耗时未填 → 余量 null，不误报冲突', () => {
    const rows = buildTimeline(day([ev('a', 600, 660), ev('b', 720, 780)], [leg('a', null)]))
    expect(rows[1]).toMatchObject({ kind: 'leg', slackMin: null })
    expect(isConflict(null)).toBe(false)
  })

  it('模糊时段不算余量也不编空档 —— 名义窗口不是排定时刻', () => {
    const rows = buildTimeline(
      day([ev('a', 780, 1080, 'period'), ev('b', 1140, 1200)], [leg('a', 30)]),
    )
    expect(rows[1]).toMatchObject({ kind: 'leg', slackMin: null })

    const rows2 = buildTimeline(day([ev('a', 780, 1080, 'period'), ev('b', 1140, 1200)]))
    expect(rows2[1]).toMatchObject({ kind: 'idle', labelled: false, overlapMin: null })
  })

  it('短空档不标注，长空档标注分钟数', () => {
    const short = buildTimeline(day([ev('a', 600, 660), ev('b', 670, 700)]))
    const long = buildTimeline(day([ev('a', 600, 660), ev('b', 840, 900)]))
    expect(short[1]).toMatchObject({ kind: 'idle', labelled: false })
    expect(long[1]).toMatchObject({ kind: 'idle', labelled: true, minutes: 180 })
  })

  it('真实重叠记 overlapMin，不钳成 0 一了百了', () => {
    const rows = buildTimeline(day([ev('a', 600, 720), ev('b', 660, 780)]))
    expect(rows[1]).toMatchObject({ kind: 'idle', overlapMin: 60, minutes: 0 })
  })
})

describe('isConflict', () => {
  it('只有负余量算冲突 —— 0 是基准不是异常', () => {
    expect(isConflict(-1)).toBe(true)
    expect(isConflict(0)).toBe(false)
    expect(isConflict(15)).toBe(false)
    expect(isConflict(null)).toBe(false)
  })
})

describe('daySpan', () => {
  it('取有时刻事件的最早开始与最晚结束', () => {
    expect(daySpan(day([ev('a', 600, 660), ev('b', 720, 1300)]))).toEqual({ from: 600, to: 1300 })
  })

  it('全天事件不算 —— 否则轴被 00:00–24:00 撑开', () => {
    expect(daySpan(day([ev('a', 0, 1440, 'allday'), ev('b', 720, 780)]))).toEqual({
      from: 720,
      to: 780,
    })
  })

  it('只有全天事件时返回 null', () => {
    expect(daySpan(day([ev('a', 0, 1440, 'allday')]))).toBeNull()
  })
})
