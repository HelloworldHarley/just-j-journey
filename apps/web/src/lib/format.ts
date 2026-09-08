import { formatDurationCompact, formatMinutes } from '@jjj/tripmd'

/**
 * 展示层的格式化，全站唯一去处。
 *
 * 建这个文件是因为「写了共享函数但没人知道、各自重写」在这个仓库**已经发生过一次**：
 * `lib/time.ts` 里曾有个 `shortDate` 导出着却零调用，同时「MM/DD」在别处被重写了 6 遍。
 * 加视图前先收敛，免得日历变成第 7 份。
 *
 * 紧凑时长（"11h55m"）与钟点（"18:25"）住在 `@jjj/tripmd` 的 `values.ts` ——
 * 它们是 `parseDurationMin` / `parseClock` 的逆运算，.ics 导出也要用，
 * 不能只放在前端。这里转出来，让前端只需要认识一个格式化模块。
 */
export { formatDurationCompact, formatMinutes }

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

/** 预算金额一律四舍五入到个位 —— 页面上的钱是决策信息，不是账单，小数只添噪声 */
export function fmtMoney(amount: number, currency?: string): string {
  const sign = currency ? (SIGN[currency] ?? `${currency} `) : ''
  return `${sign}${Math.round(amount).toLocaleString()}`
}

/**
 * 自由文本里的金额同样取整："$713.33" → "$713"，"往返 $226.80" → "往返 $227"。
 * 给票面 price、cost 原文这类没抽成数字的字段用 —— 与 fmtMoney 一个口径。
 * 只碰「数字.数字」，时刻（16:00）、时长（2h50m）、日期（9/26）都没有小数点，不受影响。
 */
export function roundMoneyText(raw: string): string {
  return raw.replace(/(\d[\d,]*)\.(\d+)/g, (_m, int: string, frac: string) =>
    Math.round(Number(`${int.replace(/,/g, '')}.${frac}`)).toLocaleString(),
  )
}
