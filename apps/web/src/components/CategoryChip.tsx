import { CATEGORIES, groupOf, type CategoryKey } from '@jjj/schema'
import { iconFor } from '../lib/icons.tsx'

/**
 * 分类圆片：**分组色**圆底 + **细类**图标。
 *
 * 两层各管一件事 —— 颜色只有三种（玩/吃/其他），扫一眼就知道今天的构成；
 * 图标有十一种，告诉你具体是景点还是徒步。颜色不够用来分十一类，图标够。
 *
 * 「其他」组用描边而非实心：位移和杂务是必要的，但不该跟「玩」抢注意力。
 *
 * 这个形状会原样复用到地图 marker，两个视图共用一套视觉语言。
 */
export function CategoryChip({
  category,
  size = 22,
  className = '',
}: {
  category: CategoryKey
  size?: number
  className?: string
}) {
  const cat = CATEGORIES[category]
  const grp = groupOf(category)
  const Icon = iconFor(cat.icon)
  const outline = grp.fill === 'outline'

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${
        outline ? 'grp-chip-outline' : 'grp-chip'
      } ${className}`}
      style={{ width: size, height: size, ...groupVars(category) }}
      title={`${grp.zh} · ${cat.zh}`}
    >
      <Icon size={Math.round(size * 0.56)} strokeWidth={2.25} aria-hidden />
      <span className="sr-only">
        {grp.zh} · {cat.zh}
      </span>
    </span>
  )
}

/** 把分组色注入 CSS 变量，供圆片和变体左边条共用 */
export function groupVars(category: CategoryKey): React.CSSProperties {
  // 指向 :root 上的可覆盖变量，而不是写死色值 —— 见 lib/palette.ts
  const g = CATEGORIES[category].group
  return { '--grp': `var(--g-${g})`, '--grp-dark': `var(--g-${g}-dark)` } as React.CSSProperties
}
