import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Trip } from '@trip-atlas/schema'
import { applyPatch } from '../src/patch.ts'
import { parse } from '../src/parse.ts'

/**
 * TripPatch 阀门测试。
 * 五种 op 都要过：前两种是当前 UI 用的，后三种是增删移与 agent 的预留接口。
 */

const md = readFileSync(join(__dirname, '../../../data/seattle-2026-10/plan.md'), 'utf8')

let trip: Trip
beforeEach(() => {
  trip = parse(md).trip!
})

const day1 = () => trip.days[0]!
const arrival = () => day1().events.find((e) => e.category === 'flight')!
const dinner = () => day1().events.find((e) => e.title.includes('晚餐'))!

describe('set_flight', () => {
  it('填入航班信息并出现在写回文本里', () => {
    const r = applyPatch(trip, [
      {
        op: 'set_flight',
        eventId: arrival().id,
        flight: {
          airline: '达美',
          flightNo: 'DL281',
          from: 'PVG T1',
          to: 'SEA',
          depTime: '10:15',
          arrTime: '13:11',
          arrDayOffset: 0,
          durationMin: 715,
          baggage: '2 件 23kg',
          stops: [{ airport: 'ICN', waitMin: 130 }],
          note: undefined,
        },
      },
    ])
    expect(r.ok).toBe(true)
    const f = r.trip.days[0]!.events.find((e) => e.category === 'flight')!.flight!
    expect(f.flightNo).toBe('DL281')
    expect(f.durationMin).toBe(715)
    expect(f.stops).toEqual([{ airport: 'ICN', waitMin: 130 }])
    expect(r.markdown).toContain('flight_no: DL281')
    expect(r.markdown).toContain('duration: "11h55m"')
    // 写回文本再导入，深等 —— 编辑结果与文件真相一致
    expect(parse(r.markdown!).trip).toEqual(r.trip)
  })

  it('非航班事件拒绝', () => {
    const r = applyPatch(trip, [
      { op: 'set_flight', eventId: dinner().id, flight: { arrDayOffset: 0, durationMin: null, stops: [] } },
    ])
    expect(r.ok).toBe(false)
    expect(r.trip).toBe(trip) // 原对象原样返回
  })
})

describe('update_event', () => {
  it('改餐厅：标题+地点一起换，id 不变（收藏不丢）', () => {
    const before = dinner()
    const r = applyPatch(trip, [
      {
        op: 'update_event',
        eventId: before.id,
        fields: { title: '晚餐 · Ivar’s', placeName: "Ivar's Acres of Clams" },
      },
    ])
    expect(r.ok).toBe(true)
    const after = r.trip.days[0]!.events.find((e) => e.id === before.id)
    expect(after?.title).toContain('Ivar')
    // 新地点自动建档
    expect(r.trip.places.some((p) => p.name === "Ivar's Acres of Clams")).toBe(true)
  })

  it('非法时间被阀门拦下，返回带行号诊断', () => {
    const r = applyPatch(trip, [
      { op: 'update_event', eventId: dinner().id, fields: { timeRaw: '下午三点半' } },
    ])
    expect(r.ok).toBe(false)
    expect(r.trip).toBe(trip)
    const err = r.diagnostics.find((d) => d.severity === 'error')
    expect(err?.message).toContain('无法解析')
    expect(err?.line).toBeGreaterThan(0) // 行号指向 serialize 产物中的位置
  })

  it('清除费用', () => {
    const withCost = day1().events.find((e) => e.cost)!
    const r = applyPatch(trip, [
      { op: 'update_event', eventId: withCost.id, fields: { costRaw: null } },
    ])
    expect(r.ok).toBe(true)
    expect(r.trip.days[0]!.events.find((e) => e.id === withCost.id)?.cost).toBeUndefined()
  })
})

describe('预留接口：add / remove / move', () => {
  it('add_event 插入指定位置并由 re-parse 分配 id', () => {
    const anchor = arrival()
    const r = applyPatch(trip, [
      {
        op: 'add_event',
        dayIndex: 1,
        afterEventId: anchor.id,
        event: { title: '机场买咖啡', category: 'cafe', timeRaw: '15:00', flags: [], summary: '' },
      },
    ])
    expect(r.ok).toBe(true)
    const events = r.trip.days[0]!.events
    const i = events.findIndex((e) => e.title === '机场买咖啡')
    expect(i).toBe(events.findIndex((e) => e.category === 'flight') + 1)
    expect(events[i]!.id).not.toBe('pending')
  })

  it('remove_event 删事件并带走它的通勤段', () => {
    const victim = day1().events[2]!
    const legCountBefore = day1().legs.length
    const r = applyPatch(trip, [{ op: 'remove_event', eventId: victim.id }])
    expect(r.ok).toBe(true)
    expect(r.trip.days[0]!.events.some((e) => e.title === victim.title)).toBe(false)
    expect(r.trip.days[0]!.legs.length).toBeLessThan(legCountBefore)
  })

  it('move_event 跨天移动', () => {
    const victim = dinner()
    const r = applyPatch(trip, [
      { op: 'move_event', eventId: victim.id, dayIndex: 2, afterEventId: null },
    ])
    expect(r.ok).toBe(true)
    expect(r.trip.days[0]!.events.some((e) => e.title === victim.title)).toBe(false)
    expect(r.trip.days[1]!.events[0]!.title).toBe(victim.title)
  })

  it('找不到事件 → 整批拒绝（原子性）', () => {
    const r = applyPatch(trip, [
      { op: 'update_event', eventId: dinner().id, fields: { title: '改了' } },
      { op: 'remove_event', eventId: 'no-such-id' },
    ])
    expect(r.ok).toBe(false)
    expect(r.trip).toBe(trip) // 第一条也没生效
  })
})
