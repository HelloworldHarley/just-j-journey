import {
  PERIOD_WINDOWS,
  parseClock,
  resolvePeriod,
  type PeriodKey,
  type TimeKind,
} from '@jjj/schema'

/** 全角 → 半角，顺带收敛空白。LLM 中英混排时全角符号很常见。 */
export function normalizeText(s: string): string {
  return s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 地点名匹配键：归一化 + 小写 + 去掉分隔符差异 */
export function placeKey(name: string): string {
  return normalizeText(name).toLowerCase().replace(/[\s./|·・、-]+/g, '')
}

/** FNV-1a → base36。用内容哈希而非序号，重新导入后 id 保持稳定。 */
export function stableId(prefix: string, key: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `${prefix}${h.toString(36).padStart(7, '0').slice(-7)}`
}

/** 优先用可读 slug，全 CJK 时退回哈希 —— 调试时 `p-space-needle` 比 `p1a2b3c4` 好认得多。 */
export function placeId(name: string, nameEn?: string): string {
  const base = (nameEn ?? name).toLowerCase()
  const slug = base
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug.length >= 3 ? `p-${slug}` : stableId('p-', placeKey(name))
}

// ── 时间 ────────────────────────────────────────────────────────

export interface TimeSpec {
  startMin: number
  endMin: number
  kind: TimeKind
}

export type TimeParse =
  | { ok: true; value: TimeSpec }
  | { ok: false; message: string; hint?: string }

const ALLDAY = /^(all[\s-]?day|allday|全天|整天)$/i
const RANGE_SEP = /\s*[-–—~～]\s*|\s+(?:至|到)\s+/

export function parseTimeSpec(rawInput: string): TimeParse {
  const raw = normalizeText(String(rawInput))
  if (!raw) {
    return { ok: false, message: 'time 为空', hint: '写成 18:25–18:55 / 18:25 / afternoon / allday' }
  }

  if (ALLDAY.test(raw)) {
    return { ok: true, value: { startMin: 0, endMin: 1440, kind: 'allday' } }
  }

  const period = resolvePeriod(raw)
  if (period) {
    const [s, e] = PERIOD_WINDOWS[period as PeriodKey]
    return { ok: true, value: { startMin: s, endMin: e, kind: 'period' } }
  }

  const parts = raw.split(RANGE_SEP).filter(Boolean)
  if (parts.length === 2) {
    const a = parseClock(parts[0] ?? '')
    const b = parseClock(parts[1] ?? '')
    if (a === null) {
      return { ok: false, message: `时间区间的起点 "${parts[0]}" 无法解析`, hint: '需要 HH:MM 格式' }
    }
    if (b === null) {
      return { ok: false, message: `时间区间的终点 "${parts[1]}" 无法解析`, hint: '需要 HH:MM 格式' }
    }
    if (a === b) return { ok: true, value: { startMin: a, endMin: a, kind: 'point' } }
    // 终点早于起点 → 视为跨午夜，而不是报错。夜游行程真会这么写。
    const end = b > a ? b : b + 1440
    return { ok: true, value: { startMin: a, endMin: end, kind: 'exact' } }
  }

  const single = parseClock(raw)
  if (single !== null) {
    // 单点事件时长为 0 —— 不编造时长。到下一个事件之间的空隙由 to_next 或真实空档填充。
    return { ok: true, value: { startMin: single, endMin: single, kind: 'point' } }
  }

  return {
    ok: false,
    message: `time "${raw}" 无法解析`,
    hint: '可用：18:25–18:55 / 18:25 / morning·afternoon·evening·night / allday',
  }
}

/**
 * 时长 → 分钟。接受 "11h55m" / "2h" / "45m" / "11小时55分" / "2 小时" / "130 分钟" / 纯数字(分钟)。
 * 解析不了返回 null —— 航班时长是「待填」字段，空着合法。
 */
export function parseDurationMin(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null

  const s = normalizeText(String(raw)).toLowerCase()
  if (!s) return null

  // "11:55" 形式的时长（Expedia 等票面常见）
  const clock = /^(\d{1,2})[:：](\d{2})$/.exec(s)
  if (clock) return Number(clock[1]) * 60 + Number(clock[2])

  let total = 0
  let matched = false
  const h = /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours|小时|时)/.exec(s)
  if (h) {
    total += Math.round(Number(h[1]) * 60)
    matched = true
  }
  const m = /(\d+)\s*(?:m|min|mins|minutes|分钟|分)(?!\S*小时)/.exec(s)
  if (m) {
    total += Number(m[1])
    matched = true
  }
  if (matched) return total > 0 ? total : null

  // 纯数字当分钟
  const n = /^(\d+)$/.exec(s)
  if (n) return Number(n[1]) > 0 ? Number(n[1]) : null
  return null
}

// ── 坐标 ────────────────────────────────────────────────────────

/** 作者格式写 lat, lng（和地图 App 一致）；返回也是 [lat, lng]，转 GeoJSON 顺序在调用处做。 */
export function parseLatLng(v: unknown): [number, number] | null {
  let nums: number[] | null = null

  if (Array.isArray(v) && v.length === 2) {
    nums = v.map(Number)
  } else if (typeof v === 'string') {
    const cleaned = v.replace(/[[\]()（）]/g, ' ')
    const found = cleaned.match(/-?\d+(?:\.\d+)?/g)
    if (found && found.length >= 2) nums = [Number(found[0]), Number(found[1])]
  } else if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>
    const lat = o['lat'] ?? o['latitude']
    const lng = o['lng'] ?? o['lon'] ?? o['longitude']
    if (lat !== undefined && lng !== undefined) nums = [Number(lat), Number(lng)]
  }

  if (!nums || nums.length !== 2) return null
  const [lat, lng] = nums as [number, number]
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return [lat, lng]
}

// ── 日期 ────────────────────────────────────────────────────────

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

export function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
}

export function weekdayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return WEEKDAYS[d.getUTCDay()] ?? ''
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)
  return Math.round(ms / 86_400_000)
}

/** 从标题里抓 ISO 日期，如 "Day 1 · 2026-10-01" */
export function extractDate(text: string): string | null {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(text)
  return m && isIsoDate(m[1] ?? '') ? (m[1] ?? null) : null
}

/** "2026-10-05 11:20" → { date, minute } */
export function parseDateTime(raw: string): { date: string; minute: number } | null {
  const s = normalizeText(String(raw))
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T\s]+(\d{1,2}[:：]\d{2}))?$/.exec(s)
  if (!m || !isIsoDate(m[1] ?? '')) return null
  const minute = m[2] ? parseClock(m[2]) : 0
  if (minute === null) return null
  return { date: m[1] as string, minute }
}
