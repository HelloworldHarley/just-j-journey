import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Navigation, MapPin } from 'lucide-react'
import type { Place, TransportMode } from '@jjj/schema'
import {
  PROVIDER_LABEL,
  directionsUrl,
  placeUrl,
  preferredProvider,
  type MapProvider,
} from '../lib/maplink.ts'

const ORDER: MapProvider[] = ['google', 'apple']

/**
 * 地图深链。两家地图**都给**，本机常用的那家排第一并标「常用」。
 * 不做自动跳转 —— 猜错平台比多一次点击烦人得多。
 */
export function MapLinkButton({
  place,
  from,
  mode,
  label = '地图',
}: {
  place: Place
  from?: Place | null
  mode?: TransportMode
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const preferred = preferredProvider()
  const providers = [preferred, ...ORDER.filter((p) => p !== preferred)]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1 rounded-full border border-[var(--hairline)]
                   px-2 py-[3px] text-[11px] text-graphite transition-colors
                   hover:border-ink/25 hover:text-ink"
      >
        {mode ? <Navigation size={11} aria-hidden /> : <MapPin size={11} aria-hidden />}
        {label}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-lg border
                     border-[var(--hairline)] bg-raised py-1 shadow-[var(--shadow)]"
        >
          <div className="px-3 pb-1 pt-1 text-[10px] text-graphite">{place.name}</div>
          {providers.map((p) => (
            <a
              key={p}
              role="menuitem"
              href={mode ? directionsUrl(from ?? null, place, mode, p) : placeUrl(place, p)}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]
                         text-ink transition-colors hover:bg-sunken"
            >
              <span>
                {mode ? '导航到 · ' : ''}
                {PROVIDER_LABEL[p]}
              </span>
              <span className="flex items-center gap-1.5">
                {p === preferred && <span className="text-[10px] text-graphite">常用</span>}
                <ExternalLink size={11} className="text-graphite" aria-hidden />
              </span>
            </a>
          ))}
          {!place.coord && (
            <p className="px-3 pb-1.5 pt-1 text-[10px] leading-snug text-graphite">
              按名称搜索（该地点尚无坐标）
            </p>
          )}
        </div>
      )}
    </div>
  )
}
