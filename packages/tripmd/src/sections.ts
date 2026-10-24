import type { Variant } from '@jjj/schema'
import { DiagnosticBag, suggest } from './diagnostics.ts'
import { asRecord, yamlOf, type Cursor, type Located, type Rec } from './read.ts'
import { proseOf, type Token } from './lexer.ts'
import { headingDate } from './values.ts'

/**
 * 分区扫描 —— token 流到中间表示的状态机。
 *
 * 只认结构（标题层级 + 围栏块类型），不读任何字段语义：
 * 产出 RawDay / RawRef 与五组前置块围栏，语义解析交给 blocks / days。
 * 每个围栏都带着它的 YAML 位置（Cursor），诊断才能指到具体那一项、那个字段。
 * 状态机是解析器里唯一关心「现在读到哪儿」的地方，切出来之后
 * 其余模块都是纯的「数据进、数据出」。
 */

/** 一个读成单条记录的结构块（`trip-day` / `trip-event` / `trip-ref`）：键值对、它的 YAML 位置、开围栏那一行 */
export interface MetaBlock {
  rec: Rec
  at: Cursor
  line: number
  /** YAML 语法错误（已报）—— 不再按字段表读，免得再报一串「缺少必需字段」 */
  broken: boolean
}

export interface RawEvent {
  line: number
  title: string
  /** null = 没写 ```trip-event 块 */
  meta: MetaBlock | null
  body: string
  variants: Variant[]
}

export interface RawDay {
  line: number
  index: number
  /** 标题上写的日期；写了但不存在时 iso 为 null（见 values.ts 的 headingDate） */
  date: { written: string; iso: string | null } | null
  headingText: string
  meta: MetaBlock | null
  intro: string
  events: RawEvent[]
}

export interface RawRef {
  line: number
  title: string
  meta: MetaBlock | null
  markdown: string
}

/** 前置块的一个围栏：YAML 值 + 位置；`line` 是开围栏那一行 */
export interface Fence extends Located {
  line: number
}

export interface ScanResult {
  rawDays: RawDay[]
  rawRefs: RawRef[]
  constraintFences: Fence[]
  journeyFences: Fence[]
  stayFences: Fence[]
  rentalFences: Fence[]
  placeFences: Fence[]
}

/** TripMD 认的结构块 —— 别的 `trip-*` 是拼错了，不能当成普通代码块吞进正文 */
const FENCES = ['trip-constraints', 'trip-transports', 'trip-stays', 'trip-rentals', 'trip-places', 'trip-day', 'trip-event', 'trip-ref'] as const

const DAY_HEADING = /^(?:day\s*(\d+)|第\s*(\d+)\s*天)/i
const APPENDIX_HEADING = /^(?:附录|资料|appendix)\s*[·:：|\-—]\s*(.+)$/i
const VARIANT_HEADING = /^(?:变体|备选|variant|alt)\s*[·:：|\-—]\s*(.+)$/i

export function scanSections(bag: DiagnosticBag, tokens: Token[]): ScanResult {
  const rawDays: RawDay[] = []
  const rawRefs: RawRef[] = []
  const constraintFences: Fence[] = []
  const journeyFences: Fence[] = []
  const stayFences: Fence[] = []
  const rentalFences: Fence[] = []
  const placeFences: Fence[] = []

  type Ctx =
    | { mode: 'top'; buf: Token[]; line: number; heading: string }
    | { mode: 'day'; day: RawDay; buf: Token[] }
    | { mode: 'event'; day: RawDay; ev: RawEvent; buf: Token[] }
    | { mode: 'variant'; day: RawDay; ev: RawEvent; variant: Variant; buf: Token[] }
    | { mode: 'ref'; ref: RawRef; buf: Token[] }

  let ctx: Ctx = { mode: 'top', buf: [], line: 1, heading: '' }

  type FenceToken = Extract<Token, { kind: 'fence' }>
  const fenceOf = (t: FenceToken): Fence => ({ line: t.line, ...yamlOf(bag, t.line, t.content, t.info) })
  /**
   * 结构块读成一条记录。同一个事件 / 天 / 附录写了两个同类块是错误，两处行号都报出来 ——
   * 后一个若悄悄覆盖前一个，前一个里写的就全丢了
   */
  const metaOf = (t: FenceToken, prev: MetaBlock | null, owner: string): MetaBlock => {
    if (prev) {
      bag.error(t.line, `${owner}有两个 \`${t.info}\` 块（第 ${prev.line} 行与第 ${t.line} 行）`, '合并成一个；后一个已忽略')
      return prev
    }
    const { value, cursor, broken = false } = yamlOf(bag, t.line, t.content, t.info)
    const rec = asRecord(value)
    if (value !== null && !rec) bag.error(t.line, `\`${t.info}\` 块应为键值对`, '每行写成 `键: 值`')
    return { rec: rec ?? {}, at: cursor, line: t.line, broken }
  }
  /** 认不出的 `trip-*` 围栏：整块会被当成正文，里面写的全丢 */
  const unknownFence = (t: FenceToken): void => {
    const guess = suggest(t.info, FENCES)
    bag.error(t.line, `\`${t.info}\` 不是 TripMD 的结构块，整块被当成了正文`, guess ? `是否想写 \`${guess}\`？` : `结构块有：${FENCES.join(' / ')}`)
  }

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
        // 顶层散文不会进入任何视图 —— 写了却看不见就是静默丢数据，一句也要提醒
        if (text.trim()) {
          bag.warn(
            ctx.line,
            `「${ctx.heading || '文档开头'}」下有约 ${text.replace(/\s/g, '').length} 字正文不会出现在任何视图里`,
            '要展示的话，放进 `## 附录 · 标题` 分区；Day 分区之前的说明可以写进 Day 1 标题下',
          )
        }
        break
    }
    ctx.buf = []
  }

  for (const t of tokens) {
    if (t.kind === 'frontmatter') continue

    // 少了一行闭合的代码块会吞掉后面的天、附录 —— 吞到文件尾，或者吞进下一个结构块，都要报
    if (t.kind === 'fence' && t.swallowed) {
      bag.error(
        t.line,
        `第 ${t.line} 行开始的代码块把第 ${t.swallowed.line} 行的 \`${t.swallowed.info}\` 也吞了进去，中间的内容全被当成了代码`,
        '多半是这个代码块少了一行闭合的 ```；要在里面展示 TripMD 示例的话，外层改用四个反引号 ````',
      )
    } else if (t.kind === 'fence' && !t.closed) {
      bag.error(t.line, `第 ${t.line} 行开始的代码块一直没有闭合，之后的全部内容都被当成了代码`, '在代码块结束处补上一行 ```')
    }

    // 附录内部一切照单全收，包括 ### / #### 和代码块 —— 但 TripMD 的结构块不收：写在这里不会被读取
    if (ctx.mode === 'ref' && !(t.kind === 'heading' && t.level <= 2)) {
      if (t.kind === 'fence' && t.info === 'trip-ref') {
        ctx.ref.meta = metaOf(t, ctx.ref.meta, `附录「${ctx.ref.title}」`)
        continue
      }
      if (t.kind === 'fence' && /^trip-/i.test(t.info)) {
        if ((FENCES as readonly string[]).includes(t.info)) {
          bag.error(t.line, `\`${t.info}\` 块写在了附录「${ctx.ref.title}」里，不会被读取`, '附录的内容原样进资料页；把这个块移到第一个 `## 附录` 之前')
        } else {
          unknownFence(t)
        }
      }
      ctx.buf.push(t)
      continue
    }

    if (t.kind === 'fence') {
      switch (t.info) {
        case 'trip-constraints':
          constraintFences.push(fenceOf(t))
          continue
        case 'trip-transports':
          journeyFences.push(fenceOf(t))
          continue
        case 'trip-stays':
          stayFences.push(fenceOf(t))
          continue
        case 'trip-rentals':
          rentalFences.push(fenceOf(t))
          continue
        case 'trip-places':
          placeFences.push(fenceOf(t))
          continue
        case 'trip-day':
          if (ctx.mode === 'day') ctx.day.meta = metaOf(t, ctx.day.meta, `Day ${ctx.day.index} `)
          else bag.error(t.line, '`trip-day` 块出现在 Day 分区之外', '它必须紧跟在 `## Day N` 标题之后、第一个事件之前')
          continue
        case 'trip-event':
          if (ctx.mode === 'event') ctx.ev.meta = metaOf(t, ctx.ev.meta, `事件「${ctx.ev.title}」`)
          else bag.error(t.line, '`trip-event` 块出现在事件之外', '它必须紧跟在 Day 分区内的 `### 事件标题` 之后')
          continue
        case 'trip-ref':
          bag.error(t.line, '`trip-ref` 块出现在附录分区之外', '它必须紧跟在 `## 附录 · 标题` 之后')
          continue
        default:
          if (/^trip-/i.test(t.info)) unknownFence(t)
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
          ref: { line: t.line, title: (appendix[1] ?? '').trim(), meta: null, markdown: '' },
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
          date: headingDate(t.text),
          headingText: t.text,
          meta: null,
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
        const ev: RawEvent = { line: t.line, title: t.text, meta: null, body: '', variants: [] }
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

  return { rawDays, rawRefs, constraintFences, journeyFences, stayFences, rentalFences, placeFences }
}
