import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Place, TripEvent } from '@jjj/schema'
import { formatMinutes } from '../../lib/format.ts'
import { MapLinkButton } from '../../components/MapLinkButton.tsx'
import type { DayStop } from '../../lib/map-scene.ts'

/**
 * 点 pin 后的底部小卡。
 *
 * 固定在地图容器底部而不是 maplibre 气泡：390px 上气泡会遮住路径、
 * 还要 React ↔ 原生 DOM 桥接；底部卡与全站卡片同一套语言，稳得多。
 *
 * 结构上分两层，是为了换站手势：**外壳只管定位，内层才是视觉卡片**。
 * 桌面端外壳带着 `sm:-translate-x-1/2` 做水平居中，如果把拖动位移写在外壳上
 * 就会把这个居中变换整个顶掉；位移写在内层就互不相干。
 * 左右翻页按钮挂在外壳上（不跟着拖动走），也因此能落在卡片外侧。
 */

/** 判定为「换站」的滑动距离；不到就弹回 */
const SWIPE_COMMIT = 56
/** 拖动跟手的上限，以及没有邻站那一侧的阻尼 */
const DRAG_MAX = 96
const DRAG_RUBBER = 3

export function PlaceCard({
  stop,
  dayIndex,
  color,
  place,
  events,
  onClose,
  onShowInList,
  onPrev,
  onNext,
  ref,
}: {
  stop: DayStop
  dayIndex: number
  /** 当天的动线色 —— 序号徽章要和地图上那枚 pin 是同一个颜色 */
  color: string
  place: Place
  /** 这一站对应的事件（已按 stop.eventIds 查好） */
  events: TripEvent[]
  onClose: () => void
  onShowInList: (eventId: string) => void
  /** 当天的上一 / 下一站；到头时不传，按钮置灰、滑动只弹回 */
  onPrev?: (() => void) | undefined
  onNext?: (() => void) | undefined
  /** 地图侧要量这张卡的实际高度来算居中偏移（高度随事件条数变） */
  ref?: React.Ref<HTMLDivElement>
}) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  /**
   * 手势的真值放 ref，state 只用来画。
   * touchend 若去读 state 里的 dx，拿到的是**本次渲染闭包**里的值——
   * 一串 touch 事件挤在同一个任务里时 React 还没重渲染，读到的永远是 0，
   * 滑动就永远不触发。判定不能挂在渲染时序上。
   */
  const dxRef = useRef(0)

  const setOffset = (v: number): void => {
    dxRef.current = v
    setDx(v)
  }

  const onTouchStart = (e: React.TouchEvent): void => {
    const t = e.touches[0]
    if (!t) return
    startRef.current = { x: t.clientX, y: t.clientY }
  }

  const onTouchMove = (e: React.TouchEvent): void => {
    const s = startRef.current
    const t = e.touches[0]
    if (!s || !t) return
    const mx = t.clientX - s.x
    const my = t.clientY - s.y
    // 竖向意图（想滚事件列表）就不抢：只有横向占优才认作换站手势
    if (Math.abs(mx) <= Math.abs(my)) return
    setDragging(true)
    // 那一侧没有邻站时加阻尼，让「到头了」变成手感上能察觉的事
    const canGo = mx < 0 ? onNext !== undefined : onPrev !== undefined
    const damped = canGo ? mx : mx / DRAG_RUBBER
    setOffset(Math.max(-DRAG_MAX, Math.min(DRAG_MAX, damped)))
  }

  const onTouchEnd = (): void => {
    if (dxRef.current <= -SWIPE_COMMIT) onNext?.()
    else if (dxRef.current >= SWIPE_COMMIT) onPrev?.()
    startRef.current = null
    setDragging(false)
    setOffset(0)
  }

  const arrow =
    'pointer-events-auto absolute top-1/2 hidden size-8 -translate-y-1/2 sm:flex ' +
    'items-center justify-center rounded-full border border-[var(--hairline)] bg-raised ' +
    'text-graphite shadow-[var(--shadow)] transition-colors enabled:hover:text-ink ' +
    'disabled:opacity-35'

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-x-2 bottom-2 z-20 sm:inset-x-auto sm:left-1/2
                 sm:w-[26rem] sm:-translate-x-1/2"
    >
      <button
        type="button"
        onClick={onPrev}
        disabled={!onPrev}
        aria-label="上一站"
        className={`${arrow} -left-11`}
      >
        <ChevronLeft size={17} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!onNext}
        aria-label="下一站"
        className={`${arrow} -right-11`}
      >
        <ChevronRight size={17} aria-hidden />
      </button>

      <div
        role="dialog"
        aria-label={stop.name}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: `translateX(${dx}px)` }}
        className={`pointer-events-auto touch-pan-y rounded-xl border border-[var(--hairline)]
                    bg-raised p-3.5 shadow-[var(--shadow)]
                    ${dragging ? '' : 'transition-transform duration-200'}`}
      >
        <div className="flex items-start gap-2.5">
          {/* 和地图上那枚 pin 同一套外观与颜色 —— 「卡片说的就是我刚点的那个点」 */}
          <span className="map-pin mt-0.5 shrink-0 cursor-default" style={{ background: color }}>
            {stop.seq}
          </span>
          <div className="min-w-0 flex-1">
            <div className="display text-[15px] leading-6 text-ink">{stop.name}</div>
            {stop.nameEn && stop.nameEn !== stop.name && (
              <div className="truncate text-[11.5px] text-graphite">{stop.nameEn}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-1 text-graphite transition-colors hover:text-ink"
          >
            <X size={15} aria-hidden />
          </button>
        </div>

        <div className="mt-1 text-[11.5px] text-graphite">
          Day {dayIndex} · 第 {stop.seq} 站
        </div>

        {events.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {events.map((e) => (
              <li key={e.id} className="flex items-baseline gap-2 text-[12.5px]">
                <span className="tnum shrink-0 text-graphite">{formatMinutes(e.startMin)}</span>
                <button
                  type="button"
                  onClick={() => onShowInList(e.id)}
                  className="min-w-0 truncate text-left text-ink underline-offset-2 hover:underline"
                >
                  {e.title}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-2.5 flex items-center gap-2">
          <MapLinkButton place={place} label="导航" />
          {events[0] && (
            <button
              type="button"
              onClick={() => onShowInList(events[0]!.id)}
              className="rounded-full border border-[var(--hairline)] px-2 py-[3px] text-[11px]
                         text-graphite transition-colors hover:border-ink/25 hover:text-ink"
            >
              在列表中查看
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
