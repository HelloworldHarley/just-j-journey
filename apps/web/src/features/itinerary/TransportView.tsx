import { useMemo } from 'react'
import { CarFront, KeyRound } from 'lucide-react'
import { formatMinutes, type Place, type Rental, type Trip, type TripEvent } from '@jjj/schema'
import { CategoryChip } from '../../components/CategoryChip.tsx'
import { TransportTimeline } from '../../components/TransportTimeline.tsx'
import { MapLinkButton } from '../../components/MapLinkButton.tsx'

/**
 * 「行」视图 —— 订票 App 的形态：只有两种东西值得出现在这里。
 *
 * 1. 长途换乘（带 transport 块的事件）：机票式时间轴卡，按日期排
 * 2. 长租（trip-rentals）：从…到…的租车卡
 *
 * 市内的步行/轻轨/打车不在此列 —— 那些是行程的黏合剂，留在「全部」里；
 * 这里放的是**需要订、需要凭证、错过会出大事**的移动。
 */
export function TransportView({ trip }: { trip: Trip }) {
  const places = useMemo(() => new Map(trip.places.map((p) => [p.id, p])), [trip.places])

  const hauls = useMemo(
    () =>
      trip.days.flatMap((day) =>
        day.events
          .filter((e) => e.transports.length > 0)
          .map((e) => ({ day: day.index, date: day.date, weekday: day.weekday, event: e })),
      ),
    [trip.days],
  )

  if (hauls.length === 0 && trip.rentals.length === 0) {
    return <p className="py-10 text-[13px] text-graphite">这份行程没有长途换乘或租赁信息。</p>
  }

  return (
    <div className="space-y-3 pt-6">
      {hauls.map(({ date, weekday, event }) => (
        <HaulCard key={event.id} date={date} weekday={weekday} event={event} places={places} />
      ))}
      {trip.rentals.map((r, i) => (
        <RentalCard key={i} rental={r} places={places} />
      ))}
    </div>
  )
}

function HaulCard({
  date,
  weekday,
  event,
  places,
}: {
  date: string
  weekday: string
  event: TripEvent
  places: Map<string, Place>
}) {
  const place = event.placeId ? places.get(event.placeId) : undefined
  return (
    <article className="rounded-2xl border border-[var(--hairline)] bg-raised px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <CategoryChip category={event.category} />
          <div className="min-w-0">
            <h3 className="display truncate text-[17px] leading-6 text-ink">{event.title}</h3>
            <p className="tnum mt-0.5 text-[12.5px] text-graphite">
              {date.slice(5).replace('-', '/')} {weekday} · {formatMinutes(event.startMin)}
            </p>
          </div>
        </div>
        {place && <MapLinkButton place={place} />}
      </div>
      <TransportTimeline transports={event.transports} />
    </article>
  )
}

function RentalCard({ rental, places }: { rental: Rental; places: Map<string, Place> }) {
  const pickup = rental.pickupPlaceId ? places.get(rental.pickupPlaceId) : undefined
  const dropoff = rental.dropoffPlaceId ? places.get(rental.dropoffPlaceId) : undefined
  const days = Math.max(
    1,
    Math.round(
      (Date.parse(`${rental.to.date}T00:00Z`) - Date.parse(`${rental.from.date}T00:00Z`)) / 86_400_000,
    ),
  )
  const sameSpot = pickup && dropoff && pickup.id === dropoff.id

  return (
    <article className="rounded-2xl border border-[var(--hairline)] bg-raised px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-[2px] flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sunken">
            <CarFront size={17} className="text-soft" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="display truncate text-[17px] leading-6 text-ink">{rental.what}</h3>
            <p className="tnum mt-0.5 text-[13px] text-soft">
              {fmtMoment(rental.from)} <span className="text-graphite">→</span> {fmtMoment(rental.to)}
              <span className="ml-2 text-graphite">{days} 天</span>
            </p>
          </div>
        </div>
        {pickup && <MapLinkButton place={pickup} />}
      </div>

      {(pickup || dropoff) && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-graphite">
          <KeyRound size={12} aria-hidden />
          {sameSpot ? (
            <span>取还同点 · {pickup!.name}</span>
          ) : (
            <>
              {pickup && <span>取 {pickup.name}</span>}
              {dropoff && <span>还 {dropoff.name}</span>}
            </>
          )}
        </p>
      )}
      {rental.note && (
        <p className="mt-2.5 border-t border-[var(--hairline)] pt-2.5 text-[12.5px] leading-relaxed text-graphite">
          {rental.note}
        </p>
      )}
    </article>
  )
}

function fmtMoment(m: Rental['from']): string {
  return `${m.date.slice(5).replace('-', '/')} ${formatMinutes(m.minute)}`
}

