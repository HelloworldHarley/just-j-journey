import { BedDouble, Compass, Route, Star, UtensilsCrossed } from 'lucide-react'
import { KINDS } from '@jjj/schema'

/**
 * 列表筛选。全部显示全量；玩/吃/住/行按族过滤同一套卡片
 * （住/行只是去掉时间列），收藏看用户点的星。
 *
 * 图标颜色走 tint-* 类（CSS 变量）：玩绿、吃桃红、住中性、行蓝、收藏金，
 * 全部可被将来的用户自定义配色覆盖，组件不用改。
 *
 * 右侧是全局详略开关：简 = 卡片只留头两行和信息模块，扫读用；
 * 详 = 简介/注意/如果全部展开。折叠态每张卡自带「详情」可单独展开。
 */
export type EventFilter = 'all' | 'play' | 'food' | 'stay' | 'move' | 'faved'

const OPTIONS: {
  key: EventFilter
  label: string
  Icon?: typeof Compass
  tint?: string
}[] = [
  { key: 'all', label: '全部' },
  { key: 'play', label: KINDS.play.zh, Icon: Compass, tint: 'tint-play' },
  { key: 'food', label: KINDS.food.zh, Icon: UtensilsCrossed, tint: 'tint-food' },
  { key: 'stay', label: KINDS.stay.zh, Icon: BedDouble, tint: 'tint-stay' },
  { key: 'move', label: KINDS.move.zh, Icon: Route, tint: 'tint-move' },
  { key: 'faved', label: '收藏', Icon: Star, tint: 'tint-faved' },
]

export function FilterBar({
  value,
  onChange,
  detail,
  onDetailChange,
}: {
  value: EventFilter
  onChange: (f: EventFilter) => void
  detail: boolean
  onDetailChange: (d: boolean) => void
}) {
  return (
    <div className="sticky top-[var(--nav-h)] z-20 border-b border-[var(--hairline)] bg-paper/92 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2">
        <div
          role="radiogroup"
          aria-label="筛选行程"
          className="flex min-w-0 gap-1.5 overflow-x-auto
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

        {/* 详略开关：左右两档 —— 简（折叠）/ 详（全开） */}
        <div
          role="radiogroup"
          aria-label="详略"
          className="ml-auto flex shrink-0 rounded-full bg-sunken p-[2px]"
        >
          {(
            [
              { d: false, label: '简' },
              { d: true, label: '详' },
            ] as const
          ).map(({ d, label }) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={detail === d}
              onClick={() => onDetailChange(d)}
              className={`rounded-full px-2.5 py-[3px] text-[11.5px] transition-colors ${
                detail === d ? 'bg-ink font-medium text-paper' : 'text-graphite hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
