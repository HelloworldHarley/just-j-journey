import { useCallback, useEffect, useState } from 'react'

/**
 * 用户收藏的事件。
 *
 * 收藏是**用户的意思表示**，不是作者/LLM 预先标的重点 —— 这正是它有用的原因：
 * 将来 Agent 改行程时读到这份清单，就知道哪些是你亲自认可、不能随便动的。
 * 如果它是作者写的，Agent 读回来的只是它自己上次的建议，等于没有信号。
 *
 * 现在存 localStorage；Phase 6 有后端后换成 TripRepository 的一个方法，
 * 接口形状（读一组 id / 切换一个 id）刻意保持一致，届时替换不动调用方。
 */
const key = (tripId: string) => `jjj:favorites:${tripId}`

function read(tripId: string): Set<string> {
  try {
    const raw = localStorage.getItem(key(tripId))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export interface Favorites {
  has(eventId: string): boolean
  toggle(eventId: string): void
  count: number
  /** 给将来的 Agent 用：一次拿到全部收藏 */
  all(): string[]
}

export function useFavorites(tripId: string): Favorites {
  const [ids, setIds] = useState<Set<string>>(() => read(tripId))

  useEffect(() => setIds(read(tripId)), [tripId])

  // 多标签页同时开着时保持一致
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key(tripId)) setIds(read(tripId))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [tripId])

  const toggle = useCallback(
    (eventId: string) => {
      setIds((prev) => {
        const next = new Set(prev)
        if (!next.delete(eventId)) next.add(eventId)
        try {
          localStorage.setItem(key(tripId), JSON.stringify([...next]))
        } catch {
          // 隐私模式下写不进去，不该因此崩掉界面
        }
        return next
      })
    },
    [tripId],
  )

  return {
    has: (id) => ids.has(id),
    toggle,
    count: ids.size,
    all: () => [...ids],
  }
}
