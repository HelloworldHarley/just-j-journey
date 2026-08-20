import { TripSchema, type Reference, type Trip } from '@jjj/schema'
import { DiagnosticBag, type Diagnostic } from './diagnostics.ts'
import { lex } from './lexer.ts'
import { asRecord, num, str, yamlOf } from './read.ts'
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
import { daysBetween, isIsoDate, stableId } from './values.ts'

/**
 * TripMD → Trip 的编排层。真正的活分给四个模块，这里只管顺序与装配：
 *
 *   lex → scanSections（结构）→ blocks（前置块语义）→ buildDays（天/事件/leg）
 *       → detailIndex 灌首次引用 → lint（语义检查）→ TripSchema.safeParse 门
 *
 * 解析器是全仓唯一校验器 —— 每一步都往同一个 DiagnosticBag 里写，
 * 有 error 就不出 Trip；warning 全部带行号与修复建议。
 */

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

  const ctx: ParseCtx = {
    bag,
    travelers: num(meta['travelers']) ?? 1,
    currency: str(meta['currency']),
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
  const { journeys, stays, rentals, detailNames } = readFrontBlocks(ctx, scan, resolvePlaceRef)

  // ── 天 ──
  // stays 也进来：当天的开场通勤（住处 → 第一站）从住宿区间认领起点
  const { days, flows } = buildDays(ctx, scan.rawDays, {
    dates: { start, end },
    resolvePlaceRef,
    detailNames,
    stays,
  })
  days.sort((a, b) => a.date.localeCompare(b.date))

  // 「首次引用」按日期序判定，所以必须排完序再算 —— 若按书写序，
  // Day 2 写在 Day 1 前面的文件往返一次后首卡会换人，破坏语义幂等。
  // 扫描本身在 resolve.ts —— 前端挂信息模块、预算记账日用的是同一份。
  const refIndex = detailIndex(days)
  const eventById = new Map(days.flatMap((d) => d.events).map((e) => [e.id, e]))
  for (const journey of journeys) {
    const evId = refIndex.firstRef.get(journey.what)
    const ev = evId === undefined ? undefined : eventById.get(evId)
    if (ev) ev.transports = journey.transports
  }

  // ── 语义 lint ──
  lintDayFlow(bag, flows)
  lintDayOpening(bag, flows)
  lintUnreferenced(bag, { journeys, stays, rentals }, refIndex.firstRef)
  checkCoordOutliers(bag, [...places.values()], placeLines)

  // ── 附录 ──
  const refs: Reference[] = []
  const refIds = new Set<string>()
  for (const r of scan.rawRefs) {
    let id = str(r.meta['id']) ?? stableId('ref-', r.title)
    if (refIds.has(id)) {
      bag.warn(r.line, `附录 id "${id}" 重复，已自动改名`)
      id = `${id}-${refIds.size}`
    }
    refIds.add(id)
    refs.push({ id, icon: str(r.meta['icon']), title: r.title, markdown: r.markdown })
  }

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
    journeys,
    stays,
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
