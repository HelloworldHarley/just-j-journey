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
        loc.event.transports = op.transports
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
        // 该事件出发的通勤段一并删；指向它的前一段保留（内容判断留给作者/agent）
        loc.day.legs = loc.day.legs.filter((l) => l.afterEventId !== op.eventId)
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
        // 换了位置，原 to_next 的去向大概率不再成立 —— 删掉，让校验提示作者补
        loc.day.legs = loc.day.legs.filter((l) => l.afterEventId !== op.eventId)
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
