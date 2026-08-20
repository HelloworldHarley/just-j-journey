import { describe, expect, it } from 'vitest'
import type { Day, Leg, TripEvent } from '@jjj/schema'
import { buildTimeline, daySpan, isConflict } from './layout.ts'

const ev = (id: string, startMin: number, endMin: number, timeKind: TripEvent['timeKind'] = 'exact'): TripEvent => ({
  id,
  title: id,
  category: 'sight',
  startMin,
  endMin,
  timeKind,
  timeRaw: '',
  placeId: null,
  flags: [],
  transports: [],
  summary: '',
  detail: '',
  notes: [],
  variants: [],
})

const leg = (afterEventId: string | null, durationMin: number | null): Leg => ({
  id: `leg-${afterEventId}`,
  afterEventId,
  from: null,
  to: null,
  mode: 'walk',
  durationMin,
  distanceKm: null,
  geometry: null,
})

const day = (events: TripEvent[], legs: Leg[] = []): Day => ({
  index: 1,
  date: '2026-10-01',
  weekday: '周四',
  color: '#000',
  intro: '',
  events,
  legs,
})

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
    const l = rows[0]!
    expect(l.kind).toBe('leg')
    if (l.kind === 'leg') {
      expect(l.slackMin).toBeNull()
      expect(l.gapMin).toBe(0)
    }
  })

  it('有通勤段走 leg 行并算余量：空档 60 − 路上 45 = 15', () => {
    const rows = buildTimeline(day([ev('a', 600, 660), ev('b', 720, 780)], [leg('a', 45)]))
    const l = rows[1]!
    expect(l.kind).toBe('leg')
    if (l.kind === 'leg') {
      expect(l.slackMin).toBe(15)
      expect(l.gapMin).toBe(60)
    }
  })

  it('路上耗时未填 → 余量 null，不误报冲突', () => {
    const rows = buildTimeline(day([ev('a', 600, 660), ev('b', 720, 780)], [leg('a', null)]))
    const l = rows[1]!
    if (l.kind === 'leg') expect(l.slackMin).toBeNull()
    expect(isConflict(l.kind === 'leg' ? l.slackMin : null)).toBe(false)
  })

  it('模糊时段不算余量也不编空档 —— 名义窗口不是排定时刻', () => {
    const rows = buildTimeline(
      day([ev('a', 780, 1080, 'period'), ev('b', 1140, 1200)], [leg('a', 30)]),
    )
    const l = rows[1]!
    if (l.kind === 'leg') expect(l.slackMin).toBeNull()

    const rows2 = buildTimeline(day([ev('a', 780, 1080, 'period'), ev('b', 1140, 1200)]))
    const i = rows2[1]!
    if (i.kind === 'idle') {
      expect(i.labelled).toBe(false)
      expect(i.overlapMin).toBeNull()
    }
  })

  it('短空档不标注，长空档标注分钟数', () => {
    const short = buildTimeline(day([ev('a', 600, 660), ev('b', 670, 700)]))
    const long = buildTimeline(day([ev('a', 600, 660), ev('b', 840, 900)]))
    const s = short[1]!
    const l = long[1]!
    if (s.kind === 'idle') expect(s.labelled).toBe(false)
    if (l.kind === 'idle') {
      expect(l.labelled).toBe(true)
      expect(l.minutes).toBe(180)
    }
  })

  it('真实重叠记 overlapMin，不钳成 0 一了百了', () => {
    const rows = buildTimeline(day([ev('a', 600, 720), ev('b', 660, 780)]))
    const i = rows[1]!
    if (i.kind === 'idle') {
      expect(i.overlapMin).toBe(60)
      expect(i.minutes).toBe(0)
    }
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
