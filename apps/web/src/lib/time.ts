/** 目的地当地的「今天」。用行程时区而非浏览器时区 —— 人在西雅图时看的是西雅图的今天。 */
export function todayIso(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

export function daysUntil(iso: string, timeZone: string): number {
  const from = Date.parse(`${todayIso(timeZone)}T00:00:00Z`)
  const to = Date.parse(`${iso}T00:00:00Z`)
  return Math.round((to - from) / 86_400_000)
}

/** "2026-10-01" → "10.01" */
export function shortDate(iso: string): string {
  return `${iso.slice(5, 7)}.${iso.slice(8, 10)}`
}
