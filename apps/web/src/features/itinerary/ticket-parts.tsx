import { shortDate } from '../../lib/format.ts'
import { dayOffsetOf } from '../../lib/transport-dates.ts'

/**
 * 票面共用零件。换乘时间轴（机票/火车/巴士/轮渡）和租车区间卡共用同一套 ——
 * 两者读起来应该是同一种东西：一张有起止时刻、有节点、有条款的凭证。
 *
 * 抽出来是因为原先租车模块反向 import 了换乘时间轴的内部零件，
 * 依赖方向不对；将来日历的事件弹层大概率也要用同一套。
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
 * 票常常晚于行程定下来，骨架要始终完整。
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
  return (
    <span
      className={`whitespace-nowrap rounded border border-dashed border-[var(--fog)] px-1.5 py-px text-graphite/60 ${
        mono ? 'tnum' : ''
      } ${strong ? 'text-[12px]' : 'text-[10.5px]'}`}
      title="待填 —— 在 plan.md 里补上这个字段"
    >
      {hint}
    </span>
  )
}

/**
 * 时间轴端点的两行栈：时刻（大）在上、日期（小）在下。
 *
 * `base` 给出时才算跨日角标 —— 红色 `+n` 的含义是「比出发晚了 n 天，别看错日子」。
 * 租车这类天然跨多天的凭证不传 base：跨天是常态不是意外，而这套设计里
 * 红色只留给真会出事的东西，天数已经在头行写着了。
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
  const offset = base ? dayOffsetOf(base, date) : 0
  return (
    <span
      className={`flex min-w-0 flex-col ${align === 'right' ? 'items-end text-right' : 'items-start'}`}
    >
      <SlotText value={time} hint="--:--" mono strong />
      {date && (
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
      )}
    </span>
  )
}

/** 票面底部的条款行：客舱 / 托运 / 里程 / 保险 / 退改 这类成对的「标签 + 值」 */
export function TermsRow({ terms }: { terms: { label: string; value?: string }[] }) {
  if (terms.length === 0) return null
  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 border-t
                 border-[var(--hairline)] pt-2 text-[11px]"
    >
      {terms.map((t) => (
        <span key={t.label} className="inline-flex items-center gap-1.5">
          <span className="text-graphite">{t.label}</span>
          <SlotText value={t.value} hint="待填" />
        </span>
      ))}
    </div>
  )
}
