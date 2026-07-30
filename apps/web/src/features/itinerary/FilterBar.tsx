import { BedDouble, Compass, Route, Star, UtensilsCrossed } from 'lucide-react'
import { GROUPS } from '@jjj/schema'

/**
 * 列表筛选。前三个是过滤（全部/玩/吃），「住」「行」是**派生视图**——
 * 住宿聚合成连住区间、交通聚合成票务卡，订房/订票 App 的形态。
 *
 * 图标颜色走 tint-* 类（CSS 变量）：玩绿、吃桃红、住中性、行蓝、收藏金，
 * 全部可被将来的用户自定义配色覆盖，组件不用改。
 */
export type EventFilter = 'all' | 'play' | 'food' | 'stay' | 'move' | 'faved'

const OPTIONS: {
  key: EventFilter
  label: string
  Icon?: typeof Compass
  tint?: string
}[] = [
  { key: 'all', label: '全部' },
  { key: 'play', label: GROUPS.play.zh, Icon: Compass, tint: 'tint-play' },
  { key: 'food', label: GROUPS.food.zh, Icon: UtensilsCrossed, tint: 'tint-food' },
  { key: 'stay', label: '住', Icon: BedDouble, tint: 'tint-stay' },
  { key: 'move', label: '行', Icon: Route, tint: 'tint-move' },
  { key: 'faved', label: '收藏', Icon: Star, tint: 'tint-faved' },
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
              {o.Icon && (
                <o.Icon
                  size={12}
                  aria-hidden
                  /* 选中态深底上仍用彩色图标 —— 颜色是这排按钮的记忆点 */
                  className={`${o.tint} ${o.key === 'faved' && active ? 'fill-current' : ''}`}
                />
              )}
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
