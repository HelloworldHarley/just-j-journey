import { groupKeyOf, type Day, type GroupKey } from '@jjj/schema'

/**
 * 左侧日程轨。
 *
 * 不是一列纯文字目录 —— 每天带一条自己的构成小条（玩/吃/其他的占比），
 * 从上往下扫过去就能看出「这几天各是什么性质」：Day 4 整条绿的是户外日，
 * Day 5 一半粉的是吃完就走。和首页卡片上那组竖条是同一套语言。
 *
 * 竖线在已走过的天数上填成实色，像进度条 —— 这是「天数在推进」的直观表达。
 */
export function DayRail({
  days,
  activeIndex,
  todayDate,
  onJump,
}: {
  days: Day[]
  activeIndex: number
  todayDate: string
  onJump: (index: number) => void
}) {
  return (
    <nav aria-label="按天跳转">
      <ol className="relative">
        {/* 底轨 + 进度轨。进度到当前这一天为止 */}
        <span
          aria-hidden
          className="absolute left-[5px] top-2 bottom-2 w-px bg-[var(--fog)]"
        />
        <span
          aria-hidden
          className="absolute left-[5px] top-2 w-px bg-ink/35 transition-all duration-300"
          style={{
            height:
              days.length > 1
                ? `calc(${(activeIndex / (days.length - 1)) * 100}% - ${activeIndex === 0 ? 0 : 16}px)`
                : 0,
          }}
        />

        {days.map((day, i) => {
          const active = i === activeIndex
          const past = i < activeIndex
          const isToday = day.date === todayDate
          return (
            <li key={day.index} className="relative">
              <button
                type="button"
                onClick={() => onJump(i)}
                aria-current={active ? 'true' : undefined}
                className="group flex w-full items-start gap-2.5 py-2 text-left"
              >
                <span
                  aria-hidden
                  className={`mt-[7px] h-[11px] w-[11px] shrink-0 rounded-full ring-[3px]
                              ring-[var(--paper)] transition-all ${
                                active
                                  ? 'scale-110 bg-ink'
                                  : past
                                    ? 'bg-ink/30'
                                    : 'border-[1.5px] border-[var(--fog)] bg-paper group-hover:border-graphite'
                              }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span
                      className={`signage text-[10.5px] transition-colors ${
                        active ? 'text-ink' : 'text-graphite group-hover:text-soft'
                      }`}
                    >
                      Day {day.index}
                    </span>
                    {isToday && (
                      <span className="h-[5px] w-[5px] rounded-full bg-[var(--tight)]" title="今天" />
                    )}
                  </span>
                  <span
                    className={`tnum block text-[10.5px] leading-4 ${
                      active ? 'text-soft' : 'text-graphite/70'
                    }`}
                  >
                    {day.date.slice(5).replace('-', '/')} {day.weekday}
                  </span>
                  <CompositionBar day={day} dim={!active} />
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** 当天玩/吃/其他的占比，一条 3px 的小横条 */
function CompositionBar({ day, dim }: { day: Day; dim: boolean }) {
  const acc: Record<GroupKey, number> = { play: 0, food: 0, other: 0 }
  for (const e of day.events) {
    acc[groupKeyOf(e.category)] += Math.max(e.endMin - e.startMin, 15)
  }
  const total = acc.play + acc.food + acc.other || 1

  return (
    <span
      aria-hidden
      className={`mt-1.5 flex h-[3px] w-full overflow-hidden rounded-full transition-opacity ${
        dim ? 'opacity-45' : 'opacity-100'
      }`}
    >
      {(['play', 'food', 'other'] as GroupKey[]).map((g) =>
        acc[g] > 0 ? (
          <span
            key={g}
            style={{
              width: `${(acc[g] / total) * 100}%`,
              background: `var(--g-${g})`,
              opacity: g === 'other' ? 0.3 : 1,
            }}
          />
        ) : null,
      )}
    </span>
  )
}
