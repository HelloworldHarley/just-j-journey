import type React from 'react'
import { shortDate } from '../../lib/format.ts'
import { dayOffsetOf } from '@jjj/tripmd'
import { shownTerms, showsField } from '../../lib/public.ts'

/**
 * 票面共用零件。换乘时间轴（机票/火车/巴士/轮渡）和租车区间卡共用同一套 ——
 * 两者读起来应该是同一种东西：一张有起止时刻、有节点、有条款的凭证。
 *
 * 抽出来是因为原先租车模块反向 import 了换乘时间轴的内部零件，
 * 依赖方向不对；将来日历的事件弹层大概率也要用同一套。
 *
 * 缺值的画法全站只有一条规矩（lib/public.ts 的 showsField）：完整版画虚线「待填」槽，
 * 公开版整格不画。SlotText 管值那一格，Field 管「标签 + 值」一整格，容器用 shownTerms 判要不要出现。
 */

/** 时间轴上的节点圆点 */
export function Dot({ small }: { small?: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full border-[1.5px] border-ink/50 bg-paper ${
        small ? 'h-[6px] w-[6px]' : 'h-[7px] w-[7px]'
      }`}
    />
  )
}

/** 时间轴末端的箭头 */
export function Arrow() {
  return (
    <span
      aria-hidden
      className="-ml-px h-0 w-0 border-y-[4px] border-l-[7px] border-y-transparent border-l-ink/50"
    />
  )
}

/**
 * 值缺失时渲染「待填」空位：虚线框 + 提示词，一眼可见这里等着填。
 * 票常常晚于行程定下来，骨架要始终完整。公开版缺就是缺，什么都不画。
 */
export function SlotText({
  value,
  hint,
  mono,
  strong,
}: {
  value: string | undefined
  hint: string
  mono?: boolean
  strong?: boolean
}) {
  if (value) {
    return (
      <span
        className={`min-w-0 truncate ${mono ? 'tnum' : ''} ${
          strong ? 'text-[15px] font-medium text-ink' : 'text-soft'
        }`}
      >
        {value}
      </span>
    )
  }
  if (!showsField(value)) return null
  // 待填槽是行内 flex 盒、固定高度、文字居中 —— 放进条款行时和旁边的正文共用同一个
  // 18px 行盒，不会因为多了边框和内边距把整行撑高、把邻居的基线挤歪
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded border border-dashed
                  border-[var(--fog)] px-1.5 leading-none text-graphite/60 ${mono ? 'tnum' : ''} ${
                    strong ? 'h-[22px] text-[12px]' : 'h-[18px] text-[10.5px]'
                  }`}
      title="待填 —— 在 plan.md 里补上这个字段"
    >
      {hint}
    </span>
  )
}

/**
 * 「标签 + 值」一格：条款行、住宿卡的栏目、票面头行的预算都是它。
 * 值缺了完整版画待填槽，公开版整格不画 —— 标签、图标一起消失，不留悬空的「房型」二字。
 * `children` 给出时替代默认的 SlotText（星级画成 ★★★★ 那种）；`value` 仍用于判画不画。
 */
export function Field({
  label,
  value,
  hint = '待填',
  icon,
  className,
  children,
}: {
  label: string
  value: string | undefined
  hint?: string
  icon?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  if (!showsField(value)) return null
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
      {icon}
      <span className="shrink-0 text-graphite">{label}</span>
      {children ?? <SlotText value={value} hint={hint} />}
    </span>
  )
}

/**
 * 时间轴端点的两行栈：时刻（大）在上、日期（小）在下。
 *
 * `base` 给出时才算跨日角标 —— 红色 `+n` 的含义是「比出发晚了 n 天，别看错日子」。
 * 租车这类天然跨多天的凭证不传 base：跨天是常态不是意外，而这套设计里
 * 红色只留给真会出事的东西，天数已经在头行写着了。
 *
 * 公开版里被抹掉的那一端连日期也不画：那个日期是从事件所在天派生出来的，
 * 时刻没了还挂着它，读起来像「这里有一班没写清的车」。**空盒仍然渲染** ——
 * 它是 justify-between 的占位子元素，塌掉的话另一端会滑到错误的一侧。
 */
export function TimeStack({
  time,
  date,
  base,
  align,
}: {
  time: string | undefined
  date: string | undefined
  base?: string
  align: 'left' | 'right'
}) {
  return (
    <span
      className={`flex min-w-0 flex-col ${align === 'right' ? 'items-end text-right' : 'items-start'}`}
    >
      {showsField(time) && (
        <>
          <SlotText value={time} hint="--:--" mono strong />
          <DateLine date={date} base={base} />
        </>
      )}
    </span>
  )
}

/**
 * 时刻下的小日期行，与出发日不同天时标红色 `+n`。
 * 端点（TimeStack）和中转点共用 —— `+n` 的画法全站只有这一份。
 */
export function DateLine({ date, base }: { date?: string; base?: string }) {
  if (!date) return null
  const offset = base ? dayOffsetOf(base, date) : 0
  return (
    <span className="tnum text-[10.5px] leading-4 text-graphite">
      {shortDate(date)}
      {offset > 0 && (
        <sup
          className="tnum ml-px text-[9px] font-semibold text-[var(--tight)]"
          title={`${offset} 天后`}
        >
          +{offset}
        </sup>
      )}
    </span>
  )
}

/** 票面底部的条款行：客舱 / 托运 / 里程 / 保险 / 退改 这类成对的「标签 + 值」；一格都没有就整行不画 */
export function TermsRow({ terms }: { terms: { label: string; value?: string }[] }) {
  const shown = shownTerms(terms)
  if (shown.length === 0) return null
  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 border-t
                 border-[var(--hairline)] pt-2 text-[11px]"
    >
      {shown.map((t) => (
        <Field key={t.label} label={t.label} value={t.value} />
      ))}
    </div>
  )
}
