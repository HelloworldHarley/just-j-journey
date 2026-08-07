import type { Day, Trip, TripEvent, TripPatchOp } from '@jjj/schema'
import type { Diagnostic } from './diagnostics.ts'
import { parse } from './parse.ts'
import { serialize } from './serialize.ts'
import { placeId as makePlaceId, placeKey } from './values.ts'

/**
 * applyPatch —— 所有写入的唯一阀门。
 *
 * 流程：结构化应用 ops → serialize → re-parse。
 * 最终返回的 trip 永远来自 re-parse —— 这意味着：
 * 1. 解析器的全部语义检查（时间格式、冲突、坐标离群）对编辑同样生效
 * 2. 中间态的派生字段（startMin、事件 id、legs）不需要手工维护，重算即可
 * 3. re-parse 出 error 级诊断 → 整批拒绝，返回原 trip 和带行号的诊断
 *
 * ops 是原子批次：要么全部生效，要么全部不生效 —— 编辑模式「保存」
 * 语义就是一批，agent 的一次 propose_patch 也是一批。
 */

export interface PatchResult {
  ok: boolean
  /** ok 时是 re-parse 后的新 trip；失败时是原 trip（未动） */
  trip: Trip
  /** re-parse 的诊断（ok 时可能有警告）；op 级错误也以 Diagnostic 形式出现在这里（line 0） */
  diagnostics: Diagnostic[]
  /** ok 时：应用后的规范 TripMD 文本，直接可写回 plan.md */
  markdown: string | null
}

interface Located {
  day: Day
  index: number
  event: TripEvent
}

function locate(trip: Trip, eventId: string): Located | null {
  for (const day of trip.days) {
    const index = day.events.findIndex((e) => e.id === eventId)
    if (index >= 0) return { day, index, event: day.events[index] as TripEvent }
  }
  return null
}

/** 地点名 → placeId。不存在则建档（坐标留空，等 enrich 或人工补）。 */
function ensurePlace(trip: Trip, name: string, category: TripEvent['category']): string {
  const key = placeKey(name)
  const hit = trip.places.find((p) => placeKey(p.name) === key)
  if (hit) return hit.id
  const created = {
    id: makePlaceId(name),
    name,
    coord: null,
    category,
    tentative: false,
    geo: { source: 'none' as const, confidence: 'unknown' as const, query: name },
  }
  trip.places.push(created)
  return created.id
}

function opError(message: string): Diagnostic {
  return { severity: 'error', line: 0, message }
}

/**
 * 事件被移走后，把**两侧**的通勤段都删掉 —— 它出发的那段，以及前一个事件指向它的那段。
 *
 * 前一段必须一起删：`to_next` 挂在事件上、按**位置**决定去向（见 serialize），
 * 光删被移事件自己的 leg，前一段就会静默改指到新的后继，却仍带着原来那段路的
 * 时长与说明 —— A(步行5分→B) B(坐车60分→C) 删掉 B 之后，会变成「A 步行 5 分到 C」。
 * 宁可留空让校验提示作者补，也不能留一条看起来合理的错数据。
 *
 * 调用时机：必须在 events.splice 之后（loc.index 此时指向新的后继）。
 */
function dropAdjacentLegs(loc: Located): void {
  const prev = loc.index > 0 ? loc.day.events[loc.index - 1] : undefined
  loc.day.legs = loc.day.legs.filter(
    (l) => l.afterEventId !== loc.event.id && l.afterEventId !== prev?.id,
  )
}

export function applyPatch(original: Trip, ops: TripPatchOp[]): PatchResult {
  if (ops.length === 0) {
    return { ok: true, trip: original, diagnostics: [], markdown: serialize(original) }
  }

  const trip = structuredClone(original)
  const errors: Diagnostic[] = []

  for (const op of ops) {
    switch (op.op) {
      case 'set_transports': {
        const loc = locate(trip, op.eventId)
        if (!loc) {
          errors.push(opError(`set_transports: 找不到事件 ${op.eventId}`))
          break
        }
        // 明细的家在顶层 trip-transports —— 事件引用了哪段就更新哪段；
        // 还没有引用（agent 给一个裸事件填票）就新建一段并挂上引用。
        // 直接塞进 event.transports 的话 serialize 不会写它，数据静默丢失。
        {
          const journey = loc.event.detailRef
            ? trip.journeys.find((j) => j.what === loc.event.detailRef)
            : undefined
          if (journey) {
            journey.transports = op.transports
          } else {
            const what = loc.event.detailRef ?? loc.event.title
            trip.journeys.push({ what, transports: op.transports })
            loc.event.detailRef = what
          }
          loc.event.transports = op.transports
        }
        break
      }

      case 'update_event': {
        const loc = locate(trip, op.eventId)
        if (!loc) {
          errors.push(opError(`update_event: 找不到事件 ${op.eventId}`))
          break
        }
        const { fields } = op
        const ev = loc.event
        if (fields.title !== undefined) ev.title = fields.title
        if (fields.timeRaw !== undefined) ev.timeRaw = fields.timeRaw
        if (fields.category !== undefined) ev.category = fields.category
        if (fields.summary !== undefined) ev.summary = fields.summary
        if (fields.costRaw !== undefined) {
          // 只设 raw —— 金额抽取是 re-parse 的事，中间态不手工算
          ev.cost =
            fields.costRaw === null
              ? undefined
              : { raw: fields.costRaw, amount: null, currency: undefined, optional: false }
        }
        if (fields.placeName !== undefined) {
          ev.placeId = fields.placeName === null ? null : ensurePlace(trip, fields.placeName, ev.category)
        }
        break
      }

      case 'add_event': {
        const day = trip.days.find((d) => d.index === op.dayIndex)
        if (!day) {
          errors.push(opError(`add_event: 找不到 Day ${op.dayIndex}`))
          break
        }
        const at =
          op.afterEventId === null
            ? 0
            : day.events.findIndex((e) => e.id === op.afterEventId) + 1
        if (op.afterEventId !== null && at === 0) {
          errors.push(opError(`add_event: Day ${op.dayIndex} 里找不到锚点事件 ${op.afterEventId}`))
          break
        }
        const e = op.event
        const created: TripEvent = {
          id: 'pending', // re-parse 重新分配
          title: e.title,
          category: e.category,
          startMin: 0,
          endMin: 0,
          timeKind: 'point',
          timeRaw: e.timeRaw,
          placeId: e.placeName ? ensurePlace(trip, e.placeName, e.category) : null,
          flags: e.flags,
          cost: e.costRaw
            ? { raw: e.costRaw, amount: null, currency: undefined, optional: false }
            : undefined,
          booking: undefined,
          transports: [],
          summary: e.summary,
          detail: '',
          notes: [],
          variants: [],
        }
        day.events.splice(at, 0, created)
        break
      }

      case 'remove_event': {
        const loc = locate(trip, op.eventId)
        if (!loc) {
          errors.push(opError(`remove_event: 找不到事件 ${op.eventId}`))
          break
        }
        loc.day.events.splice(loc.index, 1)
        dropAdjacentLegs(loc)
        break
      }

      case 'move_event': {
        const loc = locate(trip, op.eventId)
        if (!loc) {
          errors.push(opError(`move_event: 找不到事件 ${op.eventId}`))
          break
        }
        const target = trip.days.find((d) => d.index === op.dayIndex)
        if (!target) {
          errors.push(opError(`move_event: 找不到 Day ${op.dayIndex}`))
          break
        }
        loc.day.events.splice(loc.index, 1)
        dropAdjacentLegs(loc)
        const at =
          op.afterEventId === null
            ? 0
            : target.events.findIndex((e) => e.id === op.afterEventId) + 1
        if (op.afterEventId !== null && at === 0) {
          errors.push(opError(`move_event: Day ${op.dayIndex} 里找不到锚点事件 ${op.afterEventId}`))
          break
        }
        target.events.splice(at, 0, loc.event)
        break
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, trip: original, diagnostics: errors, markdown: null }
  }

  // 阀门：serialize → re-parse，解析器说了算
  const markdown = serialize(trip)
  const reparsed = parse(markdown)
  const hasError = reparsed.diagnostics.some((d) => d.severity === 'error')

  if (hasError || !reparsed.trip) {
    return { ok: false, trip: original, diagnostics: reparsed.diagnostics, markdown: null }
  }
  return { ok: true, trip: reparsed.trip, diagnostics: reparsed.diagnostics, markdown }
}
