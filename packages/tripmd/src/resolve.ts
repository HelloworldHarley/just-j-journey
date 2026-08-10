import type { Day } from '@jjj/schema'

/**
 * `detail:` 引用的归属 —— 全仓唯一的一份「首次引用」扫描。
 *
 * 首次引用按**日期序**判定，不是书写序：若 Day 2 写在 Day 1 前面，
 * 往返一次后首卡不能换人 —— 语义幂等踩在这条规则上。
 * 它同时决定三件事，三处消费必须同一口径：
 *
 * - 解析器把长途明细灌进哪个事件（票面时间轴长在哪张卡上）
 * - 前端把住宿/租车的信息模块挂到哪张卡、哪些卡是该去重的简单提及
 * - 预算把长途的钱记到哪一天
 *
 * 曾经是三份各自的扫描（parse / derive / budget），漂移一处就是
 * 「时间轴挂 A 卡、钱记 B 天」。现在只有这一份。
 */
export interface DetailIndex {
  /** what → 首次引用它的 eventId */
  firstRef: Map<string, string>
  /** what → 首次引用所在日期 (ISO)。预算的「长途记哪天」从这里取 */
  firstRefDate: Map<string, string>
  /** 非首次引用的 eventId —— 住/行筛选视图里去重隐藏 */
  dup: Set<string>
}

/** days 必须已按日期排序 —— parse 在 days.sort 之后才调它，别的调用方拿到的 Trip 天生有序 */
export function detailIndex(days: readonly Day[]): DetailIndex {
  const firstRef = new Map<string, string>()
  const firstRefDate = new Map<string, string>()
  const dup = new Set<string>()

  for (const day of days) {
    for (const ev of day.events) {
      if (!ev.detailRef) continue
      if (firstRef.has(ev.detailRef)) {
        dup.add(ev.id)
        continue
      }
      firstRef.set(ev.detailRef, ev.id)
      firstRefDate.set(ev.detailRef, day.date)
    }
  }
  return { firstRef, firstRefDate, dup }
}
