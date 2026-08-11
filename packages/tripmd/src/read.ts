import {
  CATEGORY_ALIASES,
  CATEGORY_KEYS,
  FLAG_ALIASES,
  FLAG_KEYS,
  resolveCategory,
  resolveFlag,
  type CategoryKey,
  type FlagKey,
} from '@jjj/schema'
import { parse as parseYaml, YAMLParseError } from 'yaml'
import { DiagnosticBag, suggest, suggestEnum } from './diagnostics.ts'

/**
 * 字段读取层 —— YAML 到干净标量的第一跳，所有块共用。
 *
 * 这里的每个函数都带着诊断责任：认不出的值要么给建议要么列可选值，
 * 绝不静默兜底（booking status 拼错兜成 required 会把「已订」读反）。
 */

export type Rec = Record<string, unknown>

/** 解析围栏块里的 YAML，把 yaml 库报的行号平移到文件真实行号。 */
export function yamlOf(
  bag: DiagnosticBag,
  fenceLine: number,
  content: string,
  what: string,
): unknown {
  if (!content.trim()) return null
  try {
    return parseYaml(content)
  } catch (e) {
    const line = e instanceof YAMLParseError ? fenceLine + (e.linePos?.[0]?.line ?? 1) : fenceLine
    const msg = e instanceof Error ? e.message.split('\n')[0] : String(e)
    bag.error(line, `${what} 的 YAML 语法错误：${msg}`)
    return null
  }
}

export function asRecord(v: unknown): Rec | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Rec) : null
}

export function str(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined
  const s = String(v).trim()
  return s === '' ? undefined : s
}

export function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export function readCategory(
  bag: DiagnosticBag,
  line: number,
  raw: unknown,
  where: string,
  fallback: CategoryKey | null = null,
): CategoryKey | null {
  const s = str(raw)
  if (!s) {
    if (fallback) return fallback
    bag.error(line, `${where} 缺少必需字段 \`category\``, `可选值：${CATEGORY_KEYS.join(' / ')}`)
    return null
  }
  const resolved = resolveCategory(s)
  if (resolved) return resolved
  const guess = suggestEnum(s, CATEGORY_KEYS, CATEGORY_ALIASES)
  bag.error(
    line,
    `category "${s}" 无效`,
    guess ? `是否想写 \`${guess}\`？` : `可选值：${CATEGORY_KEYS.join(' / ')}`,
  )
  return fallback
}

export function readFlags(bag: DiagnosticBag, line: number, raw: unknown): FlagKey[] {
  if (raw === undefined || raw === null) return []
  const list = Array.isArray(raw) ? raw : String(raw).split(/[,，]/)
  const out: FlagKey[] = []
  for (const item of list) {
    const s = str(item)
    if (!s) continue
    const f = resolveFlag(s)
    if (f) {
      if (!out.includes(f)) out.push(f)
      continue
    }
    const guess = suggestEnum(s, FLAG_KEYS, FLAG_ALIASES)
    bag.warn(
      line,
      `flag "${s}" 无法识别，已忽略`,
      guess ? `是否想写 \`${guess}\`？` : `可选值：${FLAG_KEYS.join(' / ')}`,
    )
  }
  return out
}

/**
 * 拼错的字段名必须报出来 —— `platfrom: 万豪` 静默吞掉的结果是
 * 卡片渲染「待填」而作者以为填了。**每一种块、每一层子记录都要过这道检查**，
 * 不能只有前置块有 —— 事件上的 `flgs:` 静默消失和 `platfrom:` 是同一种病。
 */
export function checkKeys(
  bag: DiagnosticBag,
  rec: Rec,
  allowed: readonly string[],
  line: number,
  block: string,
): void {
  for (const key of Object.keys(rec)) {
    if (allowed.includes(key)) continue
    const guess = suggest(key, [...allowed])
    bag.warn(
      line,
      `\`${block}\` 的字段 \`${key}\` 无法识别，已忽略`,
      guess ? `是否想写 \`${guess}\`？` : `可用字段：${allowed.join(' / ')}`,
    )
  }
}

// 白名单 = 对应读取代码接受的全部键（含别名与迁移错误键 ——
// 迁移键留在名单里，让专门的迁移报错说话，不叠一条「无法识别」）。
export const RESERVATION_KEYS = ['what', 'item', 'name', 'platform', 'brand', 'company', 'from', 'to', 'cost', 'refund', 'cancellation', 'note'] as const
export const STAY_KEYS = [...RESERVATION_KEYS, 'place', 'stars', 'star', 'room', 'parking', 'breakfast'] as const
export const RENTAL_KEYS = [...RESERVATION_KEYS, 'pickup', 'dropoff', 'mileage', 'miles', 'insurance'] as const
export const JOURNEY_KEYS = ['what', 'name', 'cost', 'transport', 'transports'] as const
export const EVENT_KEYS = ['time', 'category', 'place', 'flags', 'cost', 'booking', 'detail', 'notes', 'warnings', 'to_next', 'toNext', 'stay', 'transport', 'transports'] as const
export const DAY_KEYS = ['theme', 'sunrise', 'sunset', 'lodging', 'lodging_note'] as const
export const PLACE_KEYS = ['name', 'en', 'nameEn', 'coord', 'category', 'tentative', 'gmaps_place_id', 'gmapsPlaceId', 'url', 'note'] as const
export const CONSTRAINT_KEYS = ['kind', 'at', 'label', 'note'] as const
export const BOOKING_KEYS = ['status', 'deadline', 'note'] as const
export const TO_NEXT_KEYS = ['mode', 'minutes', 'min', 'km', 'label', 'note'] as const
export const TRANSPORT_KEYS = ['traveler', 'who', 'mode', 'carrier', 'airline', 'number', 'flight_no', 'flightNo', 'no', 'from', 'to', 'dep_date', 'depDate', 'dep_time', 'depTime', 'dep', 'arr_time', 'arrTime', 'arr', 'arr_date', 'arrDate', 'arr_day_offset', 'arrDayOffset', 'price', 'fare', 'duration', 'cabin', 'class', 'seat', 'baggage', 'through_check', 'throughCheck', 'baggage_through', 'refund', 'change_policy', 'change', 'stops', 'note'] as const
export const STOP_KEYS = ['airport', 'station', 'place', 'dep_airport', 'dep_station', 'dep_place', 'arr_time', 'arr', 'dep_time', 'dep', 'arr_date', 'dep_date', 'leg', 'wait'] as const
