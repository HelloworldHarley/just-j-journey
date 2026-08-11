import type { CSSProperties } from 'react'
import type { GroupKey } from '@jjj/schema'

/**
 * 玩/吃/其他 构成条 —— 全站唯一的一份渲染。
 *
 * 数据公式在 `@jjj/tripmd` 的 `dayComposition`（那边的注释说「公式只能有一份」），
 * 渲染公式曾经有四份：首页竖条 0.22、日程轨 0.3、月视图 0.3、预算页 0.45 ——
 * 同一个「其他」在四个视图里三种深浅。现在压暗系数只有下面这一个。
 *
 * 包装（高度 / 圆角 / 外边距 / 底色）各视图自带 —— 条的形状是视图的事，
 * 分段的画法是这里的事。
 */
export const OTHER_DIM = 0.3

const GROUP_ORDER: GroupKey[] = ['play', 'food', 'other']

export function CompositionBar({
  comp,
  total,
  vertical = false,
  gapPx = 0,
  className = '',
  style,
  title,
  segmentTitle,
}: {
  comp: Record<GroupKey, number>
  /**
   * 分母。多数场景 = 三段之和；预算页的按天条传全局 maxDay ——
   * 行与行之间要按同一把尺子比长短，那根条**故意**不撑满 100%。
   */
  total: number
  /** 首页行程指纹是竖条：自下而上 玩→吃→其他 */
  vertical?: boolean
  /** 预算页分段之间留 2px 表面缝 */
  gapPx?: number
  className?: string
  style?: CSSProperties
  /** 整条的 title 提示（首页竖条标 Day N） */
  title?: string
  /** 分段的 title 提示（预算页标注金额用） */
  segmentTitle?: (g: GroupKey) => string
}) {
  if (total <= 0) return null
  const size = vertical ? 'height' : 'width'
  return (
    <span
      aria-hidden
      title={title}
      className={`flex ${vertical ? 'flex-col-reverse' : ''} overflow-hidden ${className}`}
      style={gapPx > 0 ? { ...style, gap: gapPx } : style}
    >
      {GROUP_ORDER.map((g) =>
        comp[g] > 0 ? (
          <span
            key={g}
            style={{
              [size]: `${(comp[g] / total) * 100}%`,
              background: `var(--t-${g})`,
              // 「其他」压暗，让玩/吃在条里也是主角
              opacity: g === 'other' ? OTHER_DIM : 1,
            }}
            title={segmentTitle?.(g)}
          />
        ) : null,
      )}
    </span>
  )
}
