import type { Trip, TripSummary } from '@trip-atlas/schema'

/**
 * 数据访问的唯一切换点。
 *
 * 现在：StaticTripRepository 读 /data/*.json
 * 将来：HttpTripRepository 读 /api/*（Agent 上线后行程需要可写）
 *
 * 视图层永远只认这个接口，不知道数据从哪来。换实现 = 改 main.tsx 一行。
 */
export interface TripRepository {
  listTrips(): Promise<TripSummary[]>
  getTrip(id: string): Promise<Trip>
  /** Phase 6 才有 */
  saveTrip?(trip: Trip): Promise<void>
}

export class TripNotFoundError extends Error {
  constructor(readonly id: string) {
    super(`找不到行程「${id}」`)
    this.name = 'TripNotFoundError'
  }
}
