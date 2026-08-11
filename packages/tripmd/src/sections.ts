import type { Variant } from '@jjj/schema'
import { DiagnosticBag } from './diagnostics.ts'
import { asRecord, yamlOf, type Rec } from './read.ts'
import { proseOf, type Token } from './lexer.ts'
import { extractDate } from './values.ts'

/**
 * 分区扫描 —— token 流到中间表示的状态机。
 *
 * 只认结构（标题层级 + 围栏块类型），不读任何字段语义：
 * 产出 RawDay / RawRef 与五组前置块围栏，语义解析交给 blocks / days。
 * 状态机是解析器里唯一关心「现在读到哪儿」的地方，切出来之后
 * 其余模块都是纯的「数据进、数据出」。
 */

export interface RawEvent {
  line: number
  title: string
  meta: Rec
  body: string
  variants: Variant[]
}

export interface RawDay {
  line: number
  index: number
  dateHint: string | null
  headingText: string
  meta: Rec
  intro: string
  events: RawEvent[]
}

export interface RawRef {
  line: number
  title: string
  meta: Rec
  markdown: string
}

export interface Fence {
  line: number
  value: unknown
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
        case 'trip-transports':
          journeyFences.push({ line: t.line, value: yamlOf(bag, t.line, t.content, 'trip-transports') })
          continue
        case 'trip-stays':
          stayFences.push({ line: t.line, value: yamlOf(bag, t.line, t.content, 'trip-stays') })
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

  return { rawDays, rawRefs, constraintFences, journeyFences, stayFences, rentalFences, placeFences }
}
