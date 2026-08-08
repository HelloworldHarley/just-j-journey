import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Pencil, Settings2, Star, X } from 'lucide-react'
import type { GroupKey, TripSummary } from '@jjj/schema'
import { useTripList } from '../../data/hooks.ts'
import { useTripTitle } from '../../data/useTripOverrides.ts'
import { useFavorites } from '../../data/useFavorites.ts'
import { shortDate } from '../../lib/format.ts'
import { daysUntil, todayIso } from '../../lib/time.ts'
import { Loading, Problem } from '../../components/States.tsx'
import { SettingsSheet } from './SettingsSheet.tsx'

export function HomePage() {
  const { data, isPending, error } = useTripList()
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (isPending) return <Loading />
  if (error) return <Problem title="行程列表加载失败" detail={String(error)} />

  const today = todayIso('UTC')
  const upcoming = data.filter((t) => t.dates.end >= today)
  const past = data.filter((t) => t.dates.end < today)

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-12">
      <div className="flex items-start justify-between gap-3">
        <h1 className="display text-[34px] leading-none tracking-[-0.03em] text-ink sm:text-[40px]">
          Just J Journey
        </h1>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="设置"
          title="设置"
          className="mt-1 rounded-full bg-sunken p-2 text-graphite transition-colors hover:text-ink"
        >
          <Settings2 size={16} aria-hidden />
        </button>
      </div>
      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-graphite">
        把 Markdown 行程读成时间的形状。It's just a J thing.
      </p>

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}

      {data.length === 0 && (
        <Problem
          title="还没有行程"
          detail="在 apps/web/public/data/ 下建一个目录放 plan.md，然后运行 pnpm data:check"
        />
      )}

      <Section title="即将出发" trips={upcoming} />
      <Section title="已完成" trips={past} muted />
    </div>
  )
}

function Section({
  title,
  trips,
  muted,
}: {
  title: string
  trips: TripSummary[]
  muted?: boolean
}) {
  if (trips.length === 0) return null
  return (
    <section className="mt-10">
      <h2 className="signage mb-3.5 text-[12px] text-graphite">{title}</h2>
      <div className="grid gap-3">
        {trips.map((t) => (
          <TripCard key={t.id} trip={t} muted={muted} />
        ))}
      </div>
    </section>
  )
}

/**
 * 行程卡片。
 *
 * 竖条当「头像」用 —— 一个紧凑的行程指纹作左侧视觉锚点，文字排右边。
 * 之前竖条左对齐、结束日期右对齐，中间一大片空白，两边对不上；
 * 而且日期出现了两次（顶部一行 + 副标题里一份）。现在日期只说一次。
 *
 * 整卡可点用「拉伸链接」实现：卡片是 div，一个绝对定位的 Link 铺满作点击区，
 * 编辑/收藏这类控件叠在它上面。既保留整卡可点，又能放按钮。
 */
function TripCard({ trip, muted }: { trip: TripSummary; muted?: boolean }) {
  const { title, setTitle } = useTripTitle(trip.id, trip.title)
  const favorites = useFavorites(trip.id)
  const [editing, setEditing] = useState(false)

  const left = daysUntil(trip.dates.start, 'UTC')
  const countdown =
    left > 0 ? `${left} 天后` : left === 0 ? '今天出发' : muted ? '已结束' : '进行中'

  const range = `${shortDate(trip.dates.start)} – ${shortDate(trip.dates.end)}`

  return (
    <div
      /*
        min-w-0 是必需的：grid 子项默认 min-width:auto，不会缩到内容宽度以下，
        窄屏上整张卡片会顶穿视口。
      */
      className={`group relative flex min-w-0 gap-4 rounded-2xl border border-[var(--hairline)]
                  bg-raised px-4 py-4 transition-all hover:border-ink/20
                  hover:shadow-[var(--shadow)] sm:gap-5 sm:px-5 sm:py-5
                  ${muted ? 'opacity-70' : ''}`}
    >
      {!editing && (
        <Link
          to={`/trip/${trip.id}`}
          className="absolute inset-0 rounded-2xl"
          aria-label={`打开 ${title}`}
        />
      )}

      <DayShapeBars shape={trip.dayShape} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          {editing ? (
            <TitleEditor
              initial={title}
              onCommit={(v) => {
                setTitle(v)
                setEditing(false)
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <h3 className="display min-w-0 truncate text-[20px] leading-8 tracking-[-0.02em] text-ink sm:text-[23px]">
              {title}
            </h3>
          )}

          {!editing && (
            <div className="relative z-10 flex shrink-0 items-center gap-2">
              <span className="tnum whitespace-nowrap text-[13px] text-soft">{countdown}</span>
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="重命名"
                title="重命名"
                className="rounded-full p-1 text-graphite/0 transition-colors
                           group-hover:text-graphite/60 hover:!text-ink focus-visible:text-ink"
              >
                <Pencil size={14} aria-hidden />
              </button>
            </div>
          )}
        </div>

        <p className="mt-1 truncate text-[12.5px] text-graphite sm:text-[13px]">
          <span className="tnum">{range}</span>
          <span className="mx-1.5 text-[var(--fog)]">·</span>
          {trip.destination}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-graphite">
          {trip.travelers != null && <Stat n={trip.travelers} unit="人" />}
          <Stat n={trip.dayCount} unit="天" />
          <Stat n={trip.eventCount} unit="个安排" />
          {trip.bookingCount > 0 && (
            <span className="todo-badge tnum rounded-full px-2 py-[1.5px] text-[11px] font-medium">
              {trip.bookingCount} 项待订
            </span>
          )}
          {favorites.count > 0 && (
            <span className="tint-faved inline-flex items-center gap-1">
              <Star size={11} className="fill-current" aria-hidden />
              <span className="tnum">{favorites.count}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ n, unit }: { n: number; unit: string }) {
  return (
    <span>
      <span className="tnum text-soft">{n}</span> {unit}
    </span>
  )
}

function TitleEditor({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string
  onCommit: (v: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  return (
    <div className="relative z-10 flex min-w-0 flex-1 items-center gap-1.5">
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit(value)
          if (e.key === 'Escape') onCancel()
        }}
        onBlur={() => onCommit(value)}
        aria-label="行程名称"
        className="display min-w-0 flex-1 rounded-md border border-ink/25 bg-paper px-2 py-0.5
                   text-[23px] leading-8 tracking-[-0.02em] text-ink outline-none
                   focus:border-ink/50"
      />
      {/* onMouseDown 而非 onClick —— input 的 blur 会先触发并提交，onClick 根本轮不到 */}
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault()
          onCommit(value)
        }}
        aria-label="保存"
        className="rounded-full p-1 text-graphite transition-colors hover:text-ink"
      >
        <Check size={15} aria-hidden />
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault()
          onCancel()
        }}
        aria-label="取消"
        className="rounded-full p-1 text-graphite transition-colors hover:text-ink"
      >
        <X size={15} aria-hidden />
      </button>
    </div>
  )
}

/**
 * 行程指纹：一天一根竖条。
 * 高度 = 当天跨度（哪天长哪天短），内部堆叠 = 玩/吃/其他的占比。
 * 条宽随天数收缩，长途行程也不会撑破卡片。
 */
/** 最短的一天也要占这么高，否则会缩成一条看不清的线 */
const BAR_MIN_PCT = 34

function DayShapeBars({ shape }: { shape: TripSummary['dayShape'] }) {
  const longest = Math.max(...shape.map((d) => d.span), 1)
  const gap = shape.length > 12 ? 1 : 3
  // 窄屏让出更多空间给标题
  const blockW = typeof window !== 'undefined' && window.innerWidth < 640 ? 80 : 104
  const barW = Math.max(3, Math.min(20, (blockW - gap * (shape.length - 1)) / shape.length))

  return (
    /*
      self-stretch 让这一列跟着卡片内容一起长高，条高用百分比。
      写死像素高度的话，卡片比它高时底下会空出一截，
      而且文字多一行就得回来改数字。
    */
    <div
      className="flex shrink-0 items-end self-stretch"
      style={{ width: blockW, minHeight: 56, gap }}
      aria-hidden
    >
      {shape.map((d, i) => {
        const total = d.play + d.food + d.other || 1
        const heightPct = BAR_MIN_PCT + (100 - BAR_MIN_PCT) * (d.span / longest)
        const segments: [GroupKey, number][] = [
          ['play', d.play],
          ['food', d.food],
          ['other', d.other],
        ]
        return (
          <div
            key={i}
            /*
              圆角压到 2px：overflow-hidden 只削最上和最下两端的角，
              而「玩」永远在底、「吃」多数时候夹在中间 —— 3px 时绿色被切掉缺口、
              桃红却是完整矩形，看上去就像桃红更宽。
            */
            className="flex flex-col-reverse overflow-hidden rounded-[2px] bg-[var(--paper-sunken)]"
            style={{ width: barW, height: `${heightPct}%` }}
            title={`Day ${i + 1}`}
          >
            {segments.map(([g, mins]) =>
              mins > 0 ? (
                <span
                  key={g}
                  style={{
                    height: `${(mins / total) * 100}%`,
                    background: `var(--t-${g})`,
                    // 「其他」压暗，让玩/吃在条里也是主角
                    opacity: g === 'other' ? 0.22 : 1,
                  }}
                />
              ) : null,
            )}
          </div>
        )
      })}
    </div>
  )
}


