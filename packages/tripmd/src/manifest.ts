import type { Visibility } from '@jjj/schema'

/**
 * manifest.json —— 首页需要知道有哪些行程，publish 需要知道哪些是 public。
 * data:check 生成，浏览器与 tools/publish.ts 消费，形状只在这里定义一次。
 */
export interface ManifestEntry {
  id: string
  visibility: Visibility
}

export interface Manifest {
  trips: ManifestEntry[]
}

/** `_` 前缀目录是仓库自带的 dev-only 样本（_example / _demo / _broken）：不入册，不进任何构建产物，公开版也不收 */
export function isFixtureId(id: string): boolean {
  return id.startsWith('_')
}

/**
 * 示范目录各自的用处 —— 上不上完整版 dev 首页、data:check 怎么判，只在这里定：
 *   _demo      全要素演示，改界面时拿它看效果 → 上 dev 首页
 *   _example   TripMD 最小示例，给文档用；直链照样能开
 *   _broken    故意写坏的负向样本 → data:check 要求它解析失败，诊断逐条锁在 regressions.test.ts
 */
const FIXTURE_ROLES: Readonly<Record<string, { devHome?: true; mustFail?: true }>> = {
  _demo: { devHome: true },
  _example: {},
  _broken: { mustFail: true },
}

/** 这个示范目录必须解析失败 —— 它通过了说明诊断能力退化 */
export function mustFailToParse(id: string): boolean {
  return FIXTURE_ROLES[id]?.mustFail === true
}

/** 完整版 dev 首页列哪些：入册的行程，加上要上首页的示范目录 */
export function devHomeEntries(entries: readonly ManifestEntry[]): ManifestEntry[] {
  return entries.filter((e) => !isFixtureId(e.id) || FIXTURE_ROLES[e.id]?.devHome === true)
}

/**
 * 示范行程：数据仓库里一份真行程抹除后的公开副本，工具仓库唯一的真实规模样本。不带 `_` ——
 * 它入册、随演示站部署。`pnpm showcase:refresh` 写它，roundtrip / patch 测试读它
 */
export const SHOWCASE_ID = 'showcase-seattle-2026-10'

/**
 * 合法的行程 id = 目录名：字母数字下划线连字符，可以 `_` 开头（dev fixture）；
 * 没有 `.` 和 `/`，所以拼成路径时 `..` 走不出数据目录。写路径与读路径共用这一条
 */
export function isTripId(id: string): boolean {
  return /^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(id)
}

export function buildManifest(entries: readonly ManifestEntry[]): Manifest {
  return {
    trips: entries.filter((e) => !isFixtureId(e.id)).map((e) => ({ id: e.id, visibility: e.visibility })),
  }
}

/** 公开版收的那些：入册且 public */
export function publicEntries(entries: readonly ManifestEntry[]): ManifestEntry[] {
  return buildManifest(entries).trips.filter((e) => e.visibility === 'public')
}

/**
 * 浏览器侧读 id。容忍旧形状（纯字符串数组）—— 浏览器缓存里可能还躺着上一版产物的 manifest；
 * 认不出的项跳过，绝不让首页因为一份 manifest 直接白屏。
 */
export function manifestIds(raw: unknown): string[] {
  const trips = (raw as { trips?: unknown } | null)?.trips
  if (!Array.isArray(trips)) return []
  return trips.flatMap((t): string[] => {
    if (typeof t === 'string') return [t]
    const id = (t as { id?: unknown } | null)?.id
    return typeof id === 'string' ? [id] : []
  })
}
