import { useEffect, useRef, useState } from 'react'

/**
 * 滚动到哪一节了。
 *
 * 用 IntersectionObserver 而非 scroll 事件 —— 后者每帧都要读
 * getBoundingClientRect，会强制同步布局，长页面上很卡。
 *
 * rootMargin 把判定区压成「顶栏下方到屏幕中部」这一条：
 * 问的是「哪一节正占据视口上半部分」，而不是「哪一节可见」——
 * 后者在长页面上会同时命中好几节。
 */
export function useScrollSpy(count: number): {
  active: number
  register: (i: number) => (el: HTMLElement | null) => void
  jumpTo: (i: number) => void
} {
  const refs = useRef<(HTMLElement | null)[]>([])
  const [active, setActive] = useState(0)

  useEffect(() => {
    const els = refs.current.filter(Boolean) as HTMLElement[]
    if (els.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        // 可能同时有多节命中，取最靠上的那一节
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => els.indexOf(e.target as HTMLElement))
          .filter((i) => i >= 0)
        if (visible.length > 0) setActive(Math.min(...visible))
      },
      { rootMargin: '-96px 0px -55% 0px', threshold: 0 },
    )

    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [count])

  return {
    active,
    register: (i) => (el) => {
      refs.current[i] = el
    },
    jumpTo: (i) => refs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
  }
}
