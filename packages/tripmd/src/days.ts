import { dayColor, type Day, type Leg, type Stay, type TripEvent } from '@jjj/schema'
import { suggest } from './diagnostics.ts'
import {
  clock,
  display,
  duration,
  isoDate,
  listOf,
  nested,
  noteText,
  oneOf,
  oneRecord,
  positive,
  readRecord,
  text,
  timeSpec,
  type Fields,
  type RecordSpec,
  type Values,
} from './read.ts'
import { parseCost, splitBody } from './cost.ts'
import type { ParseCtx, PlaceResolver } from './blocks.ts'
import type { RawDay } from './sections.ts'
import { stayOfMorning } from './resolve.ts'
import { addDays, daysBetween, isIsoDate, stableId, weekdayOf } from './values.ts'
import { BOOKING_STATUS, CATEGORY, FLAG, TRANSPORT_MODE } from './vocab.ts'

/**
 * 天 / 事件 / 通勤段的构建。
 *
 * 只管把中间表示变成结构 —— 时间倒退、余量冲突这类**语义检查**不在这里做，
 * 构建时顺手收集 lint 需要的行号与 to_next 痕迹（DayFlow），交给 lint.ts 统一跑：
 * 检查规则从此可以单独测试、单独扩充，不用再在构建循环里见缝插针。
 */

// ── 字段表 ──────────────────────────────────────────────────────

const EVENT = {
  block: 'trip-event',
  fields: {
    time: { read: timeSpec, required: '如 `time: 18:25–18:55`' },
    category: { read: oneOf(CATEGORY), required: `可选值：${CATEGORY.keys.join(' / ')}` },
    place: { read: text },
    flags: { read: listOf(oneOf(FLAG), { split: /[,，]/ }), level: 'warning' },
    cost: { read: text },
    booking: { read: nested },
    // detail: 引用前置块（长途 / 住宿 / 长租），事件只留一根指针专注行程本身
    detail: { read: text },
    notes: { read: listOf(noteText), aliases: ['warnings'], level: 'warning' },
    to_next: { read: nested, aliases: ['toNext'] },
  },
  // 换乘与住宿明细都搬到了顶层前置块；留在事件上会静默丢失，必须拦住
  retired: {
    stay: ['`stay:` 已不再写在事件上', '改写进顶层 `trip-stays` 块（带 from/to 的一条区间记录），事件里写 `detail: 名字` 引用'],
    transport: ['`transport:` 已不再写在事件上', '明细写进顶层 `trip-transports` 块，事件里写 `detail: 名字` 引用'],
    transports: ['`transports:` 已不再写在事件上', '明细写进顶层 `trip-transports` 块，事件里写 `detail: 名字` 引用'],
  },
} satisfies RecordSpec<Fields>

const BOOKING = {
  block: 'booking',
  fields: {
    // 拼错必须报错，不能静默兜底成 required —— 那会把「已订」读成「待订」，语义正好反过来
    status: { read: oneOf(BOOKING_STATUS) },
    deadline: { read: isoDate },
    note: display,
  },
} satisfies RecordSpec<Fields>

/** 通勤记录（`to_next` / `from_stay`）两处形状完全相同，连诊断都该一模一样 —— 只有块名不同 */
function flowSpec(block: 'to_next' | 'from_stay') {
  return {
    block,
    fields: {
      mode: { read: oneOf(TRANSPORT_MODE), required: `如 \`mode: walk\`；可选值：${TRANSPORT_MODE.keys.join(' / ')}` },
      minutes: { read: duration, aliases: ['min'] },
      km: { read: positive },
      label: display,
      note: display,
    },
  } satisfies RecordSpec<Fields>
}
const TO_NEXT = flowSpec('to_next')
const FROM_STAY = flowSpec('from_stay')
type Flow = Values<typeof TO_NEXT.fields>

const DAY = {
  block: 'trip-day',
  fields: {
    theme: display,
    sunrise: { read: clock, level: 'warning' },
    sunset: { read: clock, level: 'warning' },
    from_stay: { read: nested, aliases: ['fromStay'] },
  },
  retired: {
    lodging: ['`trip-day` 的 `lodging` 已不再使用', '改写进顶层 `trip-stays` 块：一次写清 from/to，不用每天重复'],
    lodging_note: ['`trip-day` 的 `lodging_note` 已不再使用', '写进顶层 `trip-stays` 那条住宿的 `note`'],
  },
} satisfies RecordSpec<Fields>

/** 通勤记录里除 mode 外的那几个值 */
function flowValues(f: Flow): Pick<Leg, 'durationMin' | 'distanceKm' | 'label' | 'note'> {
  return { durationMin: f.minutes ?? null, distanceKm: f.km ?? null, label: f.label, note: f.note }
}

/** lint 的输入：一天的事件流 + 谁写了 to_next（含 mode 无效的，口径与旧实现一致） */
export interface DayFlow {
  index: number
  /** Day 标题行号 —— 顺序/重叠警告挂在这里 */
  line: number
  events: TripEvent[]
  legs: Leg[]
  /** 写了 to_next 的事件下标 → 该事件的行号 */
  toNext: Map<number, number>
  /** 开场通勤的素材：当天该在哪儿醒来、作者写没写 `from_stay` */
  opening: { stay: Stay | null; declared: boolean }
}

export interface BuiltDays {
  days: Day[]
  flows: DayFlow[]
}

/** buildDays 要的前置素材。具名而不是继续排位置参数 —— 到第六个就没人读得懂了 */
export interface DayContext {
  dates: { start: string; end: string }
  resolvePlaceRef: PlaceResolver
  detailNames: Map<string, string>
  /** 住宿区间 —— 开场通勤的起点从这里认领 */
  stays: Stay[]
}

export function buildDays(ctx: ParseCtx, rawDays: RawDay[], front: DayContext): BuiltDays {
  const { bag } = ctx
  const { resolvePlaceRef, detailNames, stays } = front
  const { start, end } = front.dates
  const days: Day[] = []
  const flows: DayFlow[] = []
  const seenIndex = new Map<number, number>()
  const seenDate = new Map<string, number>()

  rawDays.forEach((rd) => {
    if (rd.index < 1) {
      bag.error(rd.line, `Day ${rd.index} 的天号不对，从 1 开始数`, '第一天写 `## Day 1 · 2026-10-01`')
      return
    }
    const sameIndex = seenIndex.get(rd.index)
    if (sameIndex !== undefined) bag.error(rd.line, `Day ${rd.index} 重复出现（第一次在第 ${sameIndex} 行）`)
    seenIndex.set(rd.index, rd.line)

    if (rd.date && !rd.date.iso) {
      bag.error(rd.line, `Day ${rd.index} 标题上的日期「${rd.date.written}」不是真实存在的日期`, '写成 YYYY-MM-DD，月和日补零，如 `## Day 1 · 2026-10-01`')
      return
    }
    const written = rd.date?.iso ?? null
    const byIndex = isIsoDate(start) ? addDays(start, rd.index - 1) : null
    const date = written ?? byIndex
    if (!date) {
      bag.error(rd.line, `Day ${rd.index} 无法确定日期`, '在标题里写 `## Day 1 · 2026-10-01`，或修好 frontmatter 的 start')
      return
    }
    if (!written) {
      bag.warn(rd.line, `Day ${rd.index} 标题没有日期，已按 start 推算为 ${date}`, '建议写成 `## Day ' + rd.index + ' · ' + date + '`')
    } else if (byIndex && byIndex !== written) {
      bag.warn(
        rd.line,
        `Day ${rd.index} 标题上的日期是 ${written}，按 start（${start}）推算 Day ${rd.index} 应是 ${byIndex}`,
        '以标题上的日期为准；天号或日期改对其中一个',
      )
    }
    const sameDate = seenDate.get(date)
    if (sameDate !== undefined) {
      bag.error(rd.line, `Day ${rd.index} 的日期 ${date} 与第 ${sameDate} 行那一天重复`, '一个日期只能有一个 Day 分区')
    }
    seenDate.set(date, rd.line)
    if (isIsoDate(start) && isIsoDate(end) && (daysBetween(start, date) < 0 || daysBetween(date, end) < 0)) {
      bag.error(rd.line, `Day ${rd.index} 的日期 ${date} 不在行程区间 ${start} ~ ${end} 内`)
    }

    const dv: Values<typeof DAY.fields> = rd.meta && !rd.meta.broken ? readRecord(bag, rd.meta.at, rd.meta.rec, DAY, `Day ${rd.index}`) : {}
    const events: TripEvent[] = []
    const legs: Leg[] = []

    // 先建事件，再串 leg —— to_next 需要知道下一个事件的地点
    const pending: { evIndex: number; line: number; flow: Flow }[] = []

    rd.events.forEach((re, i) => {
      if (!re.meta) {
        bag.error(re.line, `事件「${re.title}」缺少 \`\`\`trip-event 块`, '至少要有 `time` 和 `category`')
        return
      }
      if (re.meta.broken) return // YAML 错误已报；再按字段表读只会多出一串「缺少必需字段」
      const where = `事件「${re.title}」`
      const { at } = re.meta
      const v = readRecord(bag, at, re.meta.rec, EVENT, where)
      if (!v.category || !v.time) return

      const pid = v.place ? resolvePlaceRef(v.place, at.lineOf('place'), v.category) : null

      let booking: TripEvent['booking']
      const b = oneRecord(bag, v.booking, `${where}的 \`booking\` `)
      if (b) {
        const bv = readRecord(bag, b.at, b.rec, BOOKING, `${where}的预订`)
        booking = { status: bv.status ?? 'required', deadline: bv.deadline, note: bv.note }
      }

      // 明细的灌入（长途时间轴）在天排序之后做 —— 「首次引用」按日期序判定
      let detailRef: string | undefined
      if (v.detail !== undefined) {
        if (detailNames.has(v.detail)) {
          detailRef = v.detail
        } else {
          const guess = suggest(v.detail, [...detailNames.keys()])
          bag.error(
            at.lineOf('detail'),
            `${where}引用的「${v.detail}」不在任何前置块里`,
            guess ? `是否指「${guess}」？` : '先在顶层 trip-transports / trip-stays / trip-rentals 里声明',
          )
        }
      }

      const { summary, detail } = splitBody(re.body)

      // id 不含标题 —— 编辑功能里「改名」是常规操作，改名不该换 id
      // （换 id 会丢收藏、断开草稿 ops 的引用）。天号+位置足够稳定。
      const evId = stableId(`d${rd.index}e`, `${rd.index}|${i}`)
      events.push({
        id: evId,
        title: re.title,
        category: v.category,
        startMin: v.time.startMin,
        endMin: v.time.endMin,
        timeKind: v.time.kind,
        timeRaw: v.time.raw,
        placeId: pid,
        flags: [...new Set(v.flags ?? [])],
        cost: v.cost ? parseCost(v.cost, ctx.travelers, ctx.currency) : undefined,
        booking,
        detailRef,
        summary,
        detail,
        notes: v.notes ?? [],
        variants: re.variants,
      })

      const toNext = oneRecord(bag, v.to_next, `${where}的 \`to_next\` `)
      if (toNext) {
        const flow = readRecord(bag, toNext.at, toNext.rec, TO_NEXT, `${where}的 to_next`)
        pending.push({ evIndex: events.length - 1, line: toNext.at.line, flow })
      }
    })

    // ── 开场通勤：昨晚住处 → 今天第一站。它排在所有 to_next 之前 ──
    const stay = stayOfMorning(stays, date)
    const fromStay = oneRecord(bag, dv.from_stay, `Day ${rd.index} 的 \`from_stay\` `)
    if (fromStay) {
      const flow = readRecord(bag, fromStay.at, fromStay.rec, FROM_STAY, `Day ${rd.index} 的 from_stay`)
      const line = fromStay.at.line
      const first = events[0]
      if (!first) {
        bag.warn(line, `Day ${rd.index} 没有任何事件，\`from_stay\` 没有去处`, '删掉 from_stay，或补上事件')
      } else if (!stay) {
        bag.error(
          line,
          `Day ${rd.index} 写了 \`from_stay\`，但当天早上没有住宿区间覆盖`,
          '落地当天本来就不从住处出发；否则检查 `trip-stays` 的 from/to 是否漏了这一晚',
        )
      } else if (stay.placeId && stay.placeId === first.placeId) {
        bag.error(
          line,
          `Day ${rd.index} 的第一个事件「${first.title}」就在住处「${stay.what}」`,
          '这段路不存在，删掉 `from_stay`',
        )
      } else if (flow.mode) {
        legs.push({
          id: stableId(`d${rd.index}l`, `stay|${first.id}`),
          afterEventId: null,
          from: stay.placeId,
          to: first.placeId,
          mode: flow.mode,
          ...flowValues(flow),
          geometry: null,
        })
      }
    }

    for (const p of pending) {
      const from = events[p.evIndex]
      const to = events[p.evIndex + 1]
      if (!from) continue
      if (!to) {
        bag.warn(
          p.line,
          `Day ${rd.index}：「${from.title}」是当天最后一个事件，它的 \`to_next\` 没有去处`,
          '删掉 to_next，或补上下一个事件',
        )
        continue
      }
      if (!p.flow.mode) continue

      legs.push({
        id: stableId(`d${rd.index}l`, `${from.id}|${to.id}`),
        afterEventId: from.id,
        from: from.placeId,
        to: to.placeId,
        mode: p.flow.mode,
        ...flowValues(p.flow),
        geometry: null,
      })
    }

    days.push({
      index: rd.index,
      date,
      weekday: weekdayOf(date),
      theme: dv.theme,
      // 用 day.index 而非书写顺序 —— serialize 总按日期排序输出，
      // 若源文件里 Day 2 写在 Day 1 前面，取书写顺序会让往返前后颜色互换，破坏语义幂等
      color: dayColor(rd.index),
      sunrise: dv.sunrise,
      sunset: dv.sunset,
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
      opening: { stay, declared: fromStay !== null },
    })
  })

  return { days, flows }
}
