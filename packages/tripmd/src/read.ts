import { isNode, isScalar, LineCounter, parseDocument, type Document } from 'yaml'
import { DiagnosticBag, suggest } from './diagnostics.ts'
import { normalizeText } from './text.ts'
import { isIsoDate, parseClock, parseDateTime, parseDurationMin, parseLatLng, parseTimeSpec, type TimeSpec } from './values.ts'
import type { Vocab } from './vocab.ts'

/**
 * 字段读取层 —— YAML 到干净值的第一跳，所有块共用。
 *
 * 每种记录一张**字段表**：键、也认的别名、怎么读、是否必填、读不出来算错误还是提醒。
 * 允许的键、别名、读法、报错全从这张表来，没有第二份要手工同步的名单。三条规矩：
 * - 写了但读不出来的值一律报出来（带它自己的行号），绝不静默当没写 —— `minutes: 20 min` 不能悄悄变成「未知」
 * - 拼错的键要报并给建议；键和它的别名同时写了也要报
 * - 影响时间、日期、钱、结构的字段读不出来是错误；只影响显示的字段（星级、备注之类）是提醒，并说明已忽略
 */

export type Rec = Record<string, unknown>

export function asRecord(v: unknown): Rec | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Rec) : null
}

// ── YAML 与行号 ─────────────────────────────────────────────────

/**
 * 一个 YAML 节点在文件里的位置 —— 诊断要指到具体那一项、那个字段，而不是围栏的第一行。
 * `line` 是这个节点开始的行；`lineOf(key)` 是它某个子节点的行（找不到就退回本节点）；`child` 往下走一层。
 */
export interface Cursor {
  readonly line: number
  lineOf(key: string | number): number
  child(key: string | number): Cursor
  /** 这个值在文件里的原文（标量才有）—— YAML 会把 `0812` 读成 812、`45.50` 读成 45.5，文字字段要原文 */
  source(): string | undefined
}

/** 没有 YAML 结构可查时的光标：一切都在这一行 */
export function flatCursor(line: number): Cursor {
  const c: Cursor = { line, lineOf: () => line, child: () => c, source: () => undefined }
  return c
}

export interface Located {
  value: unknown
  cursor: Cursor
  /** YAML 语法错误（已报）—— 调用方不再往下读，免得再报一串「缺少必需字段」 */
  broken?: boolean
}

/**
 * 解析一段 YAML（围栏块或 frontmatter），带上行号。`before` 是这段 YAML 第一行**之前**那一行的行号：
 * 围栏块是开围栏那一行，frontmatter 是开头的 `---`（第 1 行）。语法错误报在出错的那一行，值为 null
 */
export function yamlOf(bag: DiagnosticBag, before: number, content: string, what: string): Located {
  if (!content.trim()) return { value: null, cursor: flatCursor(before) }
  const lineCounter = new LineCounter()
  const doc = parseDocument(content, { lineCounter })
  const err = doc.errors[0]
  if (err) {
    const line = before + (err.linePos?.[0]?.line ?? 1)
    // yaml 报的「at line N」是块内行号，和诊断的文件行号对不上，去掉
    const message = (err.message.split('\n')[0] ?? '').replace(/\s*at line \d+, column \d+:?\s*$/, '')
    bag.error(line, `${what} 的 YAML 语法错误：${message}`)
    return { value: null, cursor: flatCursor(before), broken: true }
  }
  return { value: doc.toJS(), cursor: nodeCursor(doc, lineCounter, before, [], before + 1) }
}

function nodeCursor(doc: Document, lc: LineCounter, before: number, path: readonly (string | number)[], fallback: number): Cursor {
  const lineAt = (p: readonly (string | number)[]): number | undefined => {
    const node = doc.getIn(p, true)
    const range = isNode(node) ? node.range : undefined
    return range ? before + lc.linePos(range[0]).line : undefined
  }
  const line = lineAt(path) ?? fallback
  return {
    line,
    lineOf: (key) => lineAt([...path, key]) ?? line,
    child: (key) => nodeCursor(doc, lc, before, [...path, key], lineAt([...path, key]) ?? line),
    source: () => {
      const node = doc.getIn(path, true)
      return isScalar(node) && typeof node.source === 'string' ? node.source : undefined
    },
  }
}

// ── 读法 ──────────────────────────────────────────────────────

/** 列表里的第几项、写的是什么 —— 诊断报在那一项自己的行 */
export interface Item {
  index: number
  raw: unknown
}
/** 读不出来时怎么说：应为什么、怎么改 */
export type Fail = (expected: string, hint?: string, item?: Item) => void
/** 读出来了但要提醒一句（退役的写法、被纠正的写法）—— 总是提醒级 */
export type Notice = (message: string, hint?: string, item?: Item) => void

/** 一个值怎么读：认出来返回值，认不出来调 fail 并返回 undefined。`at` 是这个值自己的位置，嵌套记录要用 */
export type Reader<T> = (raw: unknown, fail: Fail, notice: Notice, at: Cursor) => T | undefined

/**
 * 一段文字。数字照原文收（`room: 0812` 是「0812」，不是 YAML 读出来的 812）；
 * 列表、键值对、true / false 不是文字 —— 那多半是 YAML 把它读歪了
 */
export const text: Reader<string> = (raw, fail, _notice, at) => {
  if (typeof raw === 'string') return raw.trim() || undefined
  if (typeof raw === 'number') return at.source() ?? String(raw)
  fail('一段文字', '整段加上引号写成一行，如 `note: "注意：16 点前到"`')
  return undefined
}

/**
 * 要「认」的值（日期、时刻、数、枚举）先规整成一段文字：全角转半角，数字照收。
 * 别的形状（列表、键值对、true / false）返回 undefined，由各个读法按**自己的**期望报 —— 不先报一句「应为一段文字」
 */
const matchable = (raw: unknown): string | undefined =>
  typeof raw === 'string' ? normalizeText(raw) || undefined : typeof raw === 'number' ? String(raw) : undefined

/** 原样的一段文字（不规整）：时间与日期时刻要留作者的原文写回 */
const verbatim = (raw: unknown): string | undefined =>
  typeof raw === 'string' ? raw.trim() || undefined : typeof raw === 'number' ? String(raw) : undefined

const numberOf = (raw: unknown): number => (typeof raw === 'number' ? raw : Number(matchable(raw) ?? NaN))

export const isoDate: Reader<string> = (raw, fail) => {
  const s = matchable(raw)
  if (s !== undefined && isIsoDate(s)) return s
  fail('日期（YYYY-MM-DD，且真实存在）', '如 `2026-11-13`')
  return undefined
}

export const clock: Reader<string> = (raw, fail) => {
  const s = matchable(raw)
  if (s !== undefined && parseClock(s) !== null) return s
  fail('时刻（HH:MM，最晚 24:00）', '如 `"18:25"`（加引号）')
  return undefined
}

export interface DateTimeValue {
  raw: string
  date: string
  minute: number
}

/** 日期加可选时刻（`2026-10-05 11:20`）；只写日期时按 defaultMinute 补（见 values.ts 的 DEFAULT_MINUTE） */
export function dateTime(defaultMinute: number): Reader<DateTimeValue> {
  return (raw, fail) => {
    const s = verbatim(raw)
    const dt = s === undefined ? null : parseDateTime(s, defaultMinute)
    if (s !== undefined && dt) return { raw: s, ...dt }
    fail('日期时刻（YYYY-MM-DD HH:MM）', '如 `2026-10-05 11:20`；只写日期则按保底时刻算')
    return undefined
  }
}

export const duration: Reader<number> = (raw, fail) => {
  const min = parseDurationMin(raw)
  if (min !== null) return min
  fail('时长', '如 `2h30m`、`45m`、`1h30`、`2 小时`、`130`（分钟）')
  return undefined
}

/** 正整数（星级、人数） */
export const count: Reader<number> = (raw, fail) => {
  const n = numberOf(raw)
  if (Number.isInteger(n) && n > 0) return n
  fail('正整数', '如 `2`（不带单位）')
  return undefined
}

/** 整数，可正可负（`arr_day_offset`） */
export const integer: Reader<number> = (raw, fail) => {
  const n = numberOf(raw)
  if (Number.isInteger(n)) return n
  fail('整数', '次日到达写 `1`，同日写 `0`')
  return undefined
}

/** 正数（公里数） */
export const positive: Reader<number> = (raw, fail) => {
  const n = numberOf(raw)
  if (Number.isFinite(n) && n > 0) return n
  fail('正数', '只写数字，如 `km: 4.5`')
  return undefined
}

export const yesNo: Reader<boolean> = (raw, fail) => {
  if (typeof raw === 'boolean') return raw
  fail('true 或 false')
  return undefined
}

/** 坐标：作者格式「纬度, 经度」，存成 [lng, lat] */
export const latLng: Reader<[number, number]> = (raw, fail) => {
  const ll = parseLatLng(raw)
  if (ll) return [ll[1], ll[0]]
  fail('坐标（纬度在前，经度在后）', '写成 `coord: 47.6205, -122.3400`，或度分秒 `47°37\'13.8"N 122°20\'24.0"W`')
  return undefined
}

/**
 * IANA 时区名 —— 认不认得交给运行时自己的时区库，日历导出用的也是它。
 * 只收以字母开头的名字：`-07:00` 这种偏移运行时也认，但进不了日历的 TZID，也不懂夏令时。
 * 只是大小写不同就规整成规范写法（`america/los_angeles` → `America/Los_Angeles`），别的原样留着
 */
export const timezone: Reader<string> = (raw, fail) => {
  const s = matchable(raw)
  try {
    if (s !== undefined && /^[A-Za-z]/.test(s)) {
      const canonical = new Intl.DateTimeFormat('en-US', { timeZone: s }).resolvedOptions().timeZone
      return canonical.toLowerCase() === s.toLowerCase() ? canonical : s
    }
  } catch {
    // 落到下面统一报
  }
  fail('IANA 时区名', '如 `America/Los_Angeles`、`Asia/Tokyo`')
  return undefined
}

export interface TimeValue extends TimeSpec {
  raw: string
}

/** 事件的 time：时刻、区间、时段或全天 */
export const timeSpec: Reader<TimeValue> = (raw, fail) => {
  const s = verbatim(raw)
  const r = s === undefined ? null : parseTimeSpec(s)
  if (s !== undefined && r?.ok) return { ...r.value, raw: s }
  fail('时刻、时间区间、时段或全天', r && !r.ok ? r.hint : '如 `18:25–18:55`、`"13:11"`、`afternoon`、`allday`')
  return undefined
}

/**
 * 枚举：规范键、别名、中文名都认（见 vocab.ts）；认不出给「是否想写 X」。
 * 退役的写法（`warning` 标记）认得出但不再收：提醒一句、当没写
 */
export function oneOf<K extends string>(vocab: Vocab<K>): Reader<K> {
  return (raw, fail, notice) => {
    const s = matchable(raw)
    const hit = s === undefined ? null : vocab.resolve(s)
    if (hit) return hit
    const retired = s === undefined ? null : vocab.retired(s)
    if (retired) {
      notice(retired)
      return undefined
    }
    const guess = s === undefined ? null : vocab.guess(s)
    fail(`有效的 ${vocab.name}`, guess ? `是否想写 \`${guess}\`？` : `可选值：${vocab.keys.join(' / ')}`)
    return undefined
  }
}

/**
 * 单个值或一个列表，统一读成列表；`split` 给了就把一个字符串按它切开（`flags: optional, tentative`）。
 * 读不出来的项单独报、单独丢，其余照收 —— 一项写错不连累整列
 */
export function listOf<T>(item: Reader<T>, opts: { split?: RegExp } = {}): Reader<T[]> {
  return (raw, fail, notice, at) => {
    const many = Array.isArray(raw)
    const items = many ? raw : typeof raw === 'string' && opts.split ? raw.split(opts.split) : [raw]
    const out: T[] = []
    items.forEach((x, i) => {
      if (!isWritten(x)) return
      const v = item(
        x,
        (expected, hint) => fail(expected, hint, { index: i, raw: x }),
        (message, hint) => notice(message, hint, { index: i, raw: x }),
        many ? at.child(i) : at,
      )
      if (v !== undefined) out.push(v)
    })
    return out
  }
}

/** 列表里的一段文字。YAML 会把 `- 注意: 16 点必须上车` 读成键值对 —— 按作者的原意拼回「注意: 16 点必须上车」并提醒加引号 */
export const noteText: Reader<string> = (raw, fail, notice, at) => {
  const rec = asRecord(raw)
  const entries = rec ? Object.entries(rec) : []
  const [pair] = entries
  if (pair && entries.length === 1 && (typeof pair[1] === 'string' || typeof pair[1] === 'number')) {
    const joined = `${pair[0]}: ${String(pair[1])}`
    notice(`「${joined}」被 YAML 读成了键值对，已按一段文字收下`, '整条加上引号更稳妥：`- "注意: 16 点必须上车"`')
    return joined
  }
  return text(raw, fail, notice, at)
}

/** 嵌套的记录（transport、stops、booking、to_next……）：原样带着自己的位置交出去，由调用方按它自己的字段表读 */
export const nested: Reader<Located> = (raw, _fail, _notice, at) => ({ value: raw, cursor: at })

// ── 记录 ────────────────────────────────────────────────────────

export interface Field<T> {
  read: Reader<T>
  /** 也认的写法（驼峰、旧名、同义词） */
  aliases?: readonly string[]
  /** 必填：缺了按 level 报，附上这条怎么写 */
  required?: string
  /** 读不出来（或必填缺失）时的级别：缺省是错误；只影响显示的字段写 warning */
  level?: 'error' | 'warning'
  /** 提醒级的字段读不出来时怎么处理，缺省「已忽略」 */
  otherwise?: string
}

/** 只影响显示的一段文字：读不出来提醒并忽略 */
export const display: Field<string> = { read: text, level: 'warning' }

/** 一张字段表：键是作者写的那个首选键名 */
export type Fields = Readonly<Record<string, Field<any>>>
export type Values<F extends Fields> = { -readonly [K in keyof F]?: F[K] extends Field<infer T> ? T : never }

export interface RecordSpec<F extends Fields> {
  /** 未知键提醒里的块名，如 `trip-event` */
  block: string
  fields: F
  /** 退役的键：写了就报错并说明搬去哪了 —— 静默忽略等于丢数据 */
  retired?: Readonly<Record<string, readonly [message: string, hint: string]>>
}

/**
 * 按字段表读一条记录。`where` 是报错里怎么称呼它，如「事件「抵达」」「长途「去程」的交通」。
 * 未知键提醒并给建议，键与别名同时出现提醒，必填缺失按字段级别报，写了但读不出来按字段级别报 ——
 * 每条诊断都在它自己的那一行（缺必填的报在 `at.line`，即这条记录开始的地方）
 */
export function readRecord<F extends Fields>(bag: DiagnosticBag, at: Cursor, rec: Rec, spec: RecordSpec<F>, where: string): Values<F> {
  const out: Record<string, unknown> = {}
  const spellings = Object.entries(spec.fields).flatMap(([key, f]) => [key, ...(f.aliases ?? [])])
  const retired = spec.retired ?? {}

  for (const key of Object.keys(rec)) {
    if (spellings.includes(key)) continue
    const why = retired[key]
    if (why) {
      bag.error(at.lineOf(key), why[0], why[1])
      continue
    }
    // 拼错的键多半就是想写那个最像的字段：那个字段若是错误级（时间、日期、钱、结构、hide），这一条也是错误 ——
    // `hidden: to` 只提醒的话，想藏的那一端照样发出去；`stauts: booked` 只提醒的话，「已订」被读成「待订」
    const guess = suggest(key, spellings)
    const meant = guess === null ? undefined : (spec.fields[guess] ?? Object.values(spec.fields).find((f) => f.aliases?.includes(guess)))
    ;(meant && (meant.level ?? 'error') === 'error' ? bag.error : bag.warn).call(
      bag,
      at.lineOf(key),
      `\`${spec.block}\` 的字段 \`${key}\` 无法识别，已忽略`,
      guess ? `是否想写 \`${guess}\`？` : `可用字段：${Object.keys(spec.fields).join(' / ')}`,
    )
  }

  for (const [key, field] of Object.entries(spec.fields)) {
    const report = (field.level ?? 'error') === 'error' ? bag.error : bag.warn
    const tail = field.level === 'warning' ? `，${field.otherwise ?? '已忽略'}` : ''
    const written = [key, ...(field.aliases ?? [])].filter((k) => isWritten(rec[k]))
    const [name] = written
    if (written.length > 1) {
      bag.warn(at.lineOf(written[1]!), `${where}：\`${written.join('` 与 `')}\` 是同一个字段，写了两遍，用的是 \`${name}\``, `删掉 \`${written.slice(1).join('`、`')}\``)
    }
    if (name === undefined) {
      if (field.required) report.call(bag, at.line, `${where} 缺少必需字段 \`${key}\`${tail}`, field.required)
      continue
    }
    const raw = rec[name]
    const lineOfItem = (item: Item | undefined): number => (item ? at.child(name).lineOf(item.index) : at.lineOf(name))
    const value = field.read(
      raw,
      (expected, hint, item) => {
        const what = item ? `\`${name}\` 的第 ${item.index + 1} 项写的是 ${shown(item.raw)}` : `\`${name}\` 写的是 ${shown(raw)}`
        report.call(bag, lineOfItem(item), `${where}：${what}，应为${expected}${tail}`, hint)
      },
      (message, hint, item) => bag.warn(lineOfItem(item), `${where}：${message}`, hint),
      at.child(name),
    )
    if (value !== undefined) out[key] = value
  }
  return out as Values<F>
}

/** 写了值：`null`（`note:` 后面空着）和空白字符串都算没写 */
export function isWritten(v: unknown): boolean {
  return v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '')
}

/** 报错里怎么显示作者写的值 */
function shown(raw: unknown): string {
  if (typeof raw === 'string') return `"${raw}"`
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw)
  const json = JSON.stringify(raw) ?? String(raw)
  return json.length > 60 ? `${json.slice(0, 57)}…` : json
}

/**
 * 一个「单条或列表」的记录字段（`transport`、`stops`、`links`……）：逐条交给 fn，带着每一条自己的光标。
 * 不是键值对的那一项报出来（`- Astra Hotel` 漏写 `what:` 就是整条消失），级别跟着调用方
 */
export function eachRecord(
  bag: DiagnosticBag,
  field: Located | undefined,
  what: string,
  fn: (rec: Rec, at: Cursor, index: number) => void,
  level: 'error' | 'warning' = 'error',
): void {
  if (!field || field.value === undefined || field.value === null) return
  const { value, cursor } = field
  const list = Array.isArray(value) ? value : [value]
  list.forEach((item, i) => {
    if (item === null) return // 空着的 `-` 算没写
    const at = Array.isArray(value) ? cursor.child(i) : cursor
    const rec = asRecord(item)
    if (rec) fn(rec, at, i)
    else (level === 'error' ? bag.error : bag.warn).call(bag, at.line, `${what}里有一项不是键值对：${shown(item)}`, '每项写成 `键: 值`')
  })
}

/** 只能是一条键值对的嵌套字段（`booking`、`to_next`、`from_stay`）：是列表或一段文字就报错，返回 null */
export function oneRecord(bag: DiagnosticBag, field: Located | undefined, what: string): { rec: Rec; at: Cursor } | null {
  if (!field) return null
  const rec = asRecord(field.value)
  if (!rec) bag.error(field.cursor.line, `${what}应为一条键值对，写的是 ${shown(field.value)}`, '写成 `{键: 值, …}` 或缩进的多行')
  return rec ? { rec, at: field.cursor } : null
}

/**
 * 最后一道关口：拼好的对象过一遍 zod schema。读取点该报的都已报过，这里只兜住漏网的（行号只能给到记录所在的行）。
 * plan.md 与 space.md 共用
 */
export function schemaGate<T>(
  bag: DiagnosticBag,
  line: number,
  schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] } } },
  value: unknown,
): T | null {
  const checked = schema.safeParse(value)
  if (checked.success) return checked.data
  for (const issue of checked.error.issues) {
    bag.error(line, `schema 校验失败 @ ${issue.path.map(String).join('.')}：${issue.message}`)
  }
  return null
}
