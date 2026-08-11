import {
  TRANSPORT_ALIASES,
  TRANSPORT_MODES,
  dayColor,
  resolveTransport,
  type Day,
  type Leg,
  type TripEvent,
} from '@jjj/schema'
import { suggest, suggestEnum } from './diagnostics.ts'
import {
  BOOKING_KEYS,
  EVENT_KEYS,
  DAY_KEYS,
  TO_NEXT_KEYS,
  asRecord,
  checkKeys,
  num,
  readCategory,
  readFlags,
  str,
} from './read.ts'
import { parseCost, splitBody } from './cost.ts'
import type { ParseCtx, PlaceResolver } from './blocks.ts'
import type { RawDay } from './sections.ts'
import { addDays, daysBetween, isIsoDate, parseTimeSpec, stableId, weekdayOf } from './values.ts'

/**
 * 天 / 事件 / 通勤段的构建。
 *
 * 只管把中间表示变成结构 —— 时间倒退、余量冲突这类**语义检查**不在这里做，
 * 构建时顺手收集 lint 需要的行号与 to_next 痕迹（DayFlow），交给 lint.ts 统一跑：
 * 检查规则从此可以单独测试、单独扩充，不用再在构建循环里见缝插针。
 */

const BOOKING_STATUSES = ['required', 'booked', 'none'] as const

/** lint 的输入：一天的事件流 + 谁写了 to_next（含 mode 无效的，口径与旧实现一致） */
export interface DayFlow {
  index: number
  /** Day 标题行号 —— 顺序/重叠警告挂在这里 */
  line: number
  events: TripEvent[]
  legs: Leg[]
  /** 写了 to_next 的事件下标 → 该事件的行号 */
  toNext: Map<number, number>
}

export interface BuiltDays {
  days: Day[]
  flows: DayFlow[]
}

export function buildDays(
  ctx: ParseCtx,
  rawDays: RawDay[],
  dates: { start: string; end: string },
  resolvePlaceRef: PlaceResolver,
  detailNames: Map<string, string>,
): BuiltDays {
  const { bag } = ctx
  const { start, end } = dates
  const days: Day[] = []
  const flows: DayFlow[] = []
  const seenIndex = new Set<number>()

  rawDays.forEach((rd) => {
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
    checkKeys(bag, dmeta, DAY_KEYS, rd.line, 'trip-day')
    const events: TripEvent[] = []
    const legs: Leg[] = []

    // 先建事件，再串 leg —— to_next 需要知道下一个事件的地点
    const pending: { evIndex: number; line: number; rec: Record<string, unknown> }[] = []

    rd.events.forEach((re, i) => {
      const m = re.meta
      if (Object.keys(m).length === 0) {
        bag.error(re.line, `事件「${re.title}」缺少 \`\`\`trip-event 块`, '至少要有 `time` 和 `category`')
        return
      }
      checkKeys(bag, m, EVENT_KEYS, re.line, 'trip-event')

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

      // 住宿信息从事件搬到了顶层 trip-stays。留在这里的 `stay:` 会静默丢失，必须拦住
      if (m['stay'] !== undefined) {
        bag.error(
          re.line,
          '`stay:` 已不再写在事件上',
          '改写进顶层 `trip-stays` 块（带 from/to 的一条区间记录）',
        )
      }

      let booking: TripEvent['booking']
      const brec = asRecord(m['booking'])
      if (brec) {
        checkKeys(bag, brec, BOOKING_KEYS, re.line, 'booking')
        const s = str(brec['status']) ?? 'required'
        // 拼错必须报错，不能静默兜底成 required —— 那会把「已订」读成「待订」，
        // 语义正好反过来，行前清单上还会多出一项根本不存在的待办
        let status: 'required' | 'booked' | 'none' = 'required'
        if ((BOOKING_STATUSES as readonly string[]).includes(s)) {
          status = s as 'required' | 'booked' | 'none'
        } else {
          const guess = suggest(s, BOOKING_STATUSES)
          bag.error(
            re.line,
            `事件「${re.title}」的 booking status "${s}" 无效`,
            guess ? `是否想写 \`${guess}\`？` : `可选值：${BOOKING_STATUSES.join(' / ')}`,
          )
        }
        booking = {
          status,
          deadline: str(brec['deadline']),
          note: str(brec['note']),
        }
      }

      // 换乘明细不再写在事件上 —— 全部住在顶层 trip-transports，事件用 detail: 引用
      if (m['transport'] !== undefined || m['transports'] !== undefined) {
        bag.error(
          re.line,
          '`transport:` 已不再写在事件上',
          '明细写进顶层 `trip-transports` 块，事件里写 `detail: 名字` 引用',
        )
      }

      // detail: 引用前置块（长途 / 住宿 / 长租），事件只留一根指针专注行程本身。
      // 明细的灌入（长途时间轴）在天排序之后做 —— 「首次引用」按日期序判定
      let detailRef: string | undefined
      const detailRaw = m['detail']
      if (detailRaw !== undefined) {
        const name = str(detailRaw)
        if (!name) {
          bag.error(re.line, `事件「${re.title}」的 \`detail\` 是空的`, '写前置记录的名字，如 `detail: Astra Hotel`')
        } else if (!detailNames.has(name)) {
          const guess = suggest(name, [...detailNames.keys()])
          bag.error(
            re.line,
            `事件「${re.title}」引用的「${name}」不在任何前置块里`,
            guess ? `是否指「${guess}」？` : '先在顶层 trip-transports / trip-stays / trip-rentals 里声明',
          )
        } else {
          detailRef = name
        }
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
        cost: costRaw ? parseCost(costRaw, ctx.travelers, ctx.currency) : undefined,
        booking,
        transports: [],
        detailRef,
        summary,
        detail,
        notes,
        variants: re.variants,
      })

      const toNext = asRecord(m['to_next']) ?? asRecord(m['toNext'])
      if (toNext) {
        checkKeys(bag, toNext, TO_NEXT_KEYS, re.line, 'to_next')
        pending.push({ evIndex: events.length - 1, line: re.line, rec: toNext })
      }
    })

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

      legs.push({
        id: stableId(`d${rd.index}l`, `${from.id}|${to.id}`),
        afterEventId: from.id,
        from: from.placeId,
        to: to.placeId,
        mode,
        durationMin: num(p.rec['minutes']) ?? num(p.rec['min']) ?? null,
        distanceKm: num(p.rec['km']) ?? null,
        label: str(p.rec['label']),
        note: str(p.rec['note']),
        geometry: null,
      })
    }

    // lodging 已升格为顶层 trip-stays 的区间记录，留在这里会静默丢失
    if (dmeta['lodging'] !== undefined || dmeta['lodging_note'] !== undefined) {
      bag.error(
        rd.line,
        '`trip-day` 的 `lodging` 已不再使用',
        '改写进顶层 `trip-stays` 块：一次写清 from/to，不用每天重复',
      )
    }
    days.push({
      index: rd.index,
      date,
      weekday: weekdayOf(date),
      theme: str(dmeta['theme']),
      // 用 day.index 而非书写顺序 —— serialize 总按日期排序输出，
      // 若源文件里 Day 2 写在 Day 1 前面，取书写顺序会让往返前后颜色互换，破坏语义幂等
      color: dayColor(rd.index),
      sunrise: str(dmeta['sunrise']),
      sunset: str(dmeta['sunset']),
      intro: rd.intro,
      events,
      legs,
    })
    flows.push({
      index: rd.index,
      line: rd.line,
      events,
      legs,
      toNext: new Map(pending.map((p) => [p.evIndex, p.line])),
    })
  })

  return { days, flows }
}
