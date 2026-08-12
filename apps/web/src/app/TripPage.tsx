import { Suspense, lazy } from 'react'
import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import type { Trip } from '@jjj/schema'
import { useTrip } from '../data/hooks.ts'
import { useTripTitle } from '../data/useTripOverrides.ts'
import { Loading, Problem } from '../components/States.tsx'

// 五个视图统一按路由分包 —— 首页/壳不背任何视图的依赖
// （react-markdown 随列表/资料/预算走，maplibre-gl 随地图走）。
// 地图不是「那个特殊的重路由」，只是五个平等 chunk 之一。
const ListView = lazy(() => import('../features/itinerary/ListView.tsx'))
const CalendarView = lazy(() => import('../features/calendar/CalendarView.tsx'))
const InfoView = lazy(() => import('../features/reference/InfoView.tsx'))
const BudgetView = lazy(() => import('../features/budget/BudgetView.tsx'))
const MapView = lazy(() => import('../features/map/MapView.tsx'))
import { SEG_PILL, segItem } from '../components/Segmented.tsx'

/** 五视图到齐：列表 / 日历 / 地图 / 资料 / 预算。 */
const TABS = [
  { to: 'list', label: '列表' },
  { to: 'calendar', label: '日历' },
  { to: 'map', label: '地图' },
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
          {/*
            五个页签占满 287px，390px 手机上留给标题只剩 10px —— 半个字比不显示更糟。
            sm(640px) 正是标题能完整展开的宽度，以下藏起来把宽度整个让给页签；
            行程名在个人空间页刚点过，不至于丢失上下文。
          */}
          <h1 className="display hidden min-w-0 flex-1 truncate text-[17px] tracking-[-0.01em] text-ink sm:block">
            {title}
          </h1>
          <nav className={`ml-auto ${SEG_PILL}`}>
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) => `rounded-full px-3.5 py-1 text-[13.5px] ${segItem(isActive)}`}
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
      <Suspense fallback={<Loading />}>
        <Outlet context={trip} />
      </Suspense>
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

export function MapRoute() {
  return <MapView trip={useTripContext()} />
}
