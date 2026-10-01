import type { Space, Trip, TripSummary, Visibility } from '@jjj/schema'
import { formatDiagnostics, isAbsoluteUrl, manifestIds, mergeGeometry, parse, parseSpace, summarize } from '@jjj/tripmd'
import { TripNotFoundError, type TripRepository } from './TripRepository.ts'
import { VISIBILITY_ENDPOINT, type VisibilityRequest } from './visibility-api.ts'

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
    // 有哪些行程只有清单知道：dev 服务器现算（示范目录也在），构建产物里是 data:check 写的文件。
    // 浏览器不认识任何一个具体 id —— 示范数据是数据目录的事
    const ids = manifestIds(await res.json())

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
    await this.mergeGeometry(id, trip)
    this.parsed.set(id, trip)
    return trip
  }

  /**
   * 首页「公开 / 私有」开关 —— 浏览器到 plan.md 的第一条写路径，范围极小：只改 frontmatter 一行。
   * 只有 dev 服务器有这个端点（vite 插件 jjj:data，纯文本改一行再 parse 验收；契约在 visibility-api.ts）；
   * 线上是静态托管，没有写路径，这个方法就不存在，首页也不画开关。
   * 写成功后丢掉这份的解析缓存，下一次 getTrip 重新 fetch。
   */
  readonly setVisibility = import.meta.env.DEV
    ? async (id: string, visibility: Visibility): Promise<void> => {
        const body: VisibilityRequest = { id, visibility }
        const res = await fetch(`${import.meta.env.BASE_URL}${VISIBILITY_ENDPOINT}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const msg = await res.text().catch(() => '')
          throw new Error(msg || `改不了（HTTP ${res.status}）`)
        }
        this.parsed.delete(id)
      }
    : undefined

  /** 绝对 URL 原样放行 —— 想直接指 GitHub 头像也行，但公开站上每个访客都会去请求那个地址；本地文件更稳 */
  assetUrl(rel: string): string {
    return isAbsoluteUrl(rel) ? rel : `${this.base}/${rel}`
  }

  async getSpace(): Promise<Space | null> {
    const res = await fetch(`${this.base}/space.md`)
    if (res.status === 404) return null // 没写 space.md 是常态，不是错
    if (!res.ok) throw new Error(`space.md 加载失败（HTTP ${res.status}）`)
    const { space, diagnostics } = parseSpace(await res.text())
    // 写坏了要看得见：与 plan.md 同一待遇，带行号的诊断直接上屏
    if (!space) throw new Error(formatDiagnostics('space.md', diagnostics))
    return space
  }

  /**
   * 把预计算的真实路网并进 `leg.geometry`。
   *
   * plan.md 仍是唯一真相，geometry.json 只是**派生缓存** —— 所以这里的每一条
   * 失败路径都只意味着「这段没有真路」，绝不让行程加载失败：文件不存在、不是
   * JSON、版本不认识、端点漂了、poly 解不开，一律跳过，地图照常画直连虚线。
   * 「宁可不画，也不画错」。判断规则本身在 `@jjj/tripmd` 的 `mergeGeometry`，
   * 与 enrich 工具和 data:check 共用一份。
   */
  private async mergeGeometry(id: string, trip: Trip): Promise<void> {
    let raw: unknown
    try {
      const res = await fetch(`${this.base}/${encodeURIComponent(id)}/geometry.json`)
      if (!res.ok) return // 404 是常态：还没跑过 enrich 的行程就是没有
      raw = await res.json()
    } catch {
      return // 非 JSON / 网络中断 —— 派生数据不值得让页面出错
    }

    const report = mergeGeometry(trip, raw)
    if (import.meta.env.DEV && report && report.stale + report.broken > 0) {
      console.warn(
        `[jjj] ${id}：geometry.json 有 ${report.stale + report.broken} 条与当前 plan.md 对不上，` +
          `已回退直线（${report.used}/${report.needed} 条生效）。跑 pnpm enrich ${id} 重算`,
      )
    }
  }
}
