import { Armchair, ArrowLeftRight, Luggage } from 'lucide-react'
import { TRANSPORTS, type Transport, type TransportMode, type TransportStop } from '@jjj/schema'
import { iconFor } from '../../lib/icons.tsx'
import { timelineDates } from '@jjj/tripmd'
import { formatDurationCompact, roundMoneyText } from '../../lib/format.ts'
import { segFlyDurations } from '../../lib/segment-durations.ts'
import { Arrow, DateLine, Dot, Field, SlotText, TimeStack } from './ticket-parts.tsx'
import { SHOW_EMPTY_SLOTS, shownTerms } from '../../lib/public.ts'

/**
 * 长途换乘时间轴 —— 电子客票的版式，不钉死为航班（mode 决定图标与槽位文案）：
 *
 *   [她] ✈ 达美 Delta · 全程 14h25m                        $842
 *   08:05         10:55        13:35              15:30     ← 时刻在线上方
 *   11/19                                         11/20⁺¹   ← 日期另起一行，跨日红色 +n
 *   ●━━2h50m━━━○╌╌╌2h40m╌╌╌○━━━8h55m━━━▶             ← 每段用时卡在线上，Σ = 全程
 *   LAX T2               SEA                      HND T3    ← 线下方只放小字地点（带航站楼）
 *   🪑 舱位 DL7 · 经济舱 · 36C    🧳 托运 2 件 · 直挂    ⇄ 退改 改签 $200 起   ← 条款一行
 *           DL167 · 经济舱 · 22A                                              （中转每段一行叠在舱位格里）
 *
 * 实线 = 行进段，虚线 = 中转停留，段长按时长分配。
 * 同地中转的位置放虚线正下方居中；异地中转到达点在虚线起点下方、
 * 再出发点在虚线终点下方；航站楼就写在地点名里（PVG T1）。
 * 标题行只放承运方 —— 班次号属于舱位格，直飞和中转同一种读法。
 * 条款行放不下时整行横向滚动、不显示滚动条 —— 与时间轴同一套做法。
 *
 * **多人汇合**：一个事件挂多条 transport，逐条堆叠，各自带 traveler 标签。
 * **每个字段都可以缺。** 票常常晚于行程定下来 —— 缺的字段渲染成
 * 虚线框「待填」空位，骨架永远完整，之后人工或 Agent 补进 TripMD。
 */

/** 按交通方式定槽位文案 —— 机场/车站/港口不该共用一个词 */
const MODE_SLOTS: Record<
  TransportMode,
  {
    who: string
    from: string
    to: string
    cabin: string | null
    bag: string | null
    stop: string
  }
> = {
  flight: { who: '航司', from: '出发机场', to: '到达机场', cabin: '舱位', bag: '托运', stop: '中转' },
  rail: { who: '承运', from: '出发站', to: '到达站', cabin: '座席', bag: '行李', stop: '换乘' },
  hsr: { who: '承运', from: '出发站', to: '到达站', cabin: '座席', bag: '行李', stop: '换乘' },
  monorail: { who: '承运', from: '出发站', to: '到达站', cabin: null, bag: null, stop: '换乘' },
  streetcar: { who: '承运', from: '出发站', to: '到达站', cabin: null, bag: null, stop: '换乘' },
  bus: { who: '客运', from: '出发站', to: '到达站', cabin: '座位', bag: '行李', stop: '经停' },
  ferry: { who: '船司', from: '出发港', to: '到达港', cabin: '舱位', bag: '行李', stop: '经停' },
  drive: { who: '车辆 / 租车行', from: '出发地', to: '到达地', cabin: null, bag: null, stop: '休息点' },
  rideshare: { who: '平台 / 车型', from: '出发地', to: '到达地', cabin: null, bag: null, stop: '经停' },
  bike: { who: '车辆', from: '出发地', to: '到达地', cabin: null, bag: null, stop: '休息点' },
  walk: { who: '路线', from: '出发地', to: '到达地', cabin: null, bag: null, stop: '休息点' },
}

export function TransportTimeline({
  transports,
  date,
}: {
  transports: Transport[]
  /** 事件所在天的日期 —— dep_date/arr_date 缺省时的推算锚点 */
  date?: string
}) {
  return (
    <div className="mt-2.5 space-y-2">
      {transports.map((t, i) => (
        <SingleTransport key={i} t={t} date={date} />
      ))}
    </div>
  )
}

type Seg =
  | { kind: 'fly'; min: number | null; grow: number }
  | { kind: 'wait'; stop: TransportStop; grow: number }

function SingleTransport({ t: flight, date }: { t: Transport; date?: string }) {
  const slots = MODE_SLOTS[flight.mode]
  const ModeIcon = iconFor(TRANSPORTS[flight.mode].icon)
  const stops = flight.stops
  // 舱位行：直飞一行（顶层班次/客舱/座位），中转每段一行（legs，缺的客舱/座位从顶层兜底）
  const cabinRows =
    flight.legs.length > 0
      ? flight.legs.map((l) => ({
          number: l.number,
          cabin: l.cabin ?? flight.cabin,
          seat: l.seat ?? flight.seat,
        }))
      : [{ number: flight.number, cabin: flight.cabin, seat: flight.seat }]
  // 时刻是输入、日期是派生：整条轴的日期由 timelineDates 一次算出，
  // 每个节点的红色 +n 都用同一个 dayOffsetOf(出发日, 该节点) —— 不存在两套口径
  const dates = timelineDates(flight, date)
  const depDate = dates.dep

  const flyMins = segFlyDurations(flight)
  let waitIdx = -1
  const segs: Seg[] = []
  for (let i = 0; i <= stops.length; i++) {
    segs.push({ kind: 'fly', min: flyMins[i] ?? null, grow: flyMins[i] ?? 180 })
    const stop = stops[i]
    if (stop) segs.push({ kind: 'wait', stop, grow: stop.waitMin ?? 60 })
  }
  // 三行（分段时长 / 线 / 节点）必须逐段同宽才能对齐 —— 统一的最小宽度。
  // 行进段也要有下限：段两端各压着一个时刻标签（居中于端点），比例过悬殊时
  // 短段会被压到几十像素，两个标签直接叠在一起。比例失真好过读不出来。
  const minW = (s: Seg, i: number): string => {
    if (s.kind === 'wait') return s.stop.depAirport ? '8rem' : '4.5rem'
    // 首尾段外侧压着 15px 的大时刻，中间段两侧只有 11px 小时刻
    return i === 0 || i === segs.length - 1 ? '4.75rem' : '3rem'
  }

  // 条款行的三格。舱位格按 mode 决定有没有（单轨、步行没有座席这回事），且中转时一段一行，
  // 所以单独判；托运 / 退改是普通的「标签 + 值」，缺值画不画交给 shownTerms。
  // mode 没有行李这一格（步行、网约车）时不留空槽，但作者真写了 baggage 就照画 —— 静默丢数据是 bug
  const hasCabinRow =
    (SHOW_EMPTY_SLOTS && slots.cabin !== null) || cabinRows.some((r) => r.number || r.cabin || r.seat)
  const terms = shownTerms([
    ...(slots.bag !== null || flight.baggage ? [{ label: slots.bag ?? '行李', value: flight.baggage, Icon: Luggage }] : []),
    { label: '退改', value: flight.refund, Icon: ArrowLeftRight },
  ])
  const hasTerms = hasCabinRow || terms.length > 0

  return (
    <div className="rounded-lg bg-[var(--paper-sunken)] px-3.5 pb-3 pt-2.5">
      {/* 行 1：乘客 · 承运/班次 · 全程 ……金额 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
        {flight.traveler && (
          <span className="rounded-full bg-ink px-1.5 py-px text-[10px] font-medium leading-tight text-paper">
            {flight.traveler}
          </span>
        )}
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <ModeIcon size={12} className="shrink-0 text-graphite" aria-hidden />
          <SlotText value={flight.carrier} hint={slots.who} />
        </span>
        {(flight.durationMin !== null || SHOW_EMPTY_SLOTS) && (
          <span className="tnum text-graphite">
            {flight.durationMin !== null ? `全程 ${formatDurationCompact(flight.durationMin)}` : '全程 —'}
          </span>
        )}
        {/* 票价钉右上角：订好了是金色金额，没订是等着填的预算槽；公开版没钱这一格 */}
        {flight.price ? (
          <span className="tnum ml-auto text-[13px] font-semibold tint-faved">{roundMoneyText(flight.price)}</span>
        ) : (
          <Field label="预算" value={undefined} className="ml-auto" />
        )}
      </div>

      {/* 行 3–5 是同一根轴的三层，必须同宽同步滚动 ——
          段宽有下限（时刻标签要放得下），窄屏放不下时整根轴在自己的容器里横向滚，
          页面本身永不横向滚动。三行包在同一个滚动容器里才不会各滚各的 */}
      <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="min-w-max">
      {/* 行 3：时刻与日期，压在时间轴上方。两端是 时刻/日期 两行栈
          （跨日在日期右上角标红色 +n），中转段两端标到发时刻 */}
      <div className="mt-2.5 flex items-end">
        {segs.map((s, i) => {
          const first = i === 0
          const last = i === segs.length - 1
          if (s.kind === 'wait') {
            waitIdx += 1
            const d = dates.stops[waitIdx]
            // 到发时刻以虚线两端的圆点为中心 —— 贴边对齐会差出半个标签宽
            return (
              <span
                key={i}
                className="relative h-8"
                style={{ flexGrow: s.grow, flexBasis: 0, minWidth: minW(s, i) }}
              >
                {s.stop.arrTime && (
                  <span className="absolute bottom-0 left-0 flex -translate-x-1/2 flex-col items-center">
                    <span className="tnum text-[11px] leading-4 text-soft">{s.stop.arrTime}</span>
                    <DateLine date={d?.arr} base={depDate} />
                  </span>
                )}
                {s.stop.depTime && (
                  <span className="absolute bottom-0 right-0 flex translate-x-1/2 flex-col items-center">
                    <span className="tnum text-[11px] leading-4 text-soft">{s.stop.depTime}</span>
                    <DateLine date={d?.dep} base={depDate} />
                  </span>
                )}
              </span>
            )
          }
          return (
            <span
              key={i}
              className={`flex gap-2 ${
                first && last ? 'justify-between' : first ? 'justify-start' : last ? 'justify-end' : ''
              }`}
              style={{ flexGrow: s.grow, flexBasis: 0, minWidth: minW(s, i) }}
            >
              {first && <TimeStack time={flight.depTime} date={depDate} align="left" />}
              {last && (
                <TimeStack time={flight.arrTime} date={dates.arr} base={depDate} align="right" />
              )}
            </span>
          )
        })}
      </div>

      {/* 行 4：●━━行进━━ ○╌╌中转╌╌○ ━━行进━━▶
          起点圆点/终点箭头画在首尾段**内部**，保证每一行的分段盒完全同构 ——
          中转到发时刻才能对准虚线两端。每段用时垫底色直接卡在线上，
          不占线上方的时刻位置；各段 + 停留 = 全程 */}
      <div className="mt-1.5 flex items-center" aria-hidden>
        {segs.map((s, i) => {
          const first = i === 0
          const last = i === segs.length - 1
          const label =
            stops.length > 0
              ? s.kind === 'fly'
                ? s.min !== null
                  ? formatDurationCompact(s.min)
                  : ''
                : s.stop.waitMin !== null
                  ? formatDurationCompact(s.stop.waitMin)
                  : '—'
              : ''
          return (
            <span
              key={i}
              className="relative flex items-center"
              style={{ flexGrow: s.grow, flexBasis: 0, minWidth: minW(s, i) }}
            >
              {s.kind === 'fly' ? (
                <>
                  {first && <Dot />}
                  <span className="h-[2px] flex-1 rounded-full bg-ink/50" />
                  {last && <Arrow />}
                </>
              ) : (
                <>
                  <Dot small />
                  <span className="h-0 flex-1 border-t-[2px] border-dashed border-ink/30" />
                  <Dot small />
                </>
              )}
              {label && (
                <span
                  className="tnum absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                             whitespace-nowrap bg-[var(--paper-sunken)] px-1 text-[9.5px]
                             leading-none text-graphite"
                >
                  {label}
                </span>
              )}
            </span>
          )
        })}
      </div>

      {/* 行 5：线下方只放小字地点。同地中转居中，异地分列虚线两端 */}
      <div className="mt-1 flex items-start">
        {segs.map((s, i) => {
          const first = i === 0
          const last = i === segs.length - 1
          if (s.kind === 'wait') {
            const sameSpot = !s.stop.depAirport
            return sameSpot ? (
              <span
                key={i}
                className="truncate text-center text-[10.5px] leading-4 text-graphite"
                style={{ flexGrow: s.grow, flexBasis: 0, minWidth: minW(s, i) }}
              >
                {s.stop.airport ?? slots.stop}
              </span>
            ) : (
              <span
                key={i}
                className="relative h-4 text-[10.5px] leading-4 text-graphite"
                style={{ flexGrow: s.grow, flexBasis: 0, minWidth: minW(s, i) }}
              >
                <span className="absolute left-0 top-0 max-w-[7rem] -translate-x-1/2 overflow-hidden text-ellipsis whitespace-nowrap">
                  {s.stop.airport ?? slots.stop}
                </span>
                <span className="absolute right-0 top-0 max-w-[7rem] translate-x-1/2 overflow-hidden text-ellipsis whitespace-nowrap">
                  {s.stop.depAirport}
                </span>
              </span>
            )
          }
          return (
            <span
              key={i}
              className={`flex gap-2 text-[10.5px] leading-4 ${
                first && last ? 'justify-between' : first ? 'justify-start' : last ? 'justify-end' : ''
              }`}
              style={{ flexGrow: s.grow, flexBasis: 0, minWidth: minW(s, i) }}
            >
              {/* 两端各自包一层：公开版里被抹掉的那一端 SlotText 返回 null，
                  不留这个空盒的话 justify-between 只剩一个子元素，
                  目的地会滑到出发端的位置（抵达票上「SEA」跑到左边）。
                  包的这层必须是 flex：SlotText 的 truncate 只在它自己是 flex 子项（块级化）时生效，
                  套在普通 inline 盒里 overflow 不作用，长站名就撑破分段、三行轴对不齐 */}
              {first && (
                <span className="flex min-w-0">
                  <SlotText value={flight.from} hint={slots.from} />
                </span>
              )}
              {last && (
                <span className="flex min-w-0">
                  <SlotText value={flight.to} hint={slots.to} />
                </span>
              )}
            </span>
          )
        })}
      </div>

      </div>
      </div>

      {/* 行 6：条款行 —— 舱位 · 托运 · 退改 三格排一行，每格图标 + 标签 + 值。
          舱位格里中转每段一行叠放（班次 · 客舱 · 座位），托运/退改对齐第一行。
          一行放不下就整行横向滚动、藏滚动条 —— 和上面的时间轴同一套容器写法 */}
      {hasTerms && (
        <div className="mt-2 border-t border-[var(--hairline)] pt-2 text-[11px] leading-[18px]">
          <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* 三格都以 18px 行盒对齐：单行格自身就是一个行盒；舱位格里每段各占一个行盒，
                图标和标签各自也是 18px 高、内容居中 —— 于是不管哪一行冒出待填槽，
                标签、图标、正文、槽位的中线全在同一高度 */}
            <div className="flex min-w-max items-start gap-x-4 whitespace-nowrap">
              {hasCabinRow && (
                <span className="inline-flex items-start gap-1.5">
                  <span className="flex h-[18px] items-center">
                    <Armchair size={12} className="shrink-0 text-graphite" aria-hidden />
                  </span>
                  <span className="text-graphite">{slots.cabin ?? '舱位'}</span>
                  <span className="flex flex-col">
                    {cabinRows.map((r, i) => (
                      <span key={i} className="flex h-[18px] items-center gap-x-1.5">
                        <SlotText value={r.number} hint="班次" mono />
                        <span className="text-graphite/60">·</span>
                        <SlotText value={r.cabin} hint="客舱" />
                        <span className="text-graphite/60">·</span>
                        <SlotText value={r.seat} hint="座位" />
                      </span>
                    ))}
                  </span>
                </span>
              )}
              {terms.map(({ label, value, Icon }) => (
                <Field
                  key={label}
                  label={label}
                  value={value}
                  className="h-[18px]"
                  icon={<Icon size={12} className="shrink-0 text-graphite" aria-hidden />}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {flight.note && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-graphite">{flight.note}</p>
      )}
    </div>
  )
}


