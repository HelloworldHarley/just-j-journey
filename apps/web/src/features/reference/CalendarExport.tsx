import { useState } from 'react'
import { CalendarPlus, Check, Copy, Download } from 'lucide-react'
import type { Trip } from '@jjj/schema'
import { toIcs } from '@jjj/tripmd'
import { segChip } from '../../components/Segmented.tsx'
import { calendarLinks } from '../../lib/calendar-link.ts'

/**
 * 把行程装进日历 App 的三个入口，一行 chip：
 *
 * - **订阅**（webcal 链接）：Apple 日历点开即订。计划改了、推上线之后，
 *   日历在下一次轮询时自动跟上 —— 这是「计划变动日历跟着变」的那条路；
 * - **复制订阅链接**（https 地址）：Google 日历不认 webcal 点击，
 *   要把地址粘进「通过网址添加」—— 给它的；
 * - **下载 .ics**：浏览器里现场 `toIcs(trip)` 生成快照。一次性导入用，
 *   **不会**跟着更新 —— 文案里说清，免得当成订阅。
 *
 * 订阅地址指向 `data/<id>/calendar.ics`（`data:check` 生成、随 dist 发布的
 * 派生文件）；下载则完全在浏览器里生成，离线也能用。两边同一份 `toIcs`。
 */
export function CalendarExport({ trip }: { trip: Trip }) {
  const [copied, setCopied] = useState(false)
  const links = calendarLinks(location.origin, import.meta.env.BASE_URL, trip.id)

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(links.ics)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 剪贴板被策略拦下（非安全上下文等）：退化为选中地址交给用户手动复制
      window.prompt('复制订阅链接：', links.ics)
    }
  }

  const download = (): void => {
    const url = URL.createObjectURL(new Blob([toIcs(trip)], { type: 'text/calendar' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${trip.id}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  const chip = `flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-[13px] ${segChip(false)}`

  return (
    <section aria-label="日历导出" className="mb-6 border-b border-[var(--hairline)] pb-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <a className={chip} href={links.webcal}>
          <CalendarPlus size={14} aria-hidden />
          订阅日历
        </a>
        <button type="button" className={chip} onClick={copy} aria-live="polite">
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copied ? '已复制' : '复制订阅链接'}
        </button>
        <button type="button" className={chip} onClick={download}>
          <Download size={14} aria-hidden />
          下载 .ics
        </button>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-graphite">
        订阅后计划变动会自动同步（日历 App 每隔数小时拉取一次）；Google 日历请在「通过网址添加」里粘贴复制的链接。下载的 .ics 是当前快照，不会跟着更新。
      </p>
    </section>
  )
}
