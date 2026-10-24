import { TripSchema, type Reference, type Trip } from '@jjj/schema'
import { DiagnosticBag, type Diagnostic } from './diagnostics.ts'
import { lex } from './lexer.ts'
import {
  asRecord,
  count,
  display,
  isoDate,
  oneOf,
  readRecord,
  schemaGate,
  text,
  timezone,
  yamlOf,
  type Fields,
  type RecordSpec,
  type Values,
} from './read.ts'
import { scanSections } from './sections.ts'
import {
  makePlaceResolver,
  readConstraints,
  readFrontBlocks,
  readPlaces,
  type ParseCtx,
} from './blocks.ts'
import { buildDays } from './days.ts'
import { checkCoordOutliers, lintDayFlow, lintDayOpening, lintUnreferenced } from './lint.ts'
import { detailIndex } from './resolve.ts'
import { daysBetween, stableId } from './values.ts'
import { VISIBILITY } from './vocab.ts'

/**
 * TripMD → Trip 的编排层。真正的活分给四个模块，这里只管顺序与装配：
 *
 *   lex → scanSections（结构）→ blocks（前置块语义）→ buildDays（天/事件/leg）
 *       → detailIndex 灌首次引用 → lint（语义检查）→ schemaGate（TripSchema 兜底）
 *
 * 解析器是全仓唯一校验器 —— 每一步都往同一个 DiagnosticBag 里写，
 * 有 error 就不出 Trip；warning 全部带行号与修复建议。
 */

const FRONTMATTER = {
  block: 'frontmatter',
  fields: {
    id: { read: text, required: '如 `id: kyoto-2026-04`，与行程目录同名' },
    title: { read: text, required: '行程标题，如 `title: 京都两日`' },
    subtitle: display,
    destination: { read: text, required: '如 `destination: 京都`' },
    timezone: { read: timezone, required: '如 `timezone: Asia/Tokyo`' },
    start: { read: isoDate, required: '格式为 YYYY-MM-DD' },
    end: { read: isoDate, required: '格式为 YYYY-MM-DD' },
    travelers: { read: count },
    currency: { read: text },
    // 拼错的 visibility 不能兜成 public —— 那是把私事发出去；按 private 处理并大声说
    visibility: { read: oneOf(VISIBILITY), level: 'warning', otherwise: '按 private 处理' },
  },
} satisfies RecordSpec<Fields>

const REF = {
  block: 'trip-ref',
  fields: {
    id: { read: text },
    icon: display,
  },
} satisfies RecordSpec<Fields>

export interface ParseResult {
  trip: Trip | null
  diagnostics: Diagnostic[]
}

export function parse(src: string): ParseResult {
  const bag = new DiagnosticBag()
  const tokens = lex(src)

  // ── frontmatter ──
  const fm = tokens.find((t) => t.kind === 'frontmatter')
  if (!fm || fm.kind !== 'frontmatter') {
    bag.error(1, '缺少 frontmatter', '文件必须以 --- 开头，声明 id / title / destination / timezone / start / end')
    return { trip: null, diagnostics: bag.sorted() }
  }
  // frontmatter 从第 2 行开始（第 1 行是 `---`），YAML 的行号要平移这么多
  const head = yamlOf(bag, fm.line - 1, fm.yaml, 'frontmatter')
  const meta = asRecord(head.value)
  if (head.value !== null && !meta) bag.error(fm.line, 'frontmatter 应为键值对', '每行写成 `键: 值`')
  // YAML 坏了就不按字段表读：语法错误已报，再报一串「缺少必需字段」只会把真正的那条挤到后面
  const v: Values<typeof FRONTMATTER.fields> = head.broken ? {} : readRecord(bag, head.cursor, meta ?? {}, FRONTMATTER, 'frontmatter')
  const start = v.start ?? ''
  const end = v.end ?? ''
  if (v.start && v.end && daysBetween(start, end) < 0) {
    bag.error(head.cursor.lineOf('end'), `frontmatter 的 \`end\` (${end}) 早于 \`start\` (${start})`)
  }

  const ctx: ParseCtx = {
    bag,
    travelers: v.travelers ?? 1,
    currency: v.currency,
  }

  // ── 分区扫描 ──
  const scan = scanSections(bag, tokens)
  if (scan.rawDays.length === 0) {
    bag.error(fm.line, '文档里没有任何 Day 分区', '每天用一个 `## Day 1 · 2026-10-01` 标题开头')
  }

  // ── 前置块 ──
  const { places, placeLines } = readPlaces(bag, scan.placeFences)
  const resolvePlaceRef = makePlaceResolver(bag, places)
  const constraints = readConstraints(bag, scan.constraintFences)
  const { journeys, stays, rentals, detailNames, detailLines } = readFrontBlocks(ctx, scan, resolvePlaceRef)

  // ── 天 ──
  // stays 也进来：当天的开场通勤（住处 → 第一站）从住宿区间认领起点
  const { days, flows } = buildDays(ctx, scan.rawDays, {
    dates: { start, end },
    resolvePlaceRef,
    detailNames,
    stays,
  })
  days.sort((a, b) => a.date.localeCompare(b.date))

  // 没人引用的前置记录要警告；引用扫描在 resolve.ts，与前端挂模块、预算记账日是同一份
  const refIndex = detailIndex(days)

  // ── 语义 lint ──
  lintDayFlow(bag, flows)
  lintDayOpening(bag, flows)
  lintUnreferenced(bag, { journeys, stays, rentals }, refIndex.firstRef, detailLines)
  checkCoordOutliers(bag, [...places.values()], placeLines)

  // ── 附录 ──
  const refs: Reference[] = []
  const refIds = new Set<string>()
  for (const r of scan.rawRefs) {
    const rv: Values<typeof REF.fields> = r.meta && !r.meta.broken ? readRecord(bag, r.meta.at, r.meta.rec, REF, `附录「${r.title}」`) : {}
    const wanted = rv.id ?? stableId('ref-', r.title)
    // 撞了就往后找第一个空着的后缀 —— 拿已有条数当后缀会撞上下一个
    let id = wanted
    for (let n = 2; refIds.has(id); n++) id = `${wanted}-${n}`
    if (id !== wanted) bag.warn(r.line, `附录 id "${wanted}" 重复，已改名为 "${id}"`, rv.id ? '换一个不重复的 `id:`' : '改个标题，或写一个 `id:`')
    refIds.add(id)
    refs.push({ id, icon: rv.icon, title: r.title, markdown: r.markdown })
  }

  const trip: Trip = {
    id: v.id ?? 'untitled',
    title: v.title ?? '未命名行程',
    subtitle: v.subtitle,
    destination: v.destination ?? '',
    timezone: v.timezone ?? 'UTC',
    dates: { start, end },
    travelers: v.travelers,
    currency: v.currency,
    visibility: v.visibility ?? 'private',
    constraints,
    journeys,
    stays,
    rentals,
    places: [...places.values()],
    days,
    reference: refs,
  }

  if (bag.hasErrors) return { trip: null, diagnostics: bag.sorted() }
  return { trip: schemaGate(bag, fm.line, TripSchema, trip), diagnostics: bag.sorted() }
}
