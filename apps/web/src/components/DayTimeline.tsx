import { useState } from 'react'
import {
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  KeyRound,
  MoonStar,
  Split,
  Star,
  TriangleAlert,
} from 'lucide-react'
import {
  CATEGORIES,
  PERIOD_ZH,
  TRANSPORTS,
  formatMinutes,
  resolvePeriod,
  type Booking,
  type Day,
  type Place,
  type Rental,
  type StayInfo,
  type Transport,
  type TripEvent,
} from '@jjj/schema'
import { buildTimeline, isConflict, type LegRow } from '../lib/layout.ts'
import type { StaySpan } from '../lib/derive.ts'
import type { Favorites } from '../data/useFavorites.ts'
import { iconFor } from '../lib/icons.tsx'
import { CategoryChip, kindVars } from './CategoryChip.tsx'
import { Dot, SlotText, TransportTimeline } from './TransportTimeline.tsx'
import { MapLinkButton } from './MapLinkButton.tsx'
import { Markdown } from './Markdown.tsx'

/** flight 事件没写 transport 块时的空骨架 —— 所有槽位都显示「待填」 */
const EMPTY_TRANSPORT: Transport = { mode: 'flight', arrDayOffset: 0, durationMin: null, stops: [] }

/** 时间列宽度。卡片内外共用，保证通勤条的竖线对得上卡片里的时间列。 */
const TIME_COL = '3.5rem'

export interface CardModules {
  /** 住宿区间模块的归属（首晚入住事件 → 区间），见 lib/derive.ts */
  stay?: Map<string, StaySpan>
  /** 租车区间模块的归属（取车事件 → 租赁） */
  rental?: Map<string, Rental>
}

export function DayTimeline({
  day,
  places,
  favorites,
  connectors = true,
  showTime = true,
  detail = false,
  modules,
}: {
  day: Day
  places: Map<string, Place>
  favorites: Favorites
  /** 筛选态（玩/吃/住/行/收藏）只看卡片本身 —— 通勤和空档在断章取义的子集里没有意义 */
  connectors?: boolean
  /** 住/行视图去掉最左边的时间列，其余与「全部」里同一张卡 */
  showTime?: boolean
  /** 全局详略：详 = 简介/注意/如果全部展开；简 = 折叠，卡上留「详情」按钮 */
  detail?: boolean
  modules?: CardModules
}) {
  const rows = buildTimeline(day)
  const card = (event: TripEvent) => (
    <EventCard
      key={event.id}
      event={event}
      date={day.date}
      places={places}
      favorites={favorites}
      showTime={showTime}
      detail={detail}
      staySpan={modules?.stay?.get(event.id)}
      rental={modules?.rental?.get(event.id)}
    />
  )
  if (!connectors) {
    return (
      <div className="space-y-3">
        {rows.flatMap((r) => (r.kind === 'event' ? [card(r.event)] : []))}
      </div>
    )
  }
  return (
    <div>
      {rows.map((row) =>
        row.kind === 'event' ? (
          card(row.event)
        ) : row.kind === 'leg' ? (
          <LegConnector key={row.key} row={row} places={places} />
        ) : (
          <IdleConnector
            key={row.key}
            minutes={row.minutes}
            labelled={row.labelled}
            overlapMin={row.overlapMin}
          />
        ),
      )}
    </div>
  )
}

/**
 * 统一事件卡。玩/吃/住/行/事务共用这一个模板，只有内部模块不同：
 *
 *   [时间] | [图标][类型][名称][待定]        …右上: [收藏]
 *          | [英文地址][地图]           …右侧: [金色预算]
 *          | [信息模块: 换乘时间轴 / 住宿区间 / 租车区间 / 预订]
 *          | [简要介绍] [注意条目] [如果条目]   ← 详略开关控制
 *
 * 可选行程不写文字标签 —— 左边条变虚线即是提示。
 */
function EventCard({
  event,
  date,
  places,
  favorites,
  showTime,
  detail,
  staySpan,
  rental,
}: {
  event: TripEvent
  /** 事件所在天的日期，换乘时间轴推算出发/到达日期用 */
  date: string
  places: Map<string, Place>
  favorites: Favorites
  showTime: boolean
  detail: boolean
  staySpan?: StaySpan
  rental?: Rental
}) {
  const [zoneOpen, setZoneOpen] = useState(false)
  const place = event.placeId ? places.get(event.placeId) : undefined
  const cat = CATEGORIES[event.category]
  const accented = cat.kind !== 'misc'
  const faved = favorites.has(event.id)
  const warned = event.flags.includes('warning')
  const tentative = event.flags.includes('tentative')
  const optional = event.flags.includes('optional')
  const needsBooking = event.flags.includes('needs-booking') && !event.booking
  const isPeriod = event.timeKind === 'period' || event.timeKind === 'allday'

  const zoneHasContent =
    Boolean(event.summary) ||
    Boolean(event.detail) ||
    event.notes.length > 0 ||
    event.variants.length > 0
  const zoneOpened = detail || zoneOpen

  return (
    <article
      id={event.id}
      className={`grid scroll-mt-[6.75rem] overflow-hidden rounded-xl border px-4 py-3.5 transition-colors ${
        accented ? 'grp-card border-l-[3px]' : 'bg-raised'
      } ${faved ? 'border-ink/30 shadow-[var(--shadow)]' : 'border-[var(--hairline)]'}`}
      style={{
        gridTemplateColumns: showTime ? `${TIME_COL} minmax(0,1fr)` : 'minmax(0,1fr)',
        ...kindVars(event.category),
        // 可选行程：不写文字，左边条改虚线即是提示（事务卡没有色条，补一根中性虚线）
        ...(optional
          ? accented
            ? { borderLeftStyle: 'dashed' as const }
            : {
                borderLeftWidth: 3,
                borderLeftStyle: 'dashed' as const,
                borderLeftColor: 'var(--graphite)',
              }
          : null),
      }}
    >
      {/* 时间放卡片内部，与标题共用行高 —— 对齐是结构保证的，不靠手调。
          精确时刻显示起止；上午/下午这类模糊时段显示中文时段词 */}
      {showTime && (
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
      )}

      <div className="min-w-0">
        {/* 第一行：图标 · 类型 · 名称 · 待定 ……收藏 */}
        <div className="flex items-start justify-between gap-2">
          {/* items-start + 圆片微调：标题换行时圆片钉在第一行，而不是漂到两行中间 */}
          <h4 className="display flex min-w-0 items-start gap-2 text-[17px] leading-7 text-ink">
            <CategoryChip category={event.category} className="mt-[3px]" />
            <span className="min-w-0">
              <span className="mr-1.5 text-[12px] font-normal text-graphite">{cat.zh}</span>
              {event.title}
              {tentative && <InlineBadge tone="muted">待定</InlineBadge>}
              {needsBooking && <InlineBadge tone="todo">待订</InlineBadge>}
            </span>
          </h4>
          <div className="flex shrink-0 items-center gap-1.5">
            {place && <MapLinkButton place={place} />}
            <FavoriteButton
              active={faved}
              onToggle={() => favorites.toggle(event.id)}
              title={event.title}
            />
          </div>
        </div>

        {/* 第二行：英文地址 ……金色预算（租车卡的预算在模块右上角，这里不重复） */}
        {(place || (event.cost && !rental)) && (
          <div className="mt-0.5 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[12px] text-graphite">
              {place ? (place.nameEn ?? place.name) : ''}
            </span>
            {event.cost && !rental && <CostText cost={event.cost} />}
          </div>
        )}

        {/* 信息模块：换乘时间轴（有 transport 块就画；flight 没写块画待填骨架）、
            住宿区间（只在区间首晚的入住卡上）、租车区间（取车卡上）、预订 */}
        {event.transports.length > 0 ? (
          <TransportTimeline transports={event.transports} date={date} />
        ) : event.category === 'flight' ? (
          <TransportTimeline transports={[EMPTY_TRANSPORT]} date={date} />
        ) : null}
        {staySpan && <StayModule span={staySpan} stay={event.stay} />}
        {rental && <RentalModule rental={rental} places={places} cost={event.cost} />}
        {event.booking && <BookingModule booking={event.booking} />}

        {/* 折叠区：简要介绍 / 正文 / 注意条目 / 如果条目。
            全局「详」= 全部展开，不再要求二次点击；
            「简」= 整块收起，留一颗「详情」把这里的全部内容一次展开 */}
        {zoneOpened && (
          <>
            {event.summary && <Markdown className="compact mt-2">{event.summary}</Markdown>}
            {event.detail && <Markdown className="compact mt-2">{event.detail}</Markdown>}
            {event.notes.length > 0 && <NotesBox notes={event.notes} />}
            {event.variants.length > 0 && <VariantList variants={event.variants} />}
          </>
        )}
        {zoneHasContent && !detail && (
          <button
            type="button"
            onClick={() => setZoneOpen((v) => !v)}
            aria-expanded={zoneOpened}
            className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-graphite
                       transition-colors hover:text-ink"
          >
            <ChevronDown
              size={12}
              className={`transition-transform ${zoneOpened ? 'rotate-180' : ''}`}
              aria-hidden
            />
            {zoneOpened ? '收起' : '详情'}
          </button>
        )}
      </div>
    </article>
  )
}


/**
 * 注意条目 —— 一张卡只有一个「注意」框：单条直接一行，
 * 多条在同一个框里用数字序号，不拆成多个框。
 */
function NotesBox({ notes }: { notes: string[] }) {
  return (
    <div
      className="mt-2.5 rounded-md border-l-2 border-[var(--tight)]
                 bg-[var(--paper-sunken)] px-2.5 py-2 text-[12.5px]"
    >
      <div className="flex items-start gap-1.5">
        <TriangleAlert size={12} className="mt-[4px] shrink-0 text-[var(--tight)]" aria-hidden />
        <span className="shrink-0 text-graphite">注意</span>
        {notes.length === 1 ? (
          <span className="min-w-0 flex-1 text-soft">{notes[0]}</span>
        ) : (
          <ol className="min-w-0 flex-1 list-decimal space-y-1 pl-[1.2em] text-soft marker:text-graphite">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function VariantList({ variants }: { variants: TripEvent['variants'] }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="mt-2.5 space-y-1">
      {variants.map((v, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-md border-l-2 bg-[var(--paper-sunken)]"
          style={{ borderLeftColor: 'var(--grp, var(--fog))' }}
        >
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-[12.5px]
                       transition-colors hover:bg-[var(--fog)]/40"
          >
            <Split size={12} className="shrink-0 text-graphite" aria-hidden />
            <span className="text-graphite">如果</span>
            <span className="min-w-0 flex-1 font-medium text-ink">{v.when}</span>
            <ChevronRight
              size={13}
              className={`shrink-0 text-graphite transition-transform ${
                open === i ? 'rotate-90' : ''
              }`}
              aria-hidden
            />
          </button>
          {open === i && <Markdown className="compact px-2.5 pb-2.5 pl-[28px]">{v.body}</Markdown>}
        </div>
      ))}
    </div>
  )
}

// ── 信息模块 ────────────────────────────────────────────────────

const md8 = (iso: string) => iso.slice(5).replace('-', '/')

/**
 * 住宿模块 —— 订房 App 卡片的字段。首行 区间 · 几晚 · 房型；
 * 下面两栏：左栏 平台 / 星级（几星就画几颗星），右栏 停车 / 早餐。
 * 只出现在区间首晚的入住卡上。缺的字段渲染「待填」空位，之后补进 TripMD 的 stay 块。
 */
function StayModule({ span, stay }: { span: StaySpan; stay?: StayInfo }) {
  const left: { label: string; value: React.ReactNode }[] = [
    { label: '平台', value: <SlotText value={stay?.platform} hint="待填" /> },
    {
      label: '星级',
      value:
        stay?.stars !== undefined ? (
          <span className="tint-faved tracking-[1px]" title={`${stay.stars} 星`}>
            {'★'.repeat(stay.stars)}
          </span>
        ) : (
          <SlotText value={undefined} hint="待填" />
        ),
    },
  ]
  const right: { label: string; value: React.ReactNode }[] = [
    { label: '停车', value: <SlotText value={stay?.parking} hint="待填" /> },
    { label: '早餐', value: <SlotText value={stay?.breakfast} hint="待填" /> },
  ]
  return (
    <div className="mt-2.5 rounded-lg bg-[var(--paper-sunken)] px-3.5 py-2.5 text-[12px]">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <MoonStar size={13} className="shrink-0 text-graphite" aria-hidden />
        <span className="tnum font-medium text-ink">
          {md8(span.checkIn)} <span className="font-normal text-graphite">→</span>{' '}
          {md8(span.checkOut)}
        </span>
        <span className="text-graphite">{span.nights} 晚</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-graphite">房型</span>
          <SlotText value={stay?.room} hint="待填" />
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11.5px]">
        {[left, right].map((col, ci) => (
          <div key={ci} className="min-w-0 space-y-1.5">
            {col.map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className="shrink-0 text-graphite">{s.label}</span>
                {s.value}
              </div>
            ))}
          </div>
        ))}
      </div>
      {(stay?.note ?? span.note) && (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-graphite">
          {stay?.note ?? span.note}
        </p>
      )}
    </div>
  )
}

/**
 * 租车模块 —— 与换乘时间轴同一套版式：
 * 头行 平台 · 车辆 · 取还同点 · 限总里程，右上角预算；
 * 时间轴两端镜像：左「日期 时间」、右「时间 日期」，日期字号更小。
 */
function RentalModule({
  rental,
  places,
  cost,
}: {
  rental: Rental
  places: Map<string, Place>
  cost?: TripEvent['cost']
}) {
  const pickup = rental.pickupPlaceId ? places.get(rental.pickupPlaceId) : undefined
  const dropoff = rental.dropoffPlaceId ? places.get(rental.dropoffPlaceId) : undefined
  const sameSpot = Boolean(pickup && dropoff && pickup.id === dropoff.id)
  const days = Math.max(
    1,
    Math.round(
      (Date.parse(`${rental.to.date}T00:00Z`) - Date.parse(`${rental.from.date}T00:00Z`)) /
        86_400_000,
    ),
  )
  return (
    <div className="mt-2.5 rounded-lg bg-[var(--paper-sunken)] px-3.5 pb-3 pt-2.5 text-[12px]">
      {/* 头行：平台（可待填）· 车辆 · 取还同点 · 限里程（可待填）……右上角预算 */}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11.5px]">
        <span className="inline-flex items-center gap-1.5">
          <KeyRound size={12} className="shrink-0 text-graphite" aria-hidden />
          <SlotText value={rental.platform} hint="平台 / 租车行" />
        </span>
        <span className="text-soft">{rental.what}</span>
        <span className="text-graphite">{sameSpot ? '取还同点' : '异地取还'}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-graphite">限里程</span>
          <SlotText value={rental.mileage} hint="待填" />
        </span>
        {cost && (
          <span className="ml-auto">
            <CostText cost={cost} />
          </span>
        )}
      </div>

      {/* 时间行：左「日期 时间」→ 右「时间 日期」，日期小一号 */}
      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="tnum text-[11px] text-graphite">{md8(rental.from.date)}</span>
          <span className="tnum truncate text-[15px] font-medium text-ink">
            {formatMinutes(rental.from.minute)}
          </span>
        </span>
        <span className="tnum shrink-0 text-[11px] text-graphite">{days} 天</span>
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="tnum truncate text-[15px] font-medium text-ink">
            {formatMinutes(rental.to.minute)}
          </span>
          <span className="tnum text-[11px] text-graphite">{md8(rental.to.date)}</span>
        </span>
      </div>

      {/* 线：●━━━━━━▶ */}
      <div className="mt-1.5 flex items-center" aria-hidden>
        <Dot />
        <span className="h-[2px] flex-1 rounded-full bg-ink/50" />
        <span className="-ml-px h-0 w-0 border-y-[4px] border-l-[7px] border-y-transparent border-l-ink/50" />
      </div>

      {/* 地点行：取 / 还 */}
      <div className="mt-1 flex items-start justify-between gap-3 text-[11.5px] leading-4">
        <span className="min-w-0 truncate text-soft">取 {pickup?.name ?? '待填'}</span>
        <span className="min-w-0 truncate text-right text-soft">还 {dropoff?.name ?? '待填'}</span>
      </div>

      {rental.note && (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-graphite">{rental.note}</p>
      )}
    </div>
  )
}

/** 预订状态：需预订琥珀、已预订灰。餐厅订位 / 票务预约共用 */
function BookingModule({ booking }: { booking: Booking }) {
  if (booking.status === 'none') return null
  const booked = booking.status === 'booked'
  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg
                 bg-[var(--paper-sunken)] px-3 py-2 text-[12px]"
    >
      <CalendarCheck
        size={13}
        className={`shrink-0 ${booked ? 'text-graphite' : 'text-[#8a5f18] dark:text-[#e0ac5c]'}`}
        aria-hidden
      />
      <span
        className={
          booked
            ? 'text-graphite'
            : 'todo-badge rounded-full px-2 py-[1.5px] text-[10.5px] font-medium leading-tight'
        }
      >
        {booked ? '已预订' : '需预订'}
      </span>
      {booking.deadline && <span className="tnum text-graphite">截止 {booking.deadline}</span>}
      {booking.note && <span className="min-w-0 text-graphite">{booking.note}</span>}
    </div>
  )
}

// ── 连接件 ──────────────────────────────────────────────────────

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

/**
 * 没有通勤的空档。短的只画一小段线保持先后关系，长的标出分钟数。
 * 两个事件真的撞车（后一个早于前一个结束）时必须报出来 —— 这种手写时段
 * 错误在别处没有任何提示：没有通勤段，余量检查就轮不到。
 */
function IdleConnector({
  minutes,
  labelled,
  overlapMin,
}: {
  minutes: number
  labelled: boolean
  overlapMin: number | null
}) {
  const showRow = labelled || overlapMin !== null
  return (
    <div className="grid" style={{ gridTemplateColumns: `${TIME_COL} minmax(0,1fr)` }}>
      <div className={`flex justify-center ${showRow ? 'py-1.5' : 'py-1'}`}>
        <span
          aria-hidden
          className={`w-px border-l border-dotted ${
            overlapMin !== null ? 'border-[var(--tight)]' : 'border-[var(--fog)]'
          }`}
        />
      </div>
      <div className={showRow ? 'py-2.5 pl-1 text-[11.5px] text-graphite' : 'py-1'}>
        {overlapMin !== null ? (
          <span
            className="tight-badge tnum whitespace-nowrap rounded-sm px-1.5 py-px text-[10.5px] font-medium"
            title="后一个事件早于前一个结束 —— 时段写重叠了"
          >
            时间重叠 {overlapMin} 分
          </span>
        ) : (
          labelled && (
            <>
              <span className="tnum">{fmtDuration(minutes)}</span> 空档
            </>
          )
        )}
      </div>
    </div>
  )
}

// ── 小件 ────────────────────────────────────────────────────────

/** 预算金额：金色加粗放大 —— 金额是决策信息。没抽出金额时降级显示原文 */
function CostText({ cost }: { cost: NonNullable<TripEvent['cost']> }) {
  if (cost.amount == null) {
    return (
      <span className="shrink-0 text-[11.5px] text-graphite" title={cost.raw}>
        {cost.raw}
      </span>
    )
  }
  return (
    <span
      className="tnum shrink-0 whitespace-nowrap text-[15px] font-semibold tint-faved"
      title={cost.raw}
    >
      {fmtMoney(cost.amount, cost.currency)}
      {cost.optional && <span className="ml-1 text-[10px] font-normal text-graphite">可选</span>}
    </span>
  )
}

const BADGE_TONES = {
  todo: 'todo-badge',
  muted: 'bg-[var(--paper-sunken)] text-graphite',
} as const

/** 标题行内的状态角标（待定/待订）。行内元素，跟着标题换行 */
function InlineBadge({
  tone,
  children,
}: {
  tone: keyof typeof BADGE_TONES
  children: React.ReactNode
}) {
  return (
    <span
      className={`ml-1.5 inline-block -translate-y-[2px] rounded-full px-2 py-[1.5px]
                  text-[10.5px] font-medium leading-tight ${BADGE_TONES[tone]}`}
    >
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

function periodLabel(e: TripEvent): string {
  if (e.timeKind === 'allday') return '全天'
  const p = resolvePeriod(e.timeRaw)
  return p ? PERIOD_ZH[p] : e.timeRaw
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
