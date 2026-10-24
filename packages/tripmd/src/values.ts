import { PERIOD_WINDOWS, type PeriodKey, type TimeKind } from '@jjj/schema'
import { normalizeText } from './text.ts'
import { resolvePeriod } from './vocab.ts'


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
// 归一化与格式化住在这里而非 schema —— schema 只描述形状、不做决定。

/** "18:25" → 1105（容忍全角冒号与空格）。最晚到 `24:00`（一天的终点）；不合法返回 null。 */
export function parseClock(raw: string): number | null {
  const m = /^(\d{1,2})\s*[:：]\s*(\d{2})$/.exec(raw.trim())
  if (!m) return null
  const h = Number(m[1])
  const mi = Number(m[2])
  if (h > 24 || mi > 59 || (h === 24 && mi !== 0)) return null
  return h * 60 + mi
}

/** 分钟数 → "HH:MM"。跨午夜的 1500 会渲染成 "01:00"（次日）。 */
export function formatMinutes(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

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

/** 时长里认的写法：小时在前、分钟在后，分钟的单位可省（「1h30」的 30 就是分钟） */
const DURATION_RE = /^(?:(\d+(?:\.\d+)?)(?:h|hr|hrs|hour|hours|小时|个小时|時間|时))?(?:(\d+)(?:m|min|mins|minute|minutes|分钟|分)?)?$/

/**
 * 时长 → 分钟。接受 "11h55m" / "2h" / "45m" / "1h30" / "11小时55分" / "11小时55" / "2 小时" / "130 分钟" /
 * "11:55"（票面常见）/ 纯数字（分钟）。**整串都得认得出来**：「20 min 4 km」「1:30h」「0:00」返回 null，
 * 由调用方报出来 —— 不再只抠出认得的那一段、悄悄丢掉剩下的。
 * 不是正数也返回 null：时长为 0 的路不存在。
 */
export function parseDurationMin(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null
  if (typeof raw !== 'string') return null
  const s = normalizeText(raw).toLowerCase().replace(/\s+/g, '')
  if (!s) return null

  const clock = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (clock) {
    const total = Number(clock[1]) * 60 + Number(clock[2])
    return Number(clock[2]) < 60 && total > 0 ? total : null
  }
  if (/^\d+$/.test(s)) return Number(s) > 0 ? Number(s) : null

  const m = DURATION_RE.exec(s)
  if (!m || (m[1] === undefined && m[2] === undefined)) return null
  const total = Math.round(Number(m[1] ?? 0) * 60) + Number(m[2] ?? 0)
  return total > 0 ? total : null
}

/**
 * 分钟 → 紧凑时长 "11h55m" / "2h" / "45m"。`parseDurationMin` 的逆运算，
 * 所以住在它旁边 —— 作者格式的序列化和票面时间轴共用这一份。
 */
export function formatDurationCompact(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}m`
}

// ── 坐标 ────────────────────────────────────────────────────────

/**
 * 作者格式写 lat, lng（和地图 App 一致）；返回也是 [lat, lng]，转 GeoJSON 顺序在调用处做。
 * 接受十进制（`47.6205, -122.3493`，可带 °N / W）和度分秒（`47°36'22.3"N 122°19'55.6"W`、`47° 36.371' N`）。
 * **必须恰好两个数**：多一个数（「…附近 3 号门」）返回 null 由调用方报错，而不是取前两个凑合 ——
 * 度分秒被当成十进制读的老毛病（47°36' → [47, 36]，俄罗斯）就出在「取前两个」上
 */
export function parseLatLng(v: unknown): [number, number] | null {
  let nums: number[] | null = null
  // 半球字母：既定正负，也定哪个是纬度 —— `2.3376° E, 48.8606° N` 先写的是经度
  let dirs: (string | undefined)[] = []

  if (Array.isArray(v) && v.length === 2) {
    nums = v.map(coordNumber)
  } else if (typeof v === 'string') {
    const s = normalizeText(v).replace(/[[\]()（）]/g, ' ')
    // 半球字母决定正负：只把字母当噪声剥掉的话，西经会变成东经，把西雅图画到中国境内
    const signed = (n: number, dir: string | undefined): number =>
      dir === 'S' || dir === 'W' ? -Math.abs(n) : n
    if (/['′"″]/.test(s)) {
      const found = [...s.matchAll(/(-?\d+(?:\.\d+)?)\s*°\s*(?:(\d+(?:\.\d+)?)\s*['′]\s*)?(?:(\d+(?:\.\d+)?)\s*["″]\s*)?([NSEWnsew])?/g)]
      if (found.length === 2) {
        dirs = found.map((m) => m[4]?.toUpperCase())
        nums = found.map((m) => {
          const deg = Number(m[1])
          const abs = Math.abs(deg) + Number(m[2] ?? 0) / 60 + Number(m[3] ?? 0) / 3600
          return signed(deg < 0 ? -abs : abs, m[4]?.toUpperCase())
        })
      }
    } else {
      const found = [...s.matchAll(/(-?\d+(?:\.\d+)?)\s*°?\s*([NSEWnsew])?/g)]
      if (found.length === 2) {
        dirs = found.map((m) => m[2]?.toUpperCase())
        nums = found.map((m) => signed(Number(m[1]), m[2]?.toUpperCase()))
      }
    }
  } else if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>
    const lat = o['lat'] ?? o['latitude']
    const lng = o['lng'] ?? o['lon'] ?? o['longitude']
    if (lat !== undefined && lng !== undefined) nums = [coordNumber(lat), coordNumber(lng)]
  }

  if (!nums || nums.length !== 2) return null
  const axisOf = (d: string | undefined): 'lat' | 'lng' | null => (d === 'N' || d === 'S' ? 'lat' : d === 'E' || d === 'W' ? 'lng' : null)
  const [first, second] = [axisOf(dirs[0]), axisOf(dirs[1])]
  if (first !== null && first === second) return null // 「47 N, 122 N」：两个都是纬度
  if (first === 'lng' || second === 'lat') nums = [nums[1]!, nums[0]!]
  const [lat, lng] = nums as [number, number]
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return [lat, lng]
}

/** 坐标里的一个数：数字或写着数字的文字；空着（`~`、`''`）不是 0 */
function coordNumber(x: unknown): number {
  if (typeof x === 'number') return x
  return typeof x === 'string' && x.trim() ? Number(normalizeText(x)) : NaN
}

/**
 * 存储的坐标（[lng, lat]，GeoJSON 顺序）→ 作者格式「纬度, 经度」。
 * 写回 plan.md、黑名单比对、日历 GEO、地图深链都按这个顺序；只有分隔符随用途变（URL 里不带空格，iCalendar 用分号）
 */
export function formatLatLng(coord: readonly [number, number], sep = ', '): string {
  return `${coord[1]}${sep}${coord[0]}`
}

// ── 日期 ────────────────────────────────────────────────────────

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

/** 真实存在的 YYYY-MM-DD：`2026-02-30` 不算（Date 会把它滚成 3 月 2 日，按日期查找全部落空） */
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function weekdayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return WEEKDAYS[d.getUTCDay()] ?? ''
}

/**
 * 周一 = 0 …… 周日 = 6。
 *
 * `getUTCDay()` 是周日 = 0，日历网格按周一起排，差这一格整周都会错位 ——
 * 这个陷阱封在这里，调用方不再各自 `+6 % 7`。
 */
export function mondayIndex(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7
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

/**
 * 标题里写的日期，如 "Day 1 · 2026-10-01"。没写返回 null；
 * 写了但不是真实存在的 YYYY-MM-DD（`2026-10-32`、没补零的 `2026-10-2`）返回 `{ written, iso: null }` —— 那是写错，不是没写
 */
export function headingDate(text: string): { written: string; iso: string | null } | null {
  const m = /(?<!\d)\d{4}-\d{1,2}-\d{1,2}(?!\d)/.exec(text)
  return m ? { written: m[0], iso: isIsoDate(m[0]) ? m[0] : null } : null
}

/**
 * 作者只写日期不写时刻时补的时刻：住宿按行业惯例入住 18:00、退房 10:00，其余（租车、硬约束）按 0 点。
 * 保底在**解析时**就填进 `minute`，导出仍按作者写的 `raw` 原样写回 —— 往返幂等不受影响，
 * 下游拿到的区间两端永远有确定值
 */
export const DEFAULT_MINUTE = { checkIn: 18 * 60, checkOut: 10 * 60, other: 0 } as const

/** "2026-10-05 11:20" → { date, minute } */
export function parseDateTime(
  raw: string,
  /** 只写日期时用它补足时刻（酒店入住/退房这类有行业惯例的场合） */
  defaultMinute = 0,
): { date: string; minute: number } | null {
  const s = normalizeText(String(raw))
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T\s]+(\d{1,2}[:：]\d{2}))?$/.exec(s)
  if (!m || !isIsoDate(m[1] ?? '')) return null
  const minute = m[2] ? parseClock(m[2]) : defaultMinute
  if (minute === null) return null
  return { date: m[1] as string, minute }
}
