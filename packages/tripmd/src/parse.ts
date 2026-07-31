import {
  CATEGORY_ALIASES,
  CATEGORY_KEYS,
  CONSTRAINT_KINDS,
  FLAG_ALIASES,
  FLAG_KEYS,
  TRANSPORT_ALIASES,
  TRANSPORT_MODES,
  TripSchema,
  dayColor,
  resolveCategory,
  resolveFlag,
  resolveTransport,
  type CategoryKey,
  type Constraint,
  type ConstraintKind,
  type Day,
  type FlagKey,
  type Leg,
  type Place,
  type Reference,
  type Trip,
  type TripEvent,
  type Variant,
} from '@jjj/schema'
import { parse as parseYaml, YAMLParseError } from 'yaml'
import { DiagnosticBag, suggest, suggestEnum, type Diagnostic } from './diagnostics.ts'
import { parseCost, splitBody } from './cost.ts'
import { lex, proseOf, type Token } from './lexer.ts'
import {
  addDays,
  daysBetween,
  extractDate,
  isIsoDate,
  parseDateTime,
  parseDurationMin,
  parseLatLng,
  parseTimeSpec,
  placeId as makePlaceId,
  placeKey,
  stableId,
  weekdayOf,
} from './values.ts'

export interface ParseResult {
  trip: Trip | null
  diagnostics: Diagnostic[]
}

const DAY_HEADING = /^(?:day\s*(\d+)|第\s*(\d+)\s*天)/i
const APPENDIX_HEADING = /^(?:附录|资料|appendix)\s*[·:：|\-—]\s*(.+)$/i
const VARIANT_HEADING = /^(?:变体|备选|variant|alt)\s*[·:：|\-—]\s*(.+)$/i

type Rec = Record<string, unknown>

/** 解析围栏块里的 YAML，把 yaml 库报的行号平移到文件真实行号。 */
function yamlOf(bag: DiagnosticBag, fenceLine: number, content: string, what: string): unknown {
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

function asRecord(v: unknown): Rec | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Rec) : null
}

function str(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined
  const s = String(v).trim()
  return s === '' ? undefined : s
}

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function readCategory(
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

function readFlags(bag: DiagnosticBag, line: number, raw: unknown): FlagKey[] {
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

// ── 中间表示 ────────────────────────────────────────────────────

interface RawEvent {
  line: number
  title: string
  meta: Rec
  body: string
  variants: Variant[]
}

interface RawDay {
  line: number
  index: number
  dateHint: string | null
  headingText: string
  meta: Rec
  intro: string
  events: RawEvent[]
}

interface RawRef {
  line: number
  title: string
  meta: Rec
  markdown: string
}

// ── 主入口 ──────────────────────────────────────────────────────

export function parse(src: string): ParseResult {
  const bag = new DiagnosticBag()
  const tokens = lex(src)

  // ── frontmatter ──
  const fm = tokens.find((t) => t.kind === 'frontmatter')
  if (!fm || fm.kind !== 'frontmatter') {
    bag.error(1, '缺少 frontmatter', '文件必须以 --- 开头，声明 id / title / destination / timezone / start / end')
    return { trip: null, diagnostics: bag.sorted() }
  }
  const meta = asRecord(yamlOf(bag, 0, fm.yaml, 'frontmatter')) ?? {}

  const required = ['id', 'title', 'destination', 'timezone', 'start', 'end'] as const
  for (const k of required) {
    if (!str(meta[k])) bag.error(fm.line, `frontmatter 缺少必需字段 \`${k}\``)
  }
  const start = str(meta['start']) ?? ''
  const end = str(meta['end']) ?? ''
  for (const [k, v] of [['start', start], ['end', end]] as const) {
    if (v && !isIsoDate(v)) bag.error(fm.line, `frontmatter 的 \`${k}\` "${v}" 不是合法日期`, '格式为 YYYY-MM-DD')
  }
  if (isIsoDate(start) && isIsoDate(end) && daysBetween(start, end) < 0) {
    bag.error(fm.line, `frontmatter 的 \`end\` (${end}) 早于 \`start\` (${start})`)
  }

  // ── 分区扫描 ──
  const rawDays: RawDay[] = []
  const rawRefs: RawRef[] = []
  const constraintFences: { line: number; value: unknown }[] = []
  const rentalFences: { line: number; value: unknown }[] = []
  const placeFences: { line: number; value: unknown }[] = []

  type Ctx =
    | { mode: 'top'; buf: Token[]; line: number; heading: string }
    | { mode: 'day'; day: RawDay; buf: Token[] }
    | { mode: 'event'; day: RawDay; ev: RawEvent; buf: Token[] }
    | { mode: 'variant'; day: RawDay; ev: RawEvent; variant: Variant; buf: Token[] }
    | { mode: 'ref'; ref: RawRef; buf: Token[] }

  let ctx: Ctx = { mode: 'top', buf: [], line: 1, heading: '' }

  const flush = (): void => {
    const text = proseOf(ctx.buf)
    switch (ctx.mode) {
      case 'day':
        ctx.day.intro = text
        break
      case 'event':
        ctx.ev.body = text
        break
      case 'variant':
        ctx.variant.body = text
        ctx.ev.variants.push(ctx.variant)
        break
      case 'ref':
        ctx.ref.markdown = text
        rawRefs.push(ctx.ref)
        break
      case 'top':
        // 顶层散文不会进入任何视图。少量前言无所谓，大段则是静默丢数据，必须提醒。
        if (text.replace(/\s/g, '').length > 120) {
          bag.warn(
            ctx.line,
            `「${ctx.heading || '文档开头'}」下有约 ${text.replace(/\s/g, '').length} 字正文不会出现在任何视图里`,
            '要展示的话，放进 `## 附录 · 标题` 分区',
          )
        }
        break
    }
    ctx.buf = []
  }

  for (const t of tokens) {
    if (t.kind === 'frontmatter') continue

    // 附录内部一切照单全收，包括 ### / #### 和代码块
    if (ctx.mode === 'ref' && !(t.kind === 'heading' && t.level <= 2)) {
      if (t.kind === 'fence' && t.info === 'trip-ref') {
        ctx.ref.meta = asRecord(yamlOf(bag, t.line, t.content, 'trip-ref')) ?? {}
        continue
      }
      ctx.buf.push(t)
      continue
    }

    if (t.kind === 'fence') {
      switch (t.info) {
        case 'trip-constraints':
          constraintFences.push({ line: t.line, value: yamlOf(bag, t.line, t.content, 'trip-constraints') })
          continue
        case 'trip-rentals':
          rentalFences.push({ line: t.line, value: yamlOf(bag, t.line, t.content, 'trip-rentals') })
          continue
        case 'trip-places':
          placeFences.push({ line: t.line, value: yamlOf(bag, t.line, t.content, 'trip-places') })
          continue
        case 'trip-day': {
          const v = asRecord(yamlOf(bag, t.line, t.content, 'trip-day'))
          if (ctx.mode === 'day') ctx.day.meta = v ?? {}
          else bag.error(t.line, '`trip-day` 块出现在 Day 分区之外', '它必须紧跟在 `## Day N` 标题之后')
          continue
        }
        case 'trip-event': {
          const v = asRecord(yamlOf(bag, t.line, t.content, 'trip-event'))
          if (ctx.mode === 'event') ctx.ev.meta = v ?? {}
          else bag.error(t.line, '`trip-event` 块出现在事件之外', '它必须紧跟在 Day 分区内的 `### 事件标题` 之后')
          continue
        }
        case 'trip-ref':
          bag.error(t.line, '`trip-ref` 块出现在附录分区之外', '它必须紧跟在 `## 附录 · 标题` 之后')
          continue
        default:
          ctx.buf.push(t)
          continue
      }
    }

    if (t.kind !== 'heading') {
      ctx.buf.push(t)
      continue
    }

    // ── 标题：可能切换分区 ──
    if (t.level === 1) {
      flush()
      ctx = { mode: 'top', buf: [], line: t.line, heading: t.text }
      continue
    }

    if (t.level === 2) {
      flush()
      const appendix = APPENDIX_HEADING.exec(t.text)
      if (appendix) {
        ctx = {
          mode: 'ref',
          ref: { line: t.line, title: (appendix[1] ?? '').trim(), meta: {}, markdown: '' },
          buf: [],
        }
        continue
      }
      const dm = DAY_HEADING.exec(t.text)
      if (dm) {
        const idx = Number(dm[1] ?? dm[2])
        const day: RawDay = {
          line: t.line,
          index: idx,
          dateHint: extractDate(t.text),
          headingText: t.text,
          meta: {},
          intro: '',
          events: [],
        }
        rawDays.push(day)
        ctx = { mode: 'day', day, buf: [] }
        continue
      }
      ctx = { mode: 'top', buf: [], line: t.line, heading: t.text }
      continue
    }

    if (t.level === 3) {
      if (ctx.mode === 'day' || ctx.mode === 'event' || ctx.mode === 'variant') {
        // 显式标注：ctx 是 let + 联合类型，下面又用 day 重新赋值 ctx，
        // 不标注的话 TS 的控制流推断会绕成一个环（TS7022）
        const day: RawDay = ctx.day
        flush()
        const ev: RawEvent = { line: t.line, title: t.text, meta: {}, body: '', variants: [] }
        day.events.push(ev)
        ctx = { mode: 'event', day, ev, buf: [] }
      } else {
        ctx.buf.push(t)
      }
      continue
    }

    if (t.level === 4) {
      const vm = VARIANT_HEADING.exec(t.text)
      if (vm && (ctx.mode === 'event' || ctx.mode === 'variant')) {
        const day: RawDay = ctx.day
        const ev: RawEvent = ctx.ev
        flush()
        ctx = { mode: 'variant', day, ev, variant: { when: (vm[1] ?? '').trim(), body: '' }, buf: [] }
        continue
      }
      ctx.buf.push(t)
      continue
    }

    ctx.buf.push(t)
  }
  flush()

  if (rawDays.length === 0) {
    bag.error(fm.line, '文档里没有任何 Day 分区', '每天用一个 `## Day 1 · 2026-10-01` 标题开头')
  }

  // ── 地点表 ──
  const places = new Map<string, Place>()
  const placeLines = new Map<string, number>()

  for (const fence of placeFences) {
    const list = fence.value
    if (list === null) continue
    if (!Array.isArray(list)) {
      bag.error(fence.line, '`trip-places` 必须是一个列表', '每个地点以 `- name: ...` 开头')
      continue
    }
    for (const item of list) {
      const rec = asRecord(item)
      if (!rec) {
        bag.error(fence.line, '`trip-places` 里有一项不是对象')
        continue
      }
      const name = str(rec['name'])
      if (!name) {
        bag.error(fence.line, '`trip-places` 里有一项缺少 `name`')
        continue
      }
      const key = placeKey(name)
      if (places.has(key)) {
        bag.warn(fence.line, `地点 "${name}" 重复声明，后一条已忽略`)
        continue
      }
      const nameEn = str(rec['en']) ?? str(rec['nameEn'])
      let coord: [number, number] | null = null
      if (rec['coord'] !== undefined && rec['coord'] !== null) {
        const ll = parseLatLng(rec['coord'])
        if (ll) coord = [ll[1], ll[0]] // → [lng, lat]
        else
          bag.error(
            fence.line,
            `地点 "${name}" 的 coord 无法解析：${JSON.stringify(rec['coord'])}`,
            '写成 `coord: 47.6205, -122.3400`（纬度在前，经度在后）',
          )
      }
      places.set(key, {
        id: makePlaceId(name, nameEn),
        name,
        nameEn,
        coord,
        category: readCategory(bag, fence.line, rec['category'], `地点 "${name}"`, 'sight') ?? 'sight',
        tentative: rec['tentative'] === true,
        gmapsPlaceId: str(rec['gmaps_place_id']) ?? str(rec['gmapsPlaceId']),
        url: str(rec['url']),
        note: str(rec['note']),
        geo: {
          source: coord ? 'authored' : 'none',
          confidence: coord ? 'high' : 'unknown',
          query: nameEn ?? name,
        },
      })
      placeLines.set(key, fence.line)
    }
  }

  /** 事件引用了未声明的地点 → 自动建档并提醒，而不是报错中断。 */
  const resolvePlaceRef = (name: string, line: number, category: CategoryKey): string => {
    const key = placeKey(name)
    const hit = places.get(key)
    if (hit) return hit.id
    const near = suggest(name, [...places.values()].map((p) => p.name))
    bag.warn(
      line,
      `地点 "${name}" 未在 \`trip-places\` 中声明`,
      near ? `是否指 "${near}"？名称需完全一致` : '将按名称生成地图链接；补进地点表可获得坐标',
    )
    const created: Place = {
      id: makePlaceId(name),
      name,
      coord: null,
      category,
      tentative: false,
      geo: { source: 'none', confidence: 'unknown', query: name },
    }
    places.set(key, created)
    return created.id
  }

  // ── 硬约束 ──
  const constraints: Constraint[] = []
  for (const fence of constraintFences) {
    const list = fence.value
    if (list === null) continue
    if (!Array.isArray(list)) {
      bag.error(fence.line, '`trip-constraints` 必须是一个列表', '每条以 `- kind: ...` 开头')
      continue
    }
    for (const item of list) {
      const rec = asRecord(item)
      if (!rec) continue
      let kindRaw = str(rec['kind']) ?? ''
      // 中文容错
      if (kindRaw === '抵达') kindRaw = 'arrive'
      if (kindRaw === '离开') kindRaw = 'depart'
      const kind = (CONSTRAINT_KINDS as readonly string[]).includes(kindRaw)
        ? (kindRaw as ConstraintKind)
        : null
      if (!kind) {
        const guess = suggest(kindRaw, CONSTRAINT_KINDS)
        bag.error(
          fence.line,
          `约束 kind "${kindRaw}" 无效`,
          guess ? `是否想写 \`${guess}\`？` : `可选值：${CONSTRAINT_KINDS.join(' / ')}`,
        )
        continue
      }
      const label = str(rec['label'])
      if (!label) {
        bag.error(fence.line, `\`${kind}\` 约束缺少 \`label\``)
        continue
      }
      const atRaw = str(rec['at']) ?? ''
      const dt = parseDateTime(atRaw)
      if (!dt) {
        bag.error(fence.line, `约束 "${label}" 的 \`at\` "${atRaw}" 无法解析`, '格式为 `2026-10-05 11:20`')
        continue
      }
      constraints.push({ kind, at: atRaw, date: dt.date, minute: dt.minute, label, note: str(rec['note']) })
    }
  }

  // ── 长租（租车等） ──
  const rentals: Trip['rentals'] = []
  for (const fence of rentalFences) {
    const list = fence.value
    if (list === null) continue
    if (!Array.isArray(list)) {
      bag.error(fence.line, '`trip-rentals` 必须是一个列表', '每项以 `- what: ...` 开头')
      continue
    }
    for (const item of list) {
      const rec = asRecord(item)
      if (!rec) continue
      const what = str(rec['what']) ?? str(rec['item'])
      if (!what) {
        bag.error(fence.line, '`trip-rentals` 里有一项缺少 `what`（租的是什么）')
        continue
      }
      const fromRaw = str(rec['from']) ?? ''
      const toRaw = str(rec['to']) ?? ''
      const from = parseDateTime(fromRaw)
      const to = parseDateTime(toRaw)
      if (!from || !to) {
        bag.error(
          fence.line,
          `租赁「${what}」的 ${!from ? 'from' : 'to'} "${!from ? fromRaw : toRaw}" 无法解析`,
          '格式为 `2026-10-02 11:30`',
        )
        continue
      }
      if (to.date < from.date || (to.date === from.date && to.minute <= from.minute)) {
        bag.error(fence.line, `租赁「${what}」的归还时刻不晚于取用时刻`)
        continue
      }
      const pickup = str(rec['pickup'])
      const dropoff = str(rec['dropoff'])
      rentals.push({
        what,
        platform: str(rec['platform']) ?? str(rec['company']),
        mileage: str(rec['mileage']) ?? str(rec['miles']),
        from: { raw: fromRaw, ...from },
        to: { raw: toRaw, ...to },
        pickupPlaceId: pickup ? resolvePlaceRef(pickup, fence.line, 'logistics') : null,
        dropoffPlaceId: dropoff ? resolvePlaceRef(dropoff, fence.line, 'logistics') : null,
        note: str(rec['note']),
      })
    }
  }

  // ── 天 ──
  const days: Day[] = []
  const seenIndex = new Set<number>()

  rawDays.forEach((rd, order) => {
    if (seenIndex.has(rd.index)) {
      bag.error(rd.line, `Day ${rd.index} 重复出现`)
    }
    seenIndex.add(rd.index)

    const date = rd.dateHint ?? (isIsoDate(start) ? addDays(start, rd.index - 1) : null)
    if (!date) {
      bag.error(rd.line, `Day ${rd.index} 无法确定日期`, '在标题里写 `## Day 1 · 2026-10-01`，或修好 frontmatter 的 start')
      return
    }
    if (!rd.dateHint) {
      bag.warn(rd.line, `Day ${rd.index} 标题没有日期，已按 start 推算为 ${date}`, '建议写成 `## Day ' + rd.index + ' · ' + date + '`')
    }
    if (isIsoDate(start) && isIsoDate(end) && (daysBetween(start, date) < 0 || daysBetween(date, end) < 0)) {
      bag.error(rd.line, `Day ${rd.index} 的日期 ${date} 不在行程区间 ${start} ~ ${end} 内`)
    }

    const dmeta = rd.meta
    const events: TripEvent[] = []
    const legs: Leg[] = []

    // 先建事件，再串 leg —— to_next 需要知道下一个事件的地点
    const pending: { evIndex: number; line: number; rec: Rec }[] = []

    rd.events.forEach((re, i) => {
      const m = re.meta
      if (Object.keys(m).length === 0) {
        bag.error(re.line, `事件「${re.title}」缺少 \`\`\`trip-event 块`, '至少要有 `time` 和 `category`')
        return
      }

      const category = readCategory(bag, re.line, m['category'], `事件「${re.title}」`)
      const timeRaw = str(m['time'])
      if (!timeRaw) {
        bag.error(re.line, `事件「${re.title}」缺少必需字段 \`time\``, '如 `time: 18:25–18:55`')
      }
      const parsedTime = timeRaw ? parseTimeSpec(timeRaw) : null
      if (parsedTime && !parsedTime.ok) {
        bag.error(re.line, `事件「${re.title}」的 ${parsedTime.message}`, parsedTime.hint)
      }
      if (!category || !parsedTime || !parsedTime.ok) return

      const placeName = str(m['place'])
      const pid = placeName ? resolvePlaceRef(placeName, re.line, category) : null

      // 住宿信息块：`stay:` map。全部可空 —— 缺的字段 UI 留「待填」空位
      let stay: TripEvent['stay']
      const srec = asRecord(m['stay'])
      if (srec) {
        stay = {
          platform: str(srec['platform']) ?? str(srec['brand']),
          stars: num(srec['stars']) ?? num(srec['star']),
          room: str(srec['room']),
          parking: str(srec['parking']),
          breakfast: str(srec['breakfast']),
          note: str(srec['note']),
        }
      }

      let booking: TripEvent['booking']
      const brec = asRecord(m['booking'])
      if (brec) {
        const s = str(brec['status']) ?? 'required'
        booking = {
          status: (['required', 'booked', 'none'] as const).includes(s as never)
            ? (s as 'required' | 'booked' | 'none')
            : 'required',
          deadline: str(brec['deadline']),
          note: str(brec['note']),
        }
      }

      // 长途换乘段：`transport:`（单个或列表）；旧写法 `flight:` 仍接受（等价于 mode: flight）。
      // 不限定 category —— 火车抵达的事件可以是 transit，照样挂时间轴卡片。
      // 所有字段都可空：票常常晚于行程定下来，UI 会为缺的字段留「待填」空位。
      const readTransport = (frec: Rec): TripEvent['transports'][number] | null => {
        const modeRaw = str(frec['mode'])
        let mode = modeRaw ? resolveTransport(modeRaw) : null
        if (modeRaw && !mode) {
          const guess = suggestEnum(modeRaw, TRANSPORT_MODES, TRANSPORT_ALIASES)
          bag.warn(
            re.line,
            `transport 的 mode "${modeRaw}" 无法识别，按 flight 处理`,
            guess ? `是否想写 \`${guess}\`？` : undefined,
          )
          mode = 'flight'
        }
        const stopsRaw = Array.isArray(frec['stops']) ? frec['stops'] : []
        return {
          traveler: str(frec['traveler']) ?? str(frec['who']),
          mode: mode ?? 'flight',
          carrier: str(frec['carrier']) ?? str(frec['airline']),
          number: str(frec['number']) ?? str(frec['flight_no']) ?? str(frec['flightNo']) ?? str(frec['no']),
          from: str(frec['from']),
          to: str(frec['to']),
          depDate: str(frec['dep_date']) ?? str(frec['depDate']),
          depTime: str(frec['dep_time']) ?? str(frec['depTime']) ?? str(frec['dep']),
          arrTime: str(frec['arr_time']) ?? str(frec['arrTime']) ?? str(frec['arr']),
          arrDate: str(frec['arr_date']) ?? str(frec['arrDate']),
          arrDayOffset: num(frec['arr_day_offset']) ?? num(frec['arrDayOffset']) ?? 0,
          price: str(frec['price']) ?? str(frec['fare']),
          durationMin: parseDurationMin(frec['duration']),
          baggage: str(frec['baggage']),
          stops: stopsRaw
            .map((sr) => asRecord(sr))
            .filter((sr): sr is Rec => sr !== null)
            .map((sr) => ({
              airport: str(sr['airport']) ?? str(sr['station']) ?? str(sr['place']),
              waitMin: parseDurationMin(sr['wait']),
            })),
          note: str(frec['note']),
        }
      }

      const transports: TripEvent['transports'] = []
      const transportRaw = m['transport'] ?? m['transports']
      for (const item of Array.isArray(transportRaw) ? transportRaw : transportRaw ? [transportRaw] : []) {
        const rec = asRecord(item)
        if (!rec) {
          bag.warn(re.line, `事件「${re.title}」的 transport 列表里有一项不是对象，已忽略`)
          continue
        }
        const t = readTransport(rec)
        if (t) transports.push(t)
      }

      const costRaw = str(m['cost'])
      const { summary, detail } = splitBody(re.body)

      // 注意条目：`notes:` 字符串列表（单条字符串也接受）。别名 warnings。
      const notesRaw = m['notes'] ?? m['warnings']
      const notes = (Array.isArray(notesRaw) ? notesRaw : notesRaw !== undefined ? [notesRaw] : [])
        .map((x) => str(x))
        .filter((s): s is string => s !== undefined)

      // id 不含标题 —— 编辑功能里「改名」是常规操作，改名不该换 id
      // （换 id 会丢收藏、断开草稿 ops 的引用）。天号+位置足够稳定。
      const evId = stableId(`d${rd.index}e`, `${rd.index}|${i}`)
      events.push({
        id: evId,
        title: re.title,
        category,
        startMin: parsedTime.value.startMin,
        endMin: parsedTime.value.endMin,
        timeKind: parsedTime.value.kind,
        timeRaw: timeRaw ?? '',
        placeId: pid,
        flags: readFlags(bag, re.line, m['flags']),
        cost: costRaw ? parseCost(costRaw, num(meta['travelers']) ?? 1, str(meta['currency'])) : undefined,
        booking,
        stay,
        transports,
        summary,
        detail,
        notes,
        variants: re.variants,
      })

      const toNext = asRecord(m['to_next']) ?? asRecord(m['toNext'])
      if (toNext) pending.push({ evIndex: events.length - 1, line: re.line, rec: toNext })
    })

    // 时间倒退检查 —— 排行程最容易犯、最难自己看出来的错
    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1]
      const cur = events[i]
      if (!prev || !cur) continue
      if (cur.timeKind === 'allday' || prev.timeKind === 'allday') continue
      if (cur.startMin < prev.startMin) {
        bag.warn(
          rd.line,
          `Day ${rd.index}：「${cur.title}」(${cur.timeRaw}) 早于上一个事件「${prev.title}」(${prev.timeRaw})`,
          '事件应按时间先后书写；确实跨午夜的话忽略此条',
        )
      }
    }

    for (const p of pending) {
      const from = events[p.evIndex]
      const to = events[p.evIndex + 1]
      if (!from) continue

      // 先校验 mode 再判断有没有去处 —— 两个问题都报出来，比只报一个更省一轮修改
      const modeRaw = str(p.rec['mode']) ?? ''
      const mode = resolveTransport(modeRaw)
      if (!mode) {
        const guess = suggestEnum(modeRaw, TRANSPORT_MODES, TRANSPORT_ALIASES)
        bag.error(
          p.line,
          `\`to_next\` 的 mode "${modeRaw}" 无效`,
          guess ? `是否想写 \`${guess}\`？` : `可选值：${TRANSPORT_MODES.join(' / ')}`,
        )
      }
      if (!to) {
        bag.warn(
          p.line,
          `Day ${rd.index}：「${from.title}」是当天最后一个事件，它的 \`to_next\` 没有去处`,
          '删掉 to_next，或补上下一个事件',
        )
        continue
      }
      if (!mode) continue

      const durationMin = num(p.rec['minutes']) ?? num(p.rec['min']) ?? null

      // 余量检查：两个事件之间的空档，装不装得下中间那段路？
      // 这正是原始 MD 逼着人在脑子里算的东西 —— 算错了整天崩盘，而且自己极难看出来。
      if (durationMin !== null && from.timeKind !== 'period' && to.timeKind !== 'period') {
        const slack = to.startMin - from.endMin - durationMin
        if (slack < 0) {
          bag.warn(
            p.line,
            `Day ${rd.index} 时间冲突：「${from.title}」${from.timeKind === 'point' ? '' : '结束'}` +
              `到「${to.title}」开始只有 ${to.startMin - from.endMin} 分钟，` +
              `但这段路要 ${durationMin} 分钟`,
            `差 ${-slack} 分钟。把前一个事件提早结束，或把后一个推后`,
          )
        }
      }

      legs.push({
        id: stableId(`d${rd.index}l`, `${from.id}|${to.id}`),
        afterEventId: from.id,
        from: from.placeId,
        to: to.placeId,
        mode,
        durationMin,
        distanceKm: num(p.rec['km']) ?? null,
        label: str(p.rec['label']),
        note: str(p.rec['note']),
        geometry: null,
      })
    }

    const lodgingName = str(dmeta['lodging'])
    days.push({
      index: rd.index,
      date,
      weekday: weekdayOf(date),
      theme: str(dmeta['theme']),
      color: dayColor(order + 1),
      sunrise: str(dmeta['sunrise']),
      sunset: str(dmeta['sunset']),
      lodging: lodgingName
        ? {
            placeId: places.get(placeKey(lodgingName))?.id ?? resolvePlaceRef(lodgingName, rd.line, 'hotel'),
            name: lodgingName,
            note: str(dmeta['lodging_note']),
          }
        : undefined,
      fallbackOrder: Array.isArray(dmeta['fallback_order'])
        ? (dmeta['fallback_order'] as unknown[]).map((x) => String(x).trim()).filter(Boolean)
        : [],
      intro: rd.intro,
      events,
      legs,
    })
  })

  days.sort((a, b) => a.date.localeCompare(b.date))

  // ── 附录 ──
  const refs: Reference[] = []
  const refIds = new Set<string>()
  for (const r of rawRefs) {
    let id = str(r.meta['id']) ?? stableId('ref-', r.title)
    if (refIds.has(id)) {
      bag.warn(r.line, `附录 id "${id}" 重复，已自动改名`)
      id = `${id}-${refIds.size}`
    }
    refIds.add(id)
    refs.push({ id, icon: str(r.meta['icon']), title: r.title, markdown: r.markdown })
  }

  // ── 坐标离群检测（无需联网） ──
  // 西经漏负号会把西雅图画到中国境内，而且完全静默。
  // 不做 geocoding 也能抓到它：所有坐标本该聚成一团，离群的那个就是错的。
  checkCoordOutliers(bag, [...places.values()], placeLines)

  const trip: Trip = {
    id: str(meta['id']) ?? 'untitled',
    title: str(meta['title']) ?? '未命名行程',
    subtitle: str(meta['subtitle']),
    destination: str(meta['destination']) ?? '',
    timezone: str(meta['timezone']) ?? 'UTC',
    dates: { start, end },
    travelers: num(meta['travelers']),
    currency: str(meta['currency']),
    constraints,
    rentals,
    places: [...places.values()],
    days,
    reference: refs,
  }

  if (bag.hasErrors) return { trip: null, diagnostics: bag.sorted() }

  const checked = TripSchema.safeParse(trip)
  if (!checked.success) {
    for (const issue of checked.error.issues) {
      bag.error(fm.line, `schema 校验失败 @ ${issue.path.join('.')}：${issue.message}`)
    }
    return { trip: null, diagnostics: bag.sorted() }
  }

  return { trip: checked.data, diagnostics: bag.sorted() }
}

function checkCoordOutliers(
  bag: DiagnosticBag,
  places: Place[],
  lines: Map<string, number>,
): void {
  const withCoord = places.filter((p): p is Place & { coord: [number, number] } => p.coord !== null)
  if (withCoord.length < 3) return

  const median = (xs: number[]): number => {
    const s = [...xs].sort((a, b) => a - b)
    return s[Math.floor(s.length / 2)] ?? 0
  }
  const mLng = median(withCoord.map((p) => p.coord[0]))
  const mLat = median(withCoord.map((p) => p.coord[1]))

  // 一趟旅行的地点通常在几度之内。10 度 ≈ 1100km，超出必是录入错误而非真的跑那么远。
  const LIMIT = 10

  for (const p of withCoord) {
    const [lng, lat] = p.coord
    const dLng = Math.abs(lng - mLng)
    const dLat = Math.abs(lat - mLat)
    if (dLng <= LIMIT && dLat <= LIMIT) continue

    const line = lines.get(placeKey(p.name)) ?? 1
    let hint = `其余地点集中在 ${mLat.toFixed(2)}, ${mLng.toFixed(2)} 附近`

    if (Math.abs(-lng - mLng) <= LIMIT && dLat <= LIMIT) {
      hint = `经度符号反了 —— 应为 ${(-lng).toFixed(4)}（西经是负数）`
    } else if (Math.abs(-lat - mLat) <= LIMIT && dLng <= LIMIT) {
      hint = `纬度符号反了 —— 应为 ${(-lat).toFixed(4)}（南纬是负数）`
    } else if (Math.abs(lat - mLng) <= LIMIT && Math.abs(lng - mLat) <= LIMIT) {
      hint = `纬度和经度写反了 —— 应为 \`coord: ${lng}, ${lat}\`（纬度在前）`
    }

    bag.error(line, `地点 "${p.name}" 的坐标 ${lat}, ${lng} 离其余地点太远`, hint)
  }
}
