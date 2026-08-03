import type { Trip, TripSummary } from '@jjj/schema'
import { formatDiagnostics, parse, summarize } from '@jjj/tripmd'
import { TripNotFoundError, type TripRepository } from './TripRepository.ts'

/**
 * 单工件数据源：浏览器直接 fetch plan.md，现场解析。
 *
 * 没有 trip.json 这个中间层 —— 页面读的就是真相文件本身，
 * 「改了 md 忘了重新导入」这一类失效在结构上不存在。
 * 解析开销 ~20ms/份，远低于感知阈值；错误诊断直接上屏（带行号），
 * 编辑 plan.md → 刷新 → 看到哪行写错，比终端循环还快。
 */
export class MarkdownTripRepository implements TripRepository {
  private readonly parsed = new Map<string, Trip>()

  constructor(private readonly base = `${import.meta.env.BASE_URL}data`) {}

  async listTrips(): Promise<TripSummary[]> {
    const res = await fetch(`${this.base}/manifest.json`)
    if (!res.ok) throw new Error(`行程清单加载失败（HTTP ${res.status}）— 运行 pnpm data:check 生成`)
    const ids: string[] = ((await res.json()) as { trips?: string[] }).trips ?? []

    // 全要素演示行程只在本地开发时出现：`_` 前缀不入 manifest，
    // CI 部署前还会把 _* 目录从产物里删掉 —— 线上连直链都打不开
    if (import.meta.env.DEV) ids.push('_demo')

    // 一份坏文件不该拖垮整个首页：坏的跳过并在控制台报出，其余照常
    const settled = await Promise.allSettled(ids.map((id) => this.getTrip(id)))
    const out: TripSummary[] = []
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') out.push(summarize(r.value))
      else console.error(`[jjj] 行程 ${ids[i]} 解析失败：`, r.reason)
    })
    return out.sort((a, b) => b.dates.start.localeCompare(a.dates.start))
  }

  async getTrip(id: string): Promise<Trip> {
    const hit = this.parsed.get(id)
    if (hit) return hit

    const res = await fetch(`${this.base}/${encodeURIComponent(id)}/plan.md`)
    if (res.status === 404) throw new TripNotFoundError(id)
    if (!res.ok) throw new Error(`行程「${id}」加载失败（HTTP ${res.status}）`)

    const { trip, diagnostics } = parse(await res.text())
    if (!trip) {
      // 带行号的诊断直接作为错误正文上屏（Problem 组件按 pre-wrap 渲染）
      throw new Error(formatDiagnostics(`${id}/plan.md`, diagnostics))
    }
    const warnings = diagnostics.filter((d) => d.severity === 'warning')
    if (warnings.length > 0) {
      console.warn(`[jjj] ${id} 有 ${warnings.length} 条警告：\n` + formatDiagnostics(`${id}/plan.md`, warnings))
    }
    this.parsed.set(id, trip)
    return trip
  }
}
