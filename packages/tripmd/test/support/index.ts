import {
  ConstraintSchema,
  DaySchema,
  EventSchema,
  LegSchema,
  PlaceSchema,
  TransportSchema,
  TripSchema,
  type Constraint,
  type Day,
  type Leg,
  type Place,
  type Transport,
  type Trip,
  type TripEvent,
} from '@jjj/schema'
import { formatMinutes } from '../../src/values.ts'
import { parse } from '../../src/parse.ts'
import type { Diagnostic } from '../../src/diagnostics.ts'

/**
 * 测试共用的零件 —— 全仓测试从这里造对象，不再各写一份。
 *
 * 工厂只填必填字段的最小值，其余交给 schema 的默认值；每个对象都过一遍 `Schema.parse`：
 * schema 加了必填字段或改了枚举，工厂当场报错，测试不会再悄悄和 schema 脱节
 * （此前 7 份手写工厂里已有 4 份缺字段、1 份用了不存在的 timeKind，typecheck 看不到测试才没发现）。
 *
 * 浏览器端的测试经 `@jjj/tripmd/test-support` 引用；只给测试用，`tools/arch/boundary.test.ts` 锁住生产代码不许引它。
 */

/** 事件：缺省 10:00–11:00 的景点 */
export function makeEvent(over: Partial<TripEvent> & Pick<TripEvent, 'id'>): TripEvent {
  return EventSchema.parse({
    title: over.id,
    category: 'sight',
    startMin: 600,
    endMin: 660,
    timeKind: 'exact',
    timeRaw: '',
    placeId: null,
    ...over,
  })
}

/** 两事件之间（或开场）的一段路：缺省步行、时长未知 */
export function makeLeg(over: Partial<Leg> = {}): Leg {
  return LegSchema.parse({
    id: `leg-${over.afterEventId ?? 'open'}`,
    afterEventId: null,
    from: null,
    to: null,
    mode: 'walk',
    durationMin: null,
    distanceKm: null,
    geometry: null,
    ...over,
  })
}

/** 一天：缺省 Day 1 · 2026-10-01 */
export function makeDay(over: Partial<Day> = {}): Day {
  return DaySchema.parse({
    index: 1,
    date: '2026-10-01',
    weekday: '周四',
    color: '#000000',
    events: [],
    legs: [],
    ...over,
  })
}

/** 地点：缺省景点；有坐标就当作作者手写 */
export function makePlace(over: Partial<Place> & Pick<Place, 'id'>): Place {
  const coord = over.coord ?? null
  return PlaceSchema.parse({
    name: over.id,
    coord,
    category: 'sight',
    geo: { source: coord ? 'authored' : 'none', confidence: coord ? 'high' : 'unknown' },
    ...over,
  })
}

/** 一段长途交通：缺省航班 */
export function makeTransport(over: Partial<Transport> = {}): Transport {
  return TransportSchema.parse({ mode: 'flight', ...over })
}

/** 硬约束：`at` 由日期与分钟拼出，和解析器产出的形状一致 */
export function makeConstraint(over: Partial<Constraint> & Pick<Constraint, 'kind' | 'date' | 'minute' | 'label'>): Constraint {
  return ConstraintSchema.parse({ at: `${over.date} ${formatMinutes(over.minute)}`, ...over })
}

/** 行程：缺省 2026-10-01 ~ 10-05、UTC、私有 */
export function makeTrip(over: Partial<Trip> = {}): Trip {
  return TripSchema.parse({
    id: 't',
    title: 'T',
    destination: 'X',
    timezone: 'UTC',
    dates: { start: '2026-10-01', end: '2026-10-05' },
    ...over,
  })
}

/**
 * 在样例文本上改一处：锚点找不到就抛错。
 * 直接写 `md.replace(a, b)` 时锚点一旦变了，替换静默失败、测试照样绿 —— 这个函数让它红。
 */
export function edit(src: string, from: string, to: string): string {
  if (!src.includes(from)) throw new Error(`edit：样例里找不到锚点「${from}」`)
  return src.replace(from, to)
}

/** 相对基准文本「新增」的诊断 —— 证明一处改动产生（或没产生）了哪些诊断 */
export function newDiags(base: string, md: string): Diagnostic[] {
  const key = (d: Diagnostic): string => `${d.severity}:${d.message}`
  const seen = new Set(parse(base).diagnostics.map(key))
  return parse(md).diagnostics.filter((d) => !seen.has(key(d)))
}
