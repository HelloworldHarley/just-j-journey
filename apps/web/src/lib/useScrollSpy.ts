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
/**
 * 跳转时目标分区顶端停在的位置（各分区的 scroll-margin-top）。
 *
 * **判定区上沿必须严格低于它**，否则点某天跳过去时，上一天的最后几个像素
 * 仍压在判定区里，按「取最靠上」的规则会把高亮判回上一天。
 * 两个值必须一起改，所以放在同一处导出。
 */
export const SPY_SCROLL_MARGIN = 104

/** 判定区上沿，留 8px 余量避开跳转落点 */
const BAND_TOP = SPY_SCROLL_MARGIN + 8

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

    /**
     * 当前命中判定区的所有节。**必须自己攒着** —— 回调的 entries 只包含
     * 「相交状态发生了变化」的那几节，不是「当前所有相交的节」。
     * 直接对 entries 取 min 会在下滚时提前一天切换：下一天的顶刚探进判定区底部，
     * 批次里只有它一个，min 就成了它，而这时上一天还占着判定区的大半。
     */
    const hits = new Set<number>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = els.indexOf(e.target as HTMLElement)
          if (i < 0) continue
          if (e.isIntersecting) hits.add(i)
          else hits.delete(i)
        }
        // 同时命中多节时取最靠上的那一节；一节都没有（滚过了末尾）就保持原样
        if (hits.size > 0) setActive(Math.min(...hits))
      },
      { rootMargin: `-${BAND_TOP}px 0px -55% 0px`, threshold: 0 },
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
