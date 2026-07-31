import { useState } from 'react'
import type { Trip } from '@jjj/schema'
import { Markdown } from '../../components/Markdown.tsx'
import { RailLayout } from '../../components/RailLayout.tsx'
import { isBudgetRef } from '../../lib/derive.ts'

/**
 * 资料页：打包、住宿备选、雨天预案、出发前清单…
 *
 * 这些内容不属于任何一天，硬塞进时间轴会破坏日程的连续性；
 * 但它们占了原始行程近三分之一的篇幅，不能丢。所以单开一页。
 * 预算类附录不在这里 —— 它们渲染在预算页底部，和自动统计放在一起。
 */
export function InfoView({ trip }: { trip: Trip }) {
  const refs = trip.reference.filter((r) => !isBudgetRef(r))
  const [active, setActive] = useState(refs[0]?.id ?? '')

  if (refs.length === 0) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-16 text-[13px] text-graphite">
        这份行程没有附录。在 plan.md 里用 <code>## 附录 · 标题</code> 添加。
      </p>
    )
  }

  const current = refs.find((r) => r.id === active) ?? refs[0]

  return (
    <RailLayout rail={<SectionRail refs={refs} active={current?.id} onPick={setActive} />}>
      {/* 窄屏没有左侧轨，退化成一排横向 chip */}
      <nav
        className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1 pt-5
                   [scrollbar-width:none] xl:hidden [&::-webkit-scrollbar]:hidden"
      >
        {refs.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setActive(r.id)}
            aria-current={r.id === current?.id}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px]
                        transition-colors ${
                          r.id === current?.id
                            ? 'bg-ink font-medium text-paper'
                            : 'bg-sunken text-graphite hover:text-ink'
                        }`}
          >
            {r.icon && <span aria-hidden>{r.icon}</span>}
            <span className="whitespace-nowrap">{r.title}</span>
          </button>
        ))}
      </nav>

      <article className="min-w-0 pb-24 xl:pt-11">
        {current && (
          <>
            <h2 className="display mb-4 flex items-center gap-2 text-[26px] tracking-[-0.02em] text-ink">
              {current.icon && <span aria-hidden>{current.icon}</span>}
              {current.title}
            </h2>
            <Markdown>{current.markdown}</Markdown>
          </>
        )}
      </article>
    </RailLayout>
  )
}

function SectionRail({
  refs,
  active,
  onPick,
}: {
  refs: Trip['reference']
  active: string | undefined
  onPick: (id: string) => void
}) {
  return (
    <nav aria-label="附录分区">
      <ol>
        {refs.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onPick(r.id)}
              aria-current={r.id === active ? 'true' : undefined}
              className={`flex w-full items-center gap-2 rounded-md py-[5px] pl-2 pr-1 text-left
                          text-[12.5px] transition-colors ${
                            r.id === active
                              ? 'bg-sunken font-medium text-ink'
                              : 'text-graphite hover:text-ink'
                          }`}
            >
              {r.icon && (
                <span aria-hidden className="text-[13px] leading-none">
                  {r.icon}
                </span>
              )}
              <span className="min-w-0 truncate">{r.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
