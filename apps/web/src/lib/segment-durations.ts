import type { Transport } from '@jjj/schema'

/**
 * 票面时间轴上每个**行进段**的显示时长 —— 分配算法，组件只拿结果画宽度。
 *
 * 中转前的段可由作者用 `leg` 提供（跨时区没法从两端时刻算出来），
 * 没提供的段按「全程 − Σ停留 − Σ已填段」均分；末段收余数，
 * 保证各段与停留加起来**恒等于全程** —— 差一分钟都会让轴上的比例撒谎。
 *
 * 均分只在全部 `wait` 已知时进行：缺任何一个停留时长，
 * 「剩余行进时间」就无从谈起，未填的段保持 null（UI 画等宽段）。
 */
export function segFlyDurations(t: Transport): (number | null)[] {
  const perSeg: (number | null)[] = [...t.stops.map((s) => s.legMin), null]
  if (t.durationMin === null || t.stops.some((s) => s.waitMin === null)) return perSeg

  const totalFly = t.durationMin - t.stops.reduce((a, s) => a + (s.waitMin ?? 0), 0)
  const authoredSum = perSeg.reduce<number>((a, m) => a + (m ?? 0), 0)
  const unknown = perSeg.flatMap((m, i) => (m === null ? [i] : []))
  const remaining = totalFly - authoredSum
  if (unknown.length === 0 || remaining <= 0) return perSeg

  const each = Math.floor(remaining / unknown.length)
  unknown.forEach((idx, k) => {
    perSeg[idx] = k === unknown.length - 1 ? remaining - each * (unknown.length - 1) : each
  })
  return perSeg
}
