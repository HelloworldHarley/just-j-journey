import { Luggage } from 'lucide-react'
import { TRANSPORTS, type Transport, type TransportMode, type TransportStop } from '@jjj/schema'
import { iconFor } from '../lib/icons.tsx'

/**
 * 长途换乘时间轴 —— 电子客票的版式，不钉死为航班（mode 决定图标与槽位文案）：
 *
 *   [她] ✈ 达美 Delta DL7 · 全程 14h25m                    $842
 *   08:05         10:55        13:35              15:30     ← 时刻在线上方
 *   11/19                                         11/20⁺¹   ← 日期另起一行，跨日红色 +n
 *   ●━━2h50m━━━○╌╌╌2h40m╌╌╌○━━━8h55m━━━▶             ← 每段用时卡在线上，Σ = 全程
 *   LAX                  SEA                      HND T3    ← 线下方只放小字地点
 *   客舱 经济舱 · 托运 2 件 23kg · 直挂 · 退改 改签 $200 起
 *
 * 实线 = 行进段，虚线 = 中转停留，段长按时长分配。
 * 同地中转的位置放虚线正下方居中；异地中转到达点在虚线起点下方、
 * 再出发点在虚线终点下方。行李直挂并入「托运」，直飞不写、中转才写。
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
  flight: { who: '航司 · 航班号', from: '出发机场', to: '到达机场', cabin: '客舱', bag: '托运', stop: '中转' },
  rail: { who: '承运 · 车次', from: '出发站', to: '到达站', cabin: '座席', bag: '行李', stop: '换乘' },
  hsr: { who: '承运 · 车次', from: '出发站', to: '到达站', cabin: '座席', bag: '行李', stop: '换乘' },
  monorail: { who: '承运 · 班次', from: '出发站', to: '到达站', cabin: null, bag: null, stop: '换乘' },
  streetcar: { who: '承运 · 班次', from: '出发站', to: '到达站', cabin: null, bag: null, stop: '换乘' },
  bus: { who: '客运 · 班次', from: '出发站', to: '到达站', cabin: '座位', bag: '行李', stop: '经停' },
  ferry: { who: '船司 · 班次', from: '出发港', to: '到达港', cabin: '舱位', bag: '行李', stop: '经停' },
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

const md8 = (iso: string) => iso.slice(5).replace('-', '/')

function plusDays(iso: string, d: number): string {
  const t = new Date(`${iso}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + d)
  return t.toISOString().slice(0, 10)
}

/** "HH:MM" → 分钟；不合法返回 null */
function clockMin(t?: string): number | null {
  const m = t ? /^(\d{1,2}):(\d{2})$/.exec(t.trim()) : null
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00Z`) - Date.parse(`${a}T00:00Z`)) / 86_400_000)
}

/**
 * 中转点的到发日期。作者可显式写（跨日期变更线时必须）；
 * 缺省从出发日期沿时刻推进 —— 时钟回卷（后一时刻小于前一时刻）就进位一天。
 * 同时区行程（火车/巴士/轮渡）这个推算是精确的。
 */
function stopDates(t: Transport, depDate?: string): { arr?: string; dep?: string }[] {
  let cur = depDate
  let prev = clockMin(t.depTime)
  return t.stops.map((s) => {
    const step = (authored: string | undefined, time: string | undefined): string | undefined => {
      const min = clockMin(time)
      if (authored) {
        cur = authored
        prev = min ?? prev
        return authored
      }
      if (!cur || min === null) return undefined
      if (prev !== null && min < prev) cur = plusDays(cur, 1)
      prev = min
      return cur
    }
    return { arr: step(s.arrDate, s.arrTime), dep: step(s.depDate, s.depTime) }
  })
}

/**
 * 每个行进段的显示时长。中转前的段可由作者用 `leg` 提供（跨时区没法算），
 * 没提供的段按「全程 − Σ停留 − Σ已填段」均分 —— 各段与停留加起来恒等于全程。
 */
function segFlyDurations(t: Transport): (number | null)[] {
  const n = t.stops.length + 1
  const perSeg: (number | null)[] = [...t.stops.map((s) => s.legMin), null]
  if (t.durationMin === null || t.stops.some((s) => s.waitMin === null)) return perSeg

  const totalFly = t.durationMin - t.stops.reduce((a, s) => a + (s.waitMin ?? 0), 0)
  const authoredSum = perSeg.reduce<number>((a, m) => a + (m ?? 0), 0)
  const unknown = perSeg.flatMap((m, i) => (m === null ? [i] : []))
  const remaining = totalFly - authoredSum
  if (unknown.length === 0 || remaining <= 0) return perSeg

  const each = Math.floor(remaining / unknown.length)
  unknown.forEach((idx, k) => {
    perSeg[idx] = k === unknown.length - 1 ? remaining - each * (unknown.length - 1) : each
  })
  void n
  return perSeg
}

type Seg =
  | { kind: 'fly'; min: number | null; grow: number }
  | { kind: 'wait'; stop: TransportStop; grow: number }

function SingleTransport({ t: flight, date }: { t: Transport; date?: string }) {
  const slots = MODE_SLOTS[flight.mode]
  const ModeIcon = iconFor(TRANSPORTS[flight.mode].icon)
  const stops = flight.stops
  // 日期：没写就按事件当天为出发日推算，到达日再加 arr_day_offset
  const depDate = flight.depDate ?? date
  const arrDate = flight.arrDate ?? (depDate ? plusDays(depDate, flight.arrDayOffset) : undefined)

  const flyMins = segFlyDurations(flight)
  const sDates = stopDates(flight, depDate)
  let waitIdx = -1
  const segs: Seg[] = []
  for (let i = 0; i <= stops.length; i++) {
    segs.push({ kind: 'fly', min: flyMins[i] ?? null, grow: flyMins[i] ?? 180 })
    const stop = stops[i]
    if (stop) segs.push({ kind: 'wait', stop, grow: stop.waitMin ?? 60 })
  }
  // 三行（分段时长 / 线 / 节点）必须逐段同宽才能对齐 —— 统一的最小宽度：
  // 行进段很窄也没关系；停留段要装下到发时刻，异地换乘还要装两个地名
  const minW = (s: Seg) => (s.kind === 'fly' ? '1rem' : s.stop.depAirport ? '8rem' : '4.5rem')

  const hasDescRow =
    slots.cabin !== null || slots.bag !== null || flight.cabin || flight.baggage || flight.refund || flight.throughCheck

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
          <SlotText value={joinSlot(flight.carrier, flight.number)} hint={slots.who} mono />
        </span>
        <span className="tnum text-graphite">
          {flight.durationMin !== null ? `全程 ${fmtDur(flight.durationMin)}` : '全程 —'}
        </span>
        {/* 票价钉右上角：订好了是金色金额，没订是等着填的预算槽 */}
        <span className="ml-auto inline-flex items-center gap-1.5">
          {flight.price ? (
            <span className="tnum text-[13px] font-semibold tint-faved">{flight.price}</span>
          ) : (
            <>
              <span className="text-graphite">预算</span>
              <SlotText value={undefined} hint="待填" />
            </>
          )}
        </span>
      </div>

      {/* 行 3：时刻与日期，压在时间轴上方。两端是 时刻/日期 两行栈
          （跨日在日期右上角标红色 +n），中转段两端标到发时刻 */}
      <div className="mt-2.5 flex items-end">
        {segs.map((s, i) => {
          const first = i === 0
          const last = i === segs.length - 1
          if (s.kind === 'wait') {
            waitIdx += 1
            const d = sDates[waitIdx]
            // 到发时刻以虚线两端的圆点为中心 —— 贴边对齐会差出半个标签宽
            return (
              <span
                key={i}
                className="relative h-8"
                style={{ flexGrow: s.grow, flexBasis: 0, minWidth: minW(s) }}
              >
                {s.stop.arrTime && (
                  <span className="absolute bottom-0 left-0 flex -translate-x-1/2 flex-col items-center">
                    <span className="tnum text-[11px] leading-4 text-soft">{s.stop.arrTime}</span>
                    <StopDate date={d?.arr} base={depDate} />
                  </span>
                )}
                {s.stop.depTime && (
                  <span className="absolute bottom-0 right-0 flex translate-x-1/2 flex-col items-center">
                    <span className="tnum text-[11px] leading-4 text-soft">{s.stop.depTime}</span>
                    <StopDate date={d?.dep} base={depDate} />
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
              style={{ flexGrow: s.grow, flexBasis: 0, minWidth: minW(s) }}
            >
              {first && <TimeStack time={flight.depTime} date={depDate} align="left" />}
              {last && (
                <TimeStack
                  time={flight.arrTime}
                  date={arrDate}
                  dayOffset={flight.arrDayOffset}
                  align="right"
                />
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
                  ? fmtDur(s.min)
                  : ''
                : s.stop.waitMin !== null
                  ? fmtDur(s.stop.waitMin)
                  : '—'
              : ''
          return (
            <span
              key={i}
              className="relative flex items-center"
              style={{ flexGrow: s.grow, flexBasis: 0, minWidth: minW(s) }}
            >
              {s.kind === 'fly' ? (
                <>
                  {first && <Dot />}
                  <span className="h-[2px] flex-1 rounded-full bg-ink/50" />
                  {last && (
                    <span className="-ml-px h-0 w-0 border-y-[4px] border-l-[7px] border-y-transparent border-l-ink/50" />
                  )}
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
                style={{ flexGrow: s.grow, flexBasis: 0, minWidth: minW(s) }}
              >
                {s.stop.airport ?? slots.stop}
              </span>
            ) : (
              <span
                key={i}
                className="relative h-4 text-[10.5px] leading-4 text-graphite"
                style={{ flexGrow: s.grow, flexBasis: 0, minWidth: minW(s) }}
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
              style={{ flexGrow: s.grow, flexBasis: 0, minWidth: minW(s) }}
            >
              {first && <SlotText value={flight.from} hint={slots.from} />}
              {last && <SlotText value={flight.to} hint={slots.to} />}
            </span>
          )
        })}
      </div>

      {/* 行 5：客舱 · 托运 · 直挂 · 退改 */}
      {hasDescRow && (
        <div
          className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 border-t
                     border-[var(--hairline)] pt-2 text-[11px]"
        >
          {(slots.cabin !== null || flight.cabin) && (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-graphite">{slots.cabin ?? '客舱'}</span>
              <SlotText value={flight.cabin} hint="待填" />
            </span>
          )}
          {(slots.bag !== null || flight.baggage) && (
            <span className="inline-flex items-center gap-1.5">
              <Luggage size={12} className="shrink-0 text-graphite" aria-hidden />
              <span className="text-graphite">{slots.bag ?? '行李'}</span>
              {/* 行李直挂并入托运展示；直飞没有直挂概念，中转才写 */}
              <SlotText
                value={joinDot(flight.baggage, stops.length > 0 ? flight.throughCheck : undefined)}
                hint="待填"
              />
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className="text-graphite">退改</span>
            <SlotText value={flight.refund} hint="待填" />
          </span>
        </div>
      )}

      {flight.note && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-graphite">{flight.note}</p>
      )}
    </div>
  )
}

/** 中转点时刻下的小日期：与出发日不同天时标红色 +n */
function StopDate({ date, base }: { date?: string; base?: string }) {
  if (!date) return null
  const offset = base ? diffDays(base, date) : 0
  return (
    <span className="tnum text-[10.5px] leading-4 text-graphite">
      {md8(date)}
      {offset > 0 && (
        <sup
          className="tnum ml-px text-[9px] font-semibold text-[var(--tight)]"
          title={`${offset} 天后`}
        >
          +{offset}
        </sup>
      )}
    </span>
  )
}

/** 时间轴端点的两行栈：时刻（大）/ 日期（小，跨日红 +n），压在线上方 */
function TimeStack({
  time,
  date,
  dayOffset = 0,
  align,
}: {
  time: string | undefined
  date: string | undefined
  dayOffset?: number
  align: 'left' | 'right'
}) {
  return (
    <span
      className={`flex min-w-0 flex-col ${align === 'right' ? 'items-end text-right' : 'items-start'}`}
    >
      <SlotText value={time} hint="--:--" mono strong />
      {date && (
        <span className="tnum text-[10.5px] leading-4 text-graphite">
          {md8(date)}
          {dayOffset > 0 && (
            <sup
              className="tnum ml-px text-[9px] font-semibold text-[var(--tight)]"
              title={`${dayOffset} 天后到达`}
            >
              +{dayOffset}
            </sup>
          )}
        </span>
      )}
    </span>
  )
}

/** 两段可缺文本用 · 连接（托运额度 + 直挂说明） */
function joinDot(a?: string, b?: string): string | undefined {
  const parts = [a, b].filter(Boolean)
  return parts.length ? parts.join(' · ') : undefined
}

export function Dot({ small }: { small?: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full border-[1.5px] border-ink/50 bg-paper ${
        small ? 'h-[6px] w-[6px]' : 'h-[7px] w-[7px]'
      }`}
    />
  )
}

/** 值缺失时渲染「待填」空位：虚线框 + 提示词，一眼可见这里等着填 */
export function SlotText({
  value,
  hint,
  mono,
  strong,
}: {
  value: string | undefined
  hint: string
  mono?: boolean
  strong?: boolean
}) {
  if (value) {
    return (
      <span
        className={`min-w-0 truncate ${mono ? 'tnum' : ''} ${
          strong ? 'text-[15px] font-medium text-ink' : 'text-soft'
        }`}
      >
        {value}
      </span>
    )
  }
  return (
    <span
      className={`whitespace-nowrap rounded border border-dashed border-[var(--fog)] px-1.5 py-px text-graphite/60 ${
        mono ? 'tnum' : ''
      } ${strong ? 'text-[12px]' : 'text-[10.5px]'}`}
      title="待填 —— 在 plan.md 的 transport 块里补上"
    >
      {hint}
    </span>
  )
}

function joinSlot(a?: string, b?: string): string | undefined {
  const parts = [a, b].filter(Boolean)
  return parts.length ? parts.join(' ') : undefined
}

function fmtDur(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : h === 0 ? `${m}m` : `${h}h${String(m).padStart(2, '0')}m`
}
