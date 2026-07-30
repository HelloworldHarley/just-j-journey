import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import './styles/index.css'
import { RepositoryContext } from './data/hooks.ts'
import { MarkdownTripRepository } from './data/MarkdownTripRepository.ts'
import { HomePage } from './features/trip-list/HomePage.tsx'
import { BudgetRoute, InfoRoute, ListRoute, TripPage } from './app/TripPage.tsx'
import { Problem } from './components/States.tsx'
import { applyPalette } from './lib/palette.ts'

// 分组配色注入 :root。将来首页的设置面板改这里的 localStorage 即可换色，组件不动。
applyPalette()

// 数据源在这里注入，全应用只有这一处知道数据从哪来。
// 单工件：浏览器直接吃 plan.md。Phase 6 接后端时换 HttpTripRepository，视图零改动。
const repository = new MarkdownTripRepository()

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RepositoryContext.Provider value={repository}>
        {/* HashRouter：静态托管零配置，不需要服务端 rewrite */}
        <HashRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            {/* 嵌套路由（非 splat + 嵌套 Routes）—— 让 NavLink 的相对路径基准固定在 /trip/:id */}
            <Route path="/trip/:id" element={<TripPage />}>
              <Route index element={<Navigate to="list" replace />} />
              <Route path="list" element={<ListRoute />} />
              <Route path="info" element={<InfoRoute />} />
              <Route path="budget" element={<BudgetRoute />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
            <Route
              path="*"
              element={<Problem title="页面不存在" detail="回到首页看看有哪些行程。" />}
            />
          </Routes>
        </HashRouter>
      </RepositoryContext.Provider>
    </QueryClientProvider>
  </StrictMode>,
)
