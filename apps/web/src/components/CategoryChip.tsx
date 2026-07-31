import { CATEGORIES, KINDS, type CategoryKey } from '@jjj/schema'
import { iconFor } from '../lib/icons.tsx'

/**
 * 类型圆片：**族色**圆底 + **类型**图标。
 *
 * 两层各管一件事 —— 颜色只有四种（玩/吃/住/行），扫一眼就知道今天的构成；
 * 图标有十八种，告诉你具体是景点还是高铁。颜色不够分十八类，图标够。
 *
 * 「事务」族透明底（无圆片、无着色）：杂务是必要的，但不该抢注意力。
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
  const kind = KINDS[cat.kind]
  const Icon = iconFor(cat.icon)

  if (!kind.cssVar) {
    // 事务：透明底，只有图标
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center text-graphite ${className}`}
        style={{ width: size, height: size }}
        title={`${kind.zh} · ${cat.zh}`}
      >
        <Icon size={Math.round(size * 0.64)} strokeWidth={2} aria-hidden />
        <span className="sr-only">
          {kind.zh} · {cat.zh}
        </span>
      </span>
    )
  }

  return (
    <span
      className={`grp-chip inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ width: size, height: size, ...kindVars(category) }}
      title={`${kind.zh} · ${cat.zh}`}
    >
      <Icon size={Math.round(size * 0.56)} strokeWidth={2.25} aria-hidden />
      <span className="sr-only">
        {kind.zh} · {cat.zh}
      </span>
    </span>
  )
}

/**
 * 把族色注入 CSS 变量，供圆片、卡片左边条、条目行共用。
 * 指向 :root 上的可覆盖变量而非写死色值 —— 用户自定义配色时组件零改动。
 * 事务族无色，返回空对象（消费方自备中性兜底）。
 */
export function kindVars(category: CategoryKey): React.CSSProperties {
  const v = KINDS[CATEGORIES[category].kind].cssVar
  if (!v) return {}
  return { '--grp': `var(${v})`, '--grp-dark': `var(${v}-dark)` } as React.CSSProperties
}
