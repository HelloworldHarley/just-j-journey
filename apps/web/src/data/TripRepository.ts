import type { Space, Trip, TripSummary, Visibility } from '@jjj/schema'

/**
 * 数据访问的唯一切换点。
 *
 * 现在：MarkdownTripRepository 直接 fetch plan.md 在浏览器里解析（单工件，无 JSON 中间层）
 * 将来：HttpTripRepository 读 /api/*（Agent 上线后行程需要可写）
 *
 * 视图层永远只认这个接口，不知道数据从哪来。换实现 = 改 main.tsx 一行。
 */
export interface TripRepository {
  listTrips(): Promise<TripSummary[]>
  getTrip(id: string): Promise<Trip>
  /** 个人空间名片；数据目录里没有 space.md 时为 null（首页退回工具默认头部） */
  getSpace(): Promise<Space | null>
  /**
   * 名片引用的文件（头像、打赏二维码）的地址。路径是相对数据目录写的，只有数据源知道数据目录在哪 ——
   * 组件自己拼 `data/` 前缀等于绕开这道接缝，换成 HTTP 数据源那天两张图就裂了。绝对 URL 原样放行
   */
  assetUrl(rel: string): string
  /**
   * 首页开关：改一份行程的 visibility —— 只动 plan.md 的 frontmatter 一行，
   * 浏览器到数据源的第一条写路径，也是最窄的一条。没有写路径的实现（线上静态托管）
   * 不提供这个方法，视图据此决定画开关还是静态角标。
   */
  setVisibility?(id: string, visibility: Visibility): Promise<void>
}

export class TripNotFoundError extends Error {
  constructor(readonly id: string) {
    super(`找不到行程「${id}」`)
    this.name = 'TripNotFoundError'
  }
}
