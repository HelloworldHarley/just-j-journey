import { formatDurationCompact } from '@jjj/tripmd'

/**
 * 展示层的格式化，全站唯一去处。
 *
 * 建这个文件是因为「写了共享函数但没人知道、各自重写」在这个仓库**已经发生过一次**：
 * `lib/time.ts` 里曾有个 `shortDate` 导出着却零调用，同时「MM/DD」在别处被重写了 6 遍。
 * 加视图前先收敛，免得日历变成第 7 份。
 *
 * 紧凑时长（"11h55m"）住在 `@jjj/tripmd` 的 `values.ts` —— 它是 `parseDurationMin`
 * 的逆运算，而且作者格式的序列化也要用，不能只放在前端。这里转出来，
 * 让前端只需要认识一个格式化模块。
 */
export { formatDurationCompact }

/** "2026-10-01" → "10/01" */
export function shortDate(iso: string): string {
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)}`
}

/** 分钟 → 中文时长 "2 小时 50 分"。用在正文里，比 "2h50m" 好读 */
export function fmtDurationZh(min: number): string {
  if (min < 60) return `${min} 分`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} 小时` : `${h} 小时 ${m} 分`
}

const SIGN: Record<string, string> = { USD: '$', CNY: '¥', JPY: '¥', EUR: '€', GBP: '£', KRW: '₩' }

export function fmtMoney(amount: number, currency?: string): string {
  const sign = currency ? (SIGN[currency] ?? `${currency} `) : ''
  return `${sign}${amount.toLocaleString()}`
}
