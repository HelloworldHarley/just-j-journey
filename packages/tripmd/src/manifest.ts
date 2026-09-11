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

/** `_` 前缀目录是仓库自带的示范 / 负向样本，不入册（CI 部署前也会把它们从 dist 删掉） */
export function buildManifest(entries: readonly ManifestEntry[]): Manifest {
  return {
    trips: entries
      .filter((e) => !e.id.startsWith('_'))
      .map((e) => ({ id: e.id, visibility: e.visibility })),
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
