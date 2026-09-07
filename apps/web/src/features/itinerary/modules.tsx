import type React from 'react'
import { KeyRound, MoonStar } from 'lucide-react'
import type { Place, Rental, Stay, TripEvent } from '@jjj/schema'
import { daysBetween } from '@jjj/tripmd'
import { fmtMoney, formatMinutes, shortDate } from '../../lib/format.ts'
import { Arrow, Dot, SlotText, TermsRow, TimeStack } from './ticket-parts.tsx'

/**
 * 首次引用长出的**信息模块** —— 住宿 / 租车的票面卡。
 *
 * 它们是 TransportTimeline 的兄弟（同一套 ticket-parts 零件、同一种
 * 「有起止时刻、有节点、有条款的凭证」读法），不是事件卡的内脏 ——
 * 原先挤在 DayTimeline 里，683 行的文件装了 13 个组件。
 * 预订状态不在此列：它并进了标题行角标，截止/备注下沉注意条目盒。
 */

/** 预算金额：金色加粗放大 —— 金额是决策信息。没抽出金额时降级显示原文 */
export function CostText({ cost }: { cost: NonNullable<TripEvent['cost']> }) {
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

/**
 * 住宿模块 —— 订房 App 卡片的字段。首行 入住 → 退房 · 几晚 · 房型；
 * 下面两栏：左栏 平台 / 星级（几星就画几颗星），右栏 停车 / 早餐。
 * 只出现在入住当天那张卡上。缺的字段渲染「待填」空位，之后补进 trip-stays 块。
 */
export function StayModule({ stay }: { stay: Stay }) {
  const nights = Math.max(1, daysBetween(stay.from.date, stay.to.date))
  const left: { label: string; value: React.ReactNode }[] = [
    { label: '平台', value: <SlotText value={stay.platform} hint="待填" /> },
    {
      label: '星级',
      value:
        stay.stars !== undefined ? (
          <span className="tint-faved tracking-[1px]" title={`${stay.stars} 星`}>
            {'★'.repeat(stay.stars)}
          </span>
        ) : (
          <SlotText value={undefined} hint="待填" />
        ),
    },
  ]
  const right: { label: string; value: React.ReactNode }[] = [
    { label: '停车', value: <SlotText value={stay.parking} hint="待填" /> },
    { label: '早餐', value: <SlotText value={stay.breakfast} hint="待填" /> },
  ]
  return (
    <div className="mt-2.5 rounded-lg bg-[var(--paper-sunken)] px-3.5 py-2.5 text-[12px]">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <MoonStar size={13} className="shrink-0 text-graphite" aria-hidden />
        <span className="tnum font-medium text-ink">
          {shortDate(stay.from.date)} {formatMinutes(stay.from.minute)}{' '}
          <span className="font-normal text-graphite">→</span> {shortDate(stay.to.date)}{' '}
          {formatMinutes(stay.to.minute)}
        </span>
        <span className="text-graphite">{nights} 晚</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-graphite">房型</span>
          <SlotText value={stay.room} hint="待填" />
        </span>
        {stay.cost && (
          <span className="ml-auto">
            <CostText cost={stay.cost} />
          </span>
        )}
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
      {/* 与租车同构：缺的字段渲染「待填」空位，不是整行消失 */}
      <TermsRow terms={[{ label: '退改', value: stay.refund }]} />
      {stay.note && (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-graphite">{stay.note}</p>
      )}
    </div>
  )
}

/**
 * 租车模块 —— 与换乘时间轴同一套票面版式，读起来是同一种东西：
 *
 *   🔑 Turo · 保时捷 Macan · 共 3 天                          $310
 *   11:30                                             11:20
 *   10/02                                             10/05
 *   ●━━━━━━━━━━━━━━━━━━━━━━━━━━━▶
 *   取 唐人街提车点                            还 唐人街提车点
 *   还车 取还同点 · 里程上限 600 英里 · 保险 Turo 自带 · 退改 24 小时内
 *
 * 不标红色 `+n`：租车跨天是常态不是意外，天数已在头行写着，
 * 而这套设计里红色只留给真会出事的东西。
 * 「11:20 前必须还车」这类坑写进卡片的 `notes`，不塞进凭证。
 */
export function RentalModule({
  rental,
  places,
  eventCost,
}: {
  rental: Rental
  places: Map<string, Place>
  /** 旧写法兜底：钱写在提车事件上时仍显示，新写法住在 rental.cost */
  eventCost?: TripEvent['cost']
}) {
  const cost = rental.cost ?? eventCost
  const pickup = rental.pickupPlaceId ? places.get(rental.pickupPlaceId) : undefined
  const dropoff = rental.dropoffPlaceId ? places.get(rental.dropoffPlaceId) : undefined
  const sameSpot = Boolean(pickup && dropoff && pickup.id === dropoff.id)
  const days = Math.max(1, daysBetween(rental.from.date, rental.to.date))

  return (
    <div className="mt-2.5 rounded-lg bg-[var(--paper-sunken)] px-3.5 pb-3 pt-2.5">
      {/* 行 1：平台 · 车型 · 总天数 ……右上角预算 */}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11.5px]">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <KeyRound size={12} className="shrink-0 text-graphite" aria-hidden />
          <SlotText value={rental.platform} hint="平台 / 租车行" />
        </span>
        <span className="min-w-0 truncate text-soft">{rental.what}</span>
        <span className="tnum text-graphite">共 {days} 天</span>
        {cost && (
          <span className="ml-auto">
            <CostText cost={cost} />
          </span>
        )}
      </div>

      {/* 行 2：时刻在上、日期在下，两端对齐；天数卡在线上 */}
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <TimeStack
          time={formatMinutes(rental.from.minute)}
          date={rental.from.date}
          align="left"
        />
        <TimeStack time={formatMinutes(rental.to.minute)} date={rental.to.date} align="right" />
      </div>

      {/* 线上不重复写天数 —— 租车是一段连续区间，和直飞航班一样没有分段，
          总时长头行已经写了。分段时长只在有中转时才有意义 */}
      <div className="mt-1.5 flex items-center" aria-hidden>
        <Dot />
        <span className="h-[2px] flex-1 rounded-full bg-ink/50" />
        <Arrow />
      </div>

      <div className="mt-1 flex items-start justify-between gap-3 text-[10.5px] leading-4 text-graphite">
        <span className="min-w-0 truncate">取 {pickup?.name ?? '待填'}</span>
        <span className="min-w-0 truncate text-right">还 {dropoff?.name ?? '待填'}</span>
      </div>

      {/* 行 3：还车方式 · 里程 · 保险 · 退改 */}
      <TermsRow
        terms={[
          { label: '还车', value: sameSpot ? '取还同点' : '异地还车' },
          { label: '里程上限', value: rental.mileage },
          { label: '保险', value: rental.insurance },
          { label: '退改', value: rental.refund },
        ]}
      />
    </div>
  )
}

