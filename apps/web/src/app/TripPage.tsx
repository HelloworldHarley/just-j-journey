import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import type { Trip } from '@jjj/schema'
import { useTrip } from '../data/hooks.ts'
import { useTripTitle } from '../data/useTripOverrides.ts'
import { ListView } from '../features/itinerary/ListView.tsx'
import { CalendarView } from '../features/calendar/CalendarView.tsx'
import { InfoView } from '../features/reference/InfoView.tsx'
import { BudgetView } from '../features/budget/BudgetView.tsx'
import { Loading, Problem } from '../components/States.tsx'

/**
 * 现有视图：列表 / 日历 / 资料 / 预算。
 * 地图做好之前不放灰掉的占位 —— 点不动的 tab 比没有更让人困惑。
 */
const TABS = [
  { to: 'list', label: '列表' },
  { to: 'calendar', label: '日历' },
  { to: 'info', label: '资料' },
  { to: 'budget', label: '预算' },
]

export function TripPage() {
  const { id } = useParams<{ id: string }>()
  const { data: trip, isPending, error } = useTrip(id)
  const { title } = useTripTitle(id ?? '', trip?.title ?? '')

  if (isPending) return <Loading />
  if (error) return <Problem title="行程加载失败" detail={String(error)} />

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[var(--hairline)] bg-paper/92 backdrop-blur-sm">
        <div className="mx-auto flex h-[var(--nav-h)] max-w-3xl items-center gap-3 px-4">
          <Link
            to="/"
            className="-ml-1 shrink-0 rounded p-1 text-graphite transition-colors hover:text-ink"
            aria-label="返回个人空间"
          >
            <ChevronLeft size={18} />
          </Link>
          <h1 className="display min-w-0 flex-1 truncate text-[17px] tracking-[-0.01em] text-ink">
            {title}
          </h1>
          <nav className="flex shrink-0 gap-0.5 rounded-full bg-sunken p-0.5">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  `rounded-full px-3.5 py-1 text-[13.5px] transition-colors ${
                    isActive
                      ? 'bg-raised font-medium text-ink shadow-sm'
                      : 'text-graphite hover:text-ink'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/*
        用 Outlet 而非嵌套 <Routes>。
        嵌套 Routes 要求父路由是 splat（/trip/:id/*），而相对链接会按**当前完整匹配路径**
        解析 —— 在 /trip/x/list 上点 to="list" 会变成 /trip/x/list/list，可以无限叠加。
        真正的嵌套路由把基准固定在 /trip/:id，相对路径才稳。
      */}
      <Outlet context={trip} />
    </>
  )
}

/** 子路由从 Outlet 拿数据，视图组件本身保持纯 props、可独立测试 */
function useTripContext(): Trip {
  return useOutletContext<Trip>()
}

export function ListRoute() {
  return <ListView trip={useTripContext()} />
}

export function CalendarRoute() {
  return <CalendarView trip={useTripContext()} />
}

export function InfoRoute() {
  return <InfoView trip={useTripContext()} />
}

export function BudgetRoute() {
  return <BudgetView trip={useTripContext()} />
}
