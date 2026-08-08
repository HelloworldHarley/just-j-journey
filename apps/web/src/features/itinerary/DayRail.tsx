import type { Day, GroupKey } from '@jjj/schema'
import { dayComposition } from '@jjj/tripmd'
import { shortDate } from '../../lib/format.ts'

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
        {days.map((day, i) => {
          const active = i === activeIndex
          const past = i < activeIndex
          const isToday = day.date === todayDate
          return (
            <li key={day.index} className="relative">
              {/*
               * 轨道按「每行接力」画，而不是一根按百分比定长的绝对定位线。
               *
               * 这一段从本行圆点中心（button 的 py-2 = 8px + 圆点 mt-7px + 半径 5.5px）
               * 起，长度取本行高度 —— 于是末端正好落在下一行圆点中心。行高不等时也自洽。
               * 之前用「activeIndex / (天数-1) 的百分比」算总长，圆点却在各行实际位置上，
               * 两套定位对不齐：偏差从首行 -12.5px 一路漂到末行 +29.3px。
               */}
              {i < days.length - 1 && (
                <span
                  aria-hidden
                  className={`absolute left-[5px] top-[20.5px] h-full w-px transition-colors duration-300 ${
                    past ? 'bg-ink/35' : 'bg-[var(--fog)]'
                  }`}
                />
              )}
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
                    {shortDate(day.date)} {day.weekday}
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
  const acc = dayComposition(day)
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
              background: `var(--t-${g})`,
              opacity: g === 'other' ? 0.3 : 1,
            }}
          />
        ) : null,
      )}
    </span>
  )
}
