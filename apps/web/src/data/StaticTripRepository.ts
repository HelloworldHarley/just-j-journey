import { TripSchema, TripSummarySchema, type Trip, type TripSummary } from '@jjj/schema'
import { TripNotFoundError, type TripRepository } from './TripRepository.ts'

const IndexShape = { trips: TripSummarySchema.array() }

/**
 * 读 tools/import.ts 生成的静态 JSON。
 *
 * 仍然跑一遍 zod —— 数据是构建期产物，但校验成本近乎为零，
 * 而「schema 改了忘了重新导入」是个真实且难查的故障。
 */
export class StaticTripRepository implements TripRepository {
  private readonly cache = new Map<string, Trip>()

  constructor(private readonly base = `${import.meta.env.BASE_URL}data`) {}

  async listTrips(): Promise<TripSummary[]> {
    const res = await fetch(`${this.base}/index.json`)
    if (!res.ok) throw new Error(`行程索引加载失败（HTTP ${res.status}）`)
    const raw: unknown = await res.json()
    const parsed = IndexShape.trips.safeParse((raw as { trips?: unknown })?.trips ?? [])
    if (!parsed.success) {
      throw new Error(`行程索引格式不对，请重新运行 pnpm data:import`)
    }
    return parsed.data
  }

  async getTrip(id: string): Promise<Trip> {
    const hit = this.cache.get(id)
    if (hit) return hit

    const res = await fetch(`${this.base}/${encodeURIComponent(id)}.json`)
    if (res.status === 404) throw new TripNotFoundError(id)
    if (!res.ok) throw new Error(`行程「${id}」加载失败（HTTP ${res.status}）`)

    const parsed = TripSchema.safeParse(await res.json())
    if (!parsed.success) {
      throw new Error(
        `行程「${id}」的数据与当前 schema 不匹配，请重新运行 pnpm data:import\n` +
          parsed.error.issues
            .slice(0, 3)
            .map((i) => `  ${i.path.join('.')}: ${i.message}`)
            .join('\n'),
      )
    }
    this.cache.set(id, parsed.data)
    return parsed.data
  }
}
