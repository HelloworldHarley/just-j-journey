import { Plane, Star } from 'lucide-react'
import { GROUPS, type GroupKey } from '@trip-atlas/schema'

/**
 * 列表筛选。选项来自分组体系本身（全部/玩/吃/其他）+ 两个横切维度（航班/收藏），
 * 不是为某份行程定制的 —— 任何 TripMD 导入的行程都是同一套。
 */
export type EventFilter = 'all' | GroupKey | 'flight' | 'faved'

const OPTIONS: { key: EventFilter; label: string; icon?: 'plane' | 'star'; dot?: GroupKey }[] = [
  { key: 'all', label: '全部' },
  { key: 'play', label: GROUPS.play.zh, dot: 'play' },
  { key: 'food', label: GROUPS.food.zh, dot: 'food' },
  { key: 'other', label: GROUPS.other.zh, dot: 'other' },
  { key: 'flight', label: '航班', icon: 'plane' },
  { key: 'faved', label: '收藏', icon: 'star' },
]

export function FilterBar({
  value,
  onChange,
}: {
  value: EventFilter
  onChange: (f: EventFilter) => void
}) {
  return (
    <div className="sticky top-[var(--nav-h)] z-20 border-b border-[var(--hairline)] bg-paper/92 backdrop-blur-sm">
      <div
        role="radiogroup"
        aria-label="筛选行程"
        className="mx-auto flex max-w-3xl gap-1.5 overflow-x-auto px-4 py-2
                   [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {OPTIONS.map((o) => {
          const active = value === o.key
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px]
                          transition-colors ${
                            active
                              ? 'bg-ink font-medium text-paper'
                              : 'bg-sunken text-graphite hover:text-ink'
                          }`}
            >
              {o.dot && (
                <span
                  aria-hidden
                  className="h-[7px] w-[7px] rounded-full"
                  style={{
                    background: `var(--g-${o.dot})`,
                    opacity: o.dot === 'other' && !active ? 0.5 : 1,
                  }}
                />
              )}
              {o.icon === 'plane' && <Plane size={12} aria-hidden />}
              {o.icon === 'star' && (
                <Star size={12} className={active ? 'fill-current' : ''} aria-hidden />
              )}
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
