import { useState } from 'react'
import { ChevronDown, ChevronRight, Split, Star, TriangleAlert } from 'lucide-react'
import {
  CATEGORIES,
  PERIOD_ZH,
  TRANSPORTS,
  formatMinutes,
  groupOf,
  type Day,
  type Place,
  type Transport,
  type TripEvent,
} from '@jjj/schema'
import { buildTimeline, isConflict, type LegRow } from '../lib/layout.ts'
import type { Favorites } from '../data/useFavorites.ts'
import { iconFor } from '../lib/icons.tsx'
import { CategoryChip, groupVars } from './CategoryChip.tsx'
import { TransportTimeline } from './TransportTimeline.tsx'
import { MapLinkButton } from './MapLinkButton.tsx'
import { Markdown } from './Markdown.tsx'

/** flight 事件没写 transport 块时的空骨架 —— 所有槽位都显示「待填」 */
const EMPTY_TRANSPORT: Transport = { mode: 'flight', arrDayOffset: 0, durationMin: null, stops: [] }

/** 时间列宽度。卡片内外共用，保证通勤条的竖线对得上卡片里的时间列。 */
const TIME_COL = '3.5rem'

export function DayTimeline({
  day,
  places,
  favorites,
  connectors = true,
}: {
  day: Day
  places: Map<string, Place>
  favorites: Favorites
  /** 筛选态（玩/吃/收藏）只看卡片本身 —— 通勤和空档在断章取义的子集里没有意义 */
  connectors?: boolean
}) {
  const rows = buildTimeline(day)
  if (!connectors) {
    return (
      <div className="space-y-3">
        {rows
          .filter((r) => r.kind === 'event')
          .map((row) => (
            <EventCard key={row.key} event={row.event} places={places} favorites={favorites} />
          ))}
      </div>
    )
  }
  return (
    <div>
      {rows.map((row) =>
        row.kind === 'event' ? (
          <EventCard key={row.key} event={row.event} places={places} favorites={favorites} />
        ) : row.kind === 'leg' ? (
          <LegConnector key={row.key} row={row} places={places} />
        ) : (
          <IdleConnector key={row.key} minutes={row.minutes} labelled={row.labelled} />
        ),
      )}
    </div>
  )
}

/**
 * 事件标题行的展示规则（通用，不针对任何行程）：
 *
 *   [类别中文] · [标题]     …右侧: [预算] [地图] [收藏]
 *
 * 地点名只在「与标题不重复」时才出现在副行 —— 标题叫 "Seattle Center"、
 * 地点也叫 "Seattle Center" 时重复一遍是噪音。判断用归一化包含关系。
 */
function placeIsRedundant(title: string, placeName: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s·・.,/|-]+/g, '')
  const a = norm(title)
  const b = norm(placeName)
  return a.includes(b) || b.includes(a)
}

function EventCard({
  event,
  places,
  favorites,
}: {
  event: TripEvent
  places: Map<string, Place>
  favorites: Favorites
}) {
  const [openVariant, setOpenVariant] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(false)
  const place = event.placeId ? places.get(event.placeId) : undefined
  const cat = CATEGORIES[event.category]
  const accented = cat.group !== 'other'
  const faved = favorites.has(event.id)
  const warned = event.flags.includes('warning')
  const tentative = event.flags.includes('tentative')
  const optional = event.flags.includes('optional')
  const booking = event.flags.includes('needs-booking')
  const isPeriod = event.timeKind === 'period' || event.timeKind === 'allday'

  const showPlaceLine = place && !placeIsRedundant(event.title, place.name)
  const hasDetail = Boolean(event.detail)

  return (
    <article
      className={`grid overflow-hidden rounded-xl border px-4 py-3.5 transition-colors ${
        accented ? 'grp-card border-l-[3px]' : 'bg-raised'
      } ${
        tentative
          ? 'border-dashed border-[var(--fog)]'
          : faved
            ? 'border-ink/30 shadow-[var(--shadow)]'
            : 'border-[var(--hairline)]'
      }`}
      style={{ gridTemplateColumns: `${TIME_COL} minmax(0,1fr)`, ...groupVars(event.category) }}
    >
      {/* 时间放卡片内部，与标题共用行高 —— 对齐是结构保证的，不靠手调 */}
      <div className="pr-3 pt-px">
        <div
          className={`tnum text-[13.5px] leading-7 ${faved ? 'font-medium text-ink' : 'text-soft'}`}
        >
          {isPeriod ? periodLabel(event) : formatMinutes(event.startMin)}
        </div>
        {event.timeKind === 'exact' && (
          <div className="tnum -mt-1 text-[11px] leading-5 text-graphite">
            {formatMinutes(event.endMin)}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          {/* items-start + 圆片微调：标题换行时圆片钉在第一行，而不是漂到两行中间 */}
          <h4 className="display flex min-w-0 items-start gap-2 text-[17px] leading-7 text-ink">
            <CategoryChip category={event.category} className="mt-[3px]" />
            <span className="min-w-0">
              {/* 手机上省掉类别中文 —— 圆片图标已表意，把宽度留给标题 */}
              <span className="mr-1.5 hidden text-[12px] font-normal text-graphite sm:inline">
                {cat.zh}
              </span>
              {event.title}
              {warned && (
                <TriangleAlert
                  size={13}
                  className="ml-1 inline -translate-y-[2px] text-[var(--tight)]"
                  aria-hidden
                />
              )}
            </span>
          </h4>
          <div className="flex shrink-0 items-center gap-1.5">
            {/* 预算贴右侧：金额是决策信息，不该埋在正文里 */}
            {event.cost?.amount != null && (
              <span
                className={`tnum whitespace-nowrap text-[13px] ${
                  event.cost.optional ? 'text-graphite' : 'text-soft'
                }`}
                title={event.cost.raw}
              >
                {fmtMoney(event.cost.amount, event.cost.currency)}
                {event.cost.optional && <span className="ml-0.5 text-[10px]">可选</span>}
              </span>
            )}
            {place && <MapLinkButton place={place} />}
            <FavoriteButton
              active={faved}
              onToggle={() => favorites.toggle(event.id)}
              title={event.title}
            />
          </div>
        </div>

        {/* 副行：状态 + （不与标题重复时的）地点。金额已上移，这里不再放 */}
        {(warned || booking || tentative || optional || isPeriod || showPlaceLine) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-graphite">
            {warned && <StatusTag tone="warn">注意</StatusTag>}
            {booking && <StatusTag tone="todo">待订</StatusTag>}
            {tentative && <StatusTag tone="muted">待定</StatusTag>}
            {optional && <StatusTag tone="muted">可砍</StatusTag>}
            {isPeriod && <StatusTag tone="muted">时间未定</StatusTag>}
            {showPlaceLine && <span className="truncate">{place.name}</span>}
          </div>
        )}

        {/* 换乘时间轴：有 transport 块就画（任何类别、行程中任何位置）；
            flight 类别没写块也画空骨架 —— 机票常常最后才买，空位等着填 */}
        {event.transports.length > 0 ? (
          <TransportTimeline transports={event.transports} />
        ) : event.category === 'flight' ? (
          <TransportTimeline transports={[EMPTY_TRANSPORT]} />
        ) : null}

        {/* 首段常显，其余折叠 —— 第一眼永远是最重要的一句 */}
        {event.summary && <Markdown className="compact mt-2">{event.summary}</Markdown>}
        {hasDetail && (
          <>
            {expanded && <Markdown className="compact mt-2">{event.detail}</Markdown>}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-graphite
                         transition-colors hover:text-ink"
            >
              <ChevronDown
                size={12}
                className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
                aria-hidden
              />
              {expanded ? '收起' : '详情'}
            </button>
          </>
        )}

        {event.variants.length > 0 && (
          <div className="mt-2.5 space-y-1">
            {event.variants.map((v, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-md border-l-2 bg-[var(--paper-sunken)]"
                style={{ borderLeftColor: 'var(--grp)' }}
              >
                <button
                  type="button"
                  onClick={() => setOpenVariant(openVariant === i ? null : i)}
                  aria-expanded={openVariant === i}
                  className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-[12.5px]
                             transition-colors hover:bg-[var(--fog)]/40"
                >
                  <Split size={12} className="shrink-0 text-graphite" aria-hidden />
                  <span className="text-graphite">如果</span>
                  <span className="min-w-0 flex-1 font-medium text-ink">{v.when}</span>
                  <ChevronRight
                    size={13}
                    className={`shrink-0 text-graphite transition-transform ${
                      openVariant === i ? 'rotate-90' : ''
                    }`}
                    aria-hidden
                  />
                </button>
                {openVariant === i && (
                  <Markdown className="compact px-2.5 pb-2.5 pl-[28px]">{v.body}</Markdown>
                )}
              </div>
            ))}
          </div>
        )}

        {event.booking?.note && (
          <div className="mt-2">
            <Tag>{event.booking.note}</Tag>
          </div>
        )}
      </div>
    </article>
  )
}

/** 两张卡片之间的通勤条：一段虚线 + 交通方式 + 时长 + 导航 */
function LegConnector({ row, places }: { row: LegRow; places: Map<string, Place> }) {
  const { leg, slackMin } = row
  const t = TRANSPORTS[leg.mode]
  const Icon = iconFor(t.icon)
  const to = leg.to ? places.get(leg.to) : undefined
  const from = leg.from ? places.get(leg.from) : undefined
  const conflict = isConflict(slackMin)

  return (
    <div className="grid" style={{ gridTemplateColumns: `${TIME_COL} minmax(0,1fr)` }}>
      <div className="flex justify-center py-1.5">
        <span aria-hidden className="w-px border-l border-dashed border-[var(--fog)]" />
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 py-2.5 pl-1 text-[12px] text-graphite">
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
          <Icon size={13} aria-hidden />
          {t.zh}
          {leg.durationMin !== null && <span className="tnum">{fmtDuration(leg.durationMin)}</span>}
          {leg.distanceKm !== null && <span className="tnum">{leg.distanceKm} km</span>}
        </span>
        {leg.label && <span className="min-w-0 truncate">{leg.label}</span>}
        {conflict && (
          <span
            className="tight-badge tnum whitespace-nowrap rounded-sm px-1.5 py-px text-[10.5px] font-medium"
            title={`空档 ${row.gapMin} 分钟，但这段路要 ${leg.durationMin} 分钟`}
          >
            差 {-(slackMin as number)} 分
          </span>
        )}
        {to && <MapLinkButton place={to} from={from ?? null} mode={leg.mode} label="导航" />}
      </div>
    </div>
  )
}

/** 没有通勤的空档。短的只画一小段线保持先后关系，长的标出分钟数。 */
function IdleConnector({ minutes, labelled }: { minutes: number; labelled: boolean }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: `${TIME_COL} minmax(0,1fr)` }}>
      <div className={`flex justify-center ${labelled ? 'py-1.5' : 'py-1'}`}>
        <span aria-hidden className="w-px border-l border-dotted border-[var(--fog)]" />
      </div>
      <div className={labelled ? 'py-2.5 pl-1 text-[11.5px] text-graphite' : 'py-1'}>
        {labelled && (
          <>
            <span className="tnum">{fmtDuration(minutes)}</span> 空档
          </>
        )}
      </div>
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-sm bg-[var(--paper-sunken)] px-1.5 py-px text-[10.5px] text-graphite">
      {children}
    </span>
  )
}

/**
 * 收藏按钮。这颗星表示**你的**意思，不是作者预先标的重点。
 * 将来 Agent 改行程时读这份清单，就知道哪些不该随便动。
 */
function FavoriteButton({
  active,
  onToggle,
  title,
}: {
  active: boolean
  onToggle: () => void
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? `取消收藏「${title}」` : `收藏「${title}」`}
      title={active ? '取消收藏' : '收藏 —— 修改行程时会重点保留'}
      className={`rounded-full p-1 transition-colors ${
        active ? 'tint-faved' : 'text-graphite/45 hover:text-graphite'
      }`}
    >
      <Star size={15} className={active ? 'fill-current' : ''} aria-hidden />
    </button>
  )
}

/**
 * 状态标签。三种色调各自表意：
 *   warn 红（唯一的红，有坑）· todo 琥珀（待办）· muted 灰（不确定）
 */
const TONES = {
  warn: 'tight-badge',
  todo: 'todo-badge',
  muted: 'bg-[var(--paper-sunken)] text-graphite',
} as const

function StatusTag({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full px-2 py-[1.5px] text-[10.5px] font-medium leading-tight ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

function periodLabel(e: TripEvent): string {
  if (e.timeKind === 'allday') return '全天'
  const key = (Object.keys(PERIOD_ZH) as (keyof typeof PERIOD_ZH)[]).find((k) =>
    e.timeRaw.toLowerCase().includes(k),
  )
  return key ? PERIOD_ZH[key] : e.timeRaw
}

export function fmtDuration(min: number): string {
  if (min < 60) return `${min} 分`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} 小时` : `${h} 小时 ${m} 分`
}

const SIGN: Record<string, string> = { USD: '$', CNY: '¥', JPY: '¥', EUR: '€', GBP: '£', KRW: '₩' }

export function fmtMoney(amount: number, currency?: string): string {
  const sign = currency ? (SIGN[currency] ?? `${currency} `) : ''
  return `${sign}${amount.toLocaleString()}`
}

export { groupOf }
