import { Luggage, Plane } from 'lucide-react'
import type { Flight } from '@jjj/schema'

/**
 * 航班时间轴 —— 机票产品（Expedia / Google Flights）那套版式：
 *
 *   10:15                 全程 11h55m                13:11 ⁺¹
 *   ●━━━━━━━━━━━━●╌╌╌╌╌╌╌╌╌╌●━━━━━━━━━━━━▶
 *   PVG T1          ICN · 停 2h10m               SEA
 *
 * 实线 = 飞行段，虚线 = 中转停留，段长按时长分配：
 * 中转时长已知按真实比例；未知时飞行段等宽、中转段按名义 1/3 配重。
 * （票面只给全程时长，单段飞行时长本来拿不到 —— 各飞行段均分是诚实的近似。）
 *
 * **每个字段都可以缺。** 机票常常晚于行程定下来 —— 缺的字段渲染成
 * 虚线框「待填」空位，骨架永远完整，之后人工或 Agent 补进 TripMD。
 */
export function FlightTimeline({ flight }: { flight: Flight }) {
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
  const segs: { kind: 'fly' | 'wait'; grow: number; stop?: Flight['stops'][number] }[] = []
  for (let i = 0; i < legs; i++) {
    segs.push({ kind: 'fly', grow: flyGrow })
    const stop = stops[i]
    if (stop) segs.push({ kind: 'wait', grow: stop.waitMin ?? 60, stop })
  }

  return (
    <div className="mt-2.5 rounded-lg bg-[var(--paper-sunken)] px-3.5 pb-3 pt-2.5">
      {/* 航司 · 航班号 · 行李 —— 可缺的槽位 */}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11.5px]">
        <span className="inline-flex items-center gap-1.5">
          <Plane size={12} className="shrink-0 text-graphite" aria-hidden />
          <SlotText value={joinSlot(flight.airline, flight.flightNo)} hint="航司 · 航班号" mono />
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Luggage size={12} className="shrink-0 text-graphite" aria-hidden />
          <SlotText value={flight.baggage} hint="托运行李" />
        </span>
        {flight.note && <span className="text-graphite">{flight.note}</span>}
      </div>

      {/* 时间行 */}
      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <SlotText value={flight.depTime} hint="--:--" mono strong />
        <span className="tnum shrink-0 text-[11px] text-graphite">
          {flight.durationMin !== null ? `全程 ${fmtDur(flight.durationMin)}` : '全程 —'}
        </span>
        <span className="inline-flex items-baseline gap-0.5">
          <SlotText value={flight.arrTime} hint="--:--" mono strong />
          {flight.arrDayOffset > 0 && (
            <sup
              className="tnum text-[10px] text-[var(--tight)]"
              title={`${flight.arrDayOffset} 天后到达`}
            >
              +{flight.arrDayOffset}
            </sup>
          )}
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
                {s.stop?.airport ?? '中转'}
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
              {first && <SlotText value={flight.from} hint="出发机场" />}
              {last && <SlotText value={flight.to} hint="到达机场" />}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function Dot({ small }: { small?: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full border-[1.5px] border-ink/50 bg-paper ${
        small ? 'h-[6px] w-[6px]' : 'h-[7px] w-[7px]'
      }`}
    />
  )
}

/** 值缺失时渲染「待填」空位：虚线框 + 提示词，一眼可见这里等着填 */
function SlotText({
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
      title="待填 —— 在 plan.md 的 flight 块里补上"
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
