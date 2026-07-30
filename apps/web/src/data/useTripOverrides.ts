import { useCallback, useEffect, useState } from 'react'

/**
 * 用户在前端改过的行程属性（目前只有标题）。
 *
 * 与收藏同一套模式：现在存 localStorage，Phase 6 有后端后换成
 * TripRepository 的一个方法。接口形状（读一个值 / 写一个值 / 清除）刻意保持一致，
 * 届时替换不动调用方。
 *
 * 覆盖值与导入的原始数据分开存 —— 重新跑 pnpm data:import 不会冲掉你改的名字。
 */
const KEY = 'jjj:overrides'

interface Overrides {
  [tripId: string]: { title?: string }
}

function readAll(): Overrides {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Overrides
  } catch {
    return {}
  }
}

function writeAll(next: Overrides): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // 隐私模式下写不进去，不该因此崩掉界面
  }
}

export function useTripTitle(
  tripId: string,
  fallback: string,
): { title: string; setTitle: (v: string) => void; isCustom: boolean } {
  const [custom, setCustom] = useState<string | undefined>(() => readAll()[tripId]?.title)

  useEffect(() => setCustom(readAll()[tripId]?.title), [tripId])

  const setTitle = useCallback(
    (v: string) => {
      const trimmed = v.trim()
      const all = readAll()
      // 改回原名等于取消覆盖，不留一条无意义的记录
      if (!trimmed || trimmed === fallback) {
        delete all[tripId]
        setCustom(undefined)
      } else {
        all[tripId] = { ...all[tripId], title: trimmed }
        setCustom(trimmed)
      }
      writeAll(all)
    },
    [tripId, fallback],
  )

  return { title: custom ?? fallback, setTitle, isCustom: custom !== undefined }
}
