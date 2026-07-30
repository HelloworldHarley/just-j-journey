import { useMemo } from 'react'
import { BedDouble, MoonStar } from 'lucide-react'
import type { Day, Place, Trip } from '@jjj/schema'
import { MapLinkButton } from '../../components/MapLinkButton.tsx'

/**
 * 「住」视图 —— 订房 App 的形态，不是按天的流水账。
 *
 * 数据完全从 trip-day 的 lodging 派生：连续住同一家的夜晚合并成一个区间，
 * 「10/01 → 10/03 · 2 晚 · Astra Hotel」。换酒店的那天自然断开。
 * 没有任何行程专属逻辑 —— 任何 TripMD 导入的行程都能这样聚合。
 */

interface StaySpan {
  name: string
  placeId: string | null
  note?: string
  /** 入住日 */
  checkIn: string
  /** 退房日 = 最后一晚的次日 */
  checkOut: string
  nights: number
}

function buildSpans(days: Day[]): StaySpan[] {
  const spans: StaySpan[] = []
  for (const day of days) {
    if (!day.lodging) continue
    const last = spans[spans.length - 1]
    if (last && last.name === day.lodging.name && last.checkOut === day.date) {
      last.nights += 1
      last.checkOut = nextDay(day.date)
      if (!last.note && day.lodging.note) last.note = day.lodging.note
    } else {
      spans.push({
        name: day.lodging.name,
        placeId: day.lodging.placeId,
        note: day.lodging.note,
        checkIn: day.date,
        checkOut: nextDay(day.date),
        nights: 1,
      })
    }
  }
  return spans
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

const md = (iso: string) => iso.slice(5).replace('-', '/')

export function StayView({ trip }: { trip: Trip }) {
  const places = useMemo(() => new Map(trip.places.map((p) => [p.id, p])), [trip.places])
  const spans = useMemo(() => buildSpans(trip.days), [trip.days])

  if (spans.length === 0) {
    return <p className="py-10 text-[13px] text-graphite">这份行程没有声明住宿（trip-day 的 lodging 字段）。</p>
  }

  return (
    <div className="space-y-3 pt-6">
      {spans.map((s, i) => (
        <StayCard key={i} span={s} place={s.placeId ? places.get(s.placeId) : undefined} />
      ))}
    </div>
  )
}

function StayCard({ span, place }: { span: StaySpan; place: Place | undefined }) {
  const tentative = place?.tentative ?? false
  return (
    <article
      className={`rounded-2xl border bg-raised px-5 py-4 ${
        tentative ? 'border-dashed border-[var(--fog)]' : 'border-[var(--hairline)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-[2px] flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sunken">
            <BedDouble size={17} className="text-soft" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="display truncate text-[17px] leading-6 text-ink">{span.name}</h3>
            <p className="tnum mt-0.5 text-[13px] text-soft">
              {md(span.checkIn)} <span className="text-graphite">→</span> {md(span.checkOut)}
              <span className="ml-2 inline-flex items-center gap-1 text-graphite">
                <MoonStar size={11} aria-hidden />
                {span.nights} 晚
              </span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {tentative && (
            <span className="rounded-full bg-[var(--paper-sunken)] px-2 py-[1.5px] text-[10.5px] text-graphite">
              待定
            </span>
          )}
          {place && <MapLinkButton place={place} />}
        </div>
      </div>
      {(span.note ?? place?.note) && (
        <p className="mt-2.5 border-t border-[var(--hairline)] pt-2.5 text-[12.5px] leading-relaxed text-graphite">
          {span.note ?? place?.note}
        </p>
      )}
    </article>
  )
}
