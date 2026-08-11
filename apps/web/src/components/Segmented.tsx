import type React from 'react'

/**
 * 分段控件 —— 全站的「几选一」共用这一份状态语言。
 *
 * 曾经五处手搓：顶栏视图切换 / 日历周月 / 设置外观 / 筛选详略 / 资料页签，
 * 三份同款 + 两份变体，改一处漏四处。现在：
 *
 * - 药丸容器 + 选中态配方在这里（`SEG_PILL` / `segItem` / `segChip`）；
 * - 字号内边距是各控件自己的尺寸，留在调用点；
 * - 纯文字的 radiogroup 直接用 `<Segmented>`，NavLink / 带图标的用类配方拼。
 *
 * 两种语气：`raised`（浮起白，用于视图切换类）、`ink`（墨底反白，
 * 用于筛选类 —— 它要在一排彩色图标 chip 里压得住）。
 */

export const SEG_PILL = 'flex shrink-0 gap-0.5 rounded-full bg-sunken p-0.5'

export type SegTone = 'raised' | 'ink'

/** 药丸**内部**的分段项：过渡 + 选中/未选配色。圆角是尺寸的事，调用点自带。 */
export function segItem(active: boolean, tone: SegTone = 'raised'): string {
  const state = active
    ? tone === 'raised'
      ? 'bg-raised font-medium text-ink shadow-sm'
      : 'bg-ink font-medium text-paper'
    : 'text-graphite hover:text-ink'
  return `transition-colors ${state}`
}

/** **独立**的分段 chip（不在药丸里，未选时自带 sunken 底）：筛选栏、资料页签 */
export function segChip(active: boolean): string {
  return `rounded-full transition-colors ${
    active ? 'bg-ink font-medium text-paper' : 'bg-sunken text-graphite hover:text-ink'
  }`
}

/** 纯文字的几选一。带图标 / NavLink 的场合用上面的类配方自己拼结构。 */
export function Segmented<T extends string | boolean>({
  options,
  value,
  onChange,
  ariaLabel,
  tone = 'raised',
  itemClass,
  className = '',
}: {
  options: readonly { key: T; label: React.ReactNode }[]
  value: T
  onChange: (key: T) => void
  ariaLabel: string
  tone?: SegTone
  /** 每项的字号与内边距 —— 尺寸是控件自己的事 */
  itemClass: string
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`${SEG_PILL} ${className}`}>
      {options.map((o) => (
        <button
          key={String(o.key)}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(o.key)}
          className={`rounded-full ${itemClass} ${segItem(value === o.key, tone)}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
