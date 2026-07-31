import { Luggage } from 'lucide-react'
import { TRANSPORTS, type Transport, type TransportMode } from '@jjj/schema'
import { iconFor } from '../lib/icons.tsx'

/**
 * 长途换乘时间轴 —— 机票产品（Expedia / Google Flights）那套版式，
 * 但不钉死为航班：mode 决定图标与槽位文案（航班/火车/自驾/轮渡…），线的语言不变：
 *
 *   10:15                 全程 11h55m                13:11 ⁺¹
 *   ●━━━━━━━━━━━━●╌╌╌╌╌╌╌╌╌╌●━━━━━━━━━━━━▶
 *   PVG T1          ICN · 停 2h10m               SEA
 *
 * 实线 = 行进段，虚线 = 中转/停留，段长按时长分配：
 * 停留时长已知按真实比例；未知时行进段等宽、停留段按名义 1/3 配重。
 *
 * **多人汇合**：一个事件挂多条 transport（她从 PVG 直飞、我从 SNA 飞），
 * 逐条堆叠渲染，各自带 traveler 标签。
 *
 * **每个字段都可以缺。** 票常常晚于行程定下来 —— 缺的字段渲染成
 * 虚线框「待填」空位，骨架永远完整，之后人工或 Agent 补进 TripMD。
 */

/** 按交通方式定槽位文案 —— 机场/车站/港口不该共用一个词 */
const MODE_SLOTS: Record<TransportMode, { who: string; from: string; to: string; bag: string | null; stop: string }> = {
  flight: { who: '航司 · 航班号', from: '出发机场', to: '到达机场', bag: '托运行李', stop: '中转' },
  rail: { who: '承运 · 车次', from: '出发站', to: '到达站', bag: '行李', stop: '换乘' },
  monorail: { who: '承运 · 班次', from: '出发站', to: '到达站', bag: null, stop: '换乘' },
  streetcar: { who: '承运 · 班次', from: '出发站', to: '到达站', bag: null, stop: '换乘' },
  bus: { who: '客运 · 班次', from: '出发站', to: '到达站', bag: '行李', stop: '经停' },
  ferry: { who: '船司 · 班次', from: '出发港', to: '到达港', bag: '行李', stop: '经停' },
  drive: { who: '车辆 / 租车行', from: '出发地', to: '到达地', bag: null, stop: '休息点' },
  rideshare: { who: '平台 / 车型', from: '出发地', to: '到达地', bag: null, stop: '经停' },
  bike: { who: '车辆', from: '出发地', to: '到达地', bag: null, stop: '休息点' },
  walk: { who: '路线', from: '出发地', to: '到达地', bag: null, stop: '休息点' },
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

function SingleTransport({ t: flight, date }: { t: Transport; date?: string }) {
  const slots = MODE_SLOTS[flight.mode]
  // 日期：没写就按事件当天为出发日推算，到达日再加 arr_day_offset
  const depDate = flight.depDate ?? date
  const arrDate = flight.arrDate ?? (depDate ? plusDays(depDate, flight.arrDayOffset) : undefined)
  const ModeIcon = iconFor(TRANSPORTS[flight.mode].icon)
  const stops = flight.stops
  const legs = stops.length + 1

  // 段宽权重（分钟当量）。全程与各中转时长都有 → 飞行时间 = 全程 - Σ停留，均分给各飞行段；
  // 缺数据 → 飞行段 180 名义分钟、中转 60，比例仍自然。
  const allWaitsKnown = stops.every((s) => s.waitMin !== null)
  const flyTotal =
    flight.durationMin !== null && allWaitsKnown
      ? Math.max(60, flight.durationMin - stops.reduce((n, s) => n + (s.waitMin ?? 0), 0))
      : null
  const flyGrow = flyTotal !== null ? flyTotal / legs : 180

  // 线与标签行共用的段序列：fly / wait 交错
  const segs: { kind: 'fly' | 'wait'; grow: number; stop?: Transport['stops'][number] }[] = []
  for (let i = 0; i < legs; i++) {
    segs.push({ kind: 'fly', grow: flyGrow })
    const stop = stops[i]
    if (stop) segs.push({ kind: 'wait', grow: stop.waitMin ?? 60, stop })
  }

  return (
    <div className="rounded-lg bg-[var(--paper-sunken)] px-3.5 pb-3 pt-2.5">
      {/* 谁 · 承运/班次 · 行李 —— 可缺的槽位，文案随交通方式变 */}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11.5px]">
        {flight.traveler && (
          <span className="rounded-full bg-ink px-1.5 py-px text-[10px] font-medium leading-tight text-paper">
            {flight.traveler}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <ModeIcon size={12} className="shrink-0 text-graphite" aria-hidden />
          <SlotText value={joinSlot(flight.carrier, flight.number)} hint={slots.who} mono />
        </span>
        {(slots.bag !== null || flight.baggage) && (
          <span className="inline-flex items-center gap-1.5">
            <Luggage size={12} className="shrink-0 text-graphite" aria-hidden />
            <SlotText value={flight.baggage} hint={slots.bag ?? '行李'} />
          </span>
        )}
        {flight.note && <span className="text-graphite">{flight.note}</span>}
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

      {/* 时间行：左「日期 时间」→ 右「时间 日期」，日期小一号 */}
      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-1.5">
          {depDate && <span className="tnum text-[11px] text-graphite">{md8(depDate)}</span>}
          <SlotText value={flight.depTime} hint="--:--" mono strong />
        </span>
        <span className="tnum shrink-0 text-[11px] text-graphite">
          {flight.durationMin !== null ? `全程 ${fmtDur(flight.durationMin)}` : '全程 —'}
        </span>
        <span className="flex min-w-0 items-baseline gap-1.5">
          <SlotText value={flight.arrTime} hint="--:--" mono strong />
          {arrDate && <span className="tnum text-[11px] text-graphite">{md8(arrDate)}</span>}
        </span>
      </div>

      {/* 线：●━━飞行━━ ○╌╌中转╌╌○ ━━飞行━━▶ */}
      <div className="mt-1.5 flex items-center" aria-hidden>
        <Dot />
        {segs.map((s, i) =>
          s.kind === 'fly' ? (
            <span
              key={i}
              className="h-[2px] min-w-4 rounded-full bg-ink/50"
              style={{ flexGrow: s.grow, flexBasis: 0 }}
            />
          ) : (
            <span
              key={i}
              className="relative mx-[2px] flex min-w-10 items-center"
              style={{ flexGrow: s.grow, flexBasis: 0 }}
            >
              <Dot small />
              <span className="mx-[1px] h-0 flex-1 border-t-[2px] border-dashed border-ink/30" />
              <Dot small />
            </span>
          ),
        )}
        <span
          aria-hidden
          className="-ml-px h-0 w-0 border-y-[4px] border-l-[7px] border-y-transparent border-l-ink/50"
        />
      </div>

      {/* 地点行：与线同 flex 配比 —— 出发在首段左端、到达在末段右端、中转标签对准虚线段 */}
      <div className="mt-1 flex items-start">
        {segs.map((s, i) => {
          const first = i === 0
          const last = i === segs.length - 1
          if (s.kind === 'wait') {
            return (
              <span
                key={i}
                className="min-w-10 truncate text-center text-[10.5px] leading-4 text-graphite"
                style={{ flexGrow: s.grow, flexBasis: 0 }}
              >
                {s.stop?.airport ?? slots.stop}
                {s.stop?.waitMin != null && ` · 停 ${fmtDur(s.stop.waitMin)}`}
              </span>
            )
          }
          return (
            <span
              key={i}
              className={`flex min-w-4 gap-2 text-[11.5px] leading-4 ${
                first && last ? 'justify-between' : first ? 'justify-start' : last ? 'justify-end' : ''
              }`}
              style={{ flexGrow: s.grow, flexBasis: 0 }}
            >
              {first && <SlotText value={flight.from} hint={slots.from} />}
              {last && <SlotText value={flight.to} hint={slots.to} />}
            </span>
          )
        })}
      </div>
    </div>
  )
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
