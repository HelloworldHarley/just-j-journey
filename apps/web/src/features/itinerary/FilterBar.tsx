import { BedDouble, Route, Star } from 'lucide-react'
import { GROUPS, type GroupKey } from '@jjj/schema'

/**
 * 列表筛选。前三个是过滤（全部/玩/吃），后三个里「住」「行」是**派生视图**——
 * 住宿聚合成连住区间、交通聚合成票务卡，订房/订票 App 的形态，
 * 不再保留按天的流水账。所有选项都来自通用结构，任何行程同一套。
 */
export type EventFilter = 'all' | 'play' | 'food' | 'stay' | 'move' | 'faved'

const OPTIONS: { key: EventFilter; label: string; icon?: 'bed' | 'route' | 'star'; dot?: GroupKey }[] = [
  { key: 'all', label: '全部' },
  { key: 'play', label: GROUPS.play.zh, dot: 'play' },
  { key: 'food', label: GROUPS.food.zh, dot: 'food' },
  { key: 'stay', label: '住', icon: 'bed' },
  { key: 'move', label: '行', icon: 'route' },
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
                  style={{ background: `var(--g-${o.dot})` }}
                />
              )}
              {o.icon === 'bed' && <BedDouble size={12} aria-hidden />}
              {o.icon === 'route' && <Route size={12} aria-hidden />}
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
