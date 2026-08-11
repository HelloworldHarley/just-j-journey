import { useSyncExternalStore } from 'react'

/**
 * 订阅一条媒体查询。之前有组件在 render 里直接读 `window.innerWidth` ——
 * 不纯、不随窗口变化更新，而且和 CSS 断点是两套口径。
 * 这里走 matchMedia：查询串与 CSS 同一种语言，变化自动重渲染。
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}

/** Tailwind 的 sm 断点以下 —— 与全站 `sm:` 类同一条线 */
export function useIsNarrow(): boolean {
  return useMediaQuery('(max-width: 639px)')
}
