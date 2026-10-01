import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { manifestIds, parse, parseSpace, type ParseResult, type SpaceParseResult } from '@jjj/tripmd'

/**
 * 数据目录 —— 代码与数据的分界线，**以文件形态**看它的唯一一处。
 *
 * 目录长这样（`docs/PUBLISHING.md`）：
 *   <root>/space.md             名片（+ 头像、二维码，路径相对它）
 *   <root>/manifest.json        data:check 生成
 *   <root>/<id>/plan.md         行程；<id> 就是目录名
 *   <root>/<id>/geometry.json   enrich 的路网缓存（可选）
 *   <root>/<id>/calendar.ics    data:check 生成（可选）
 *
 * 谁用：tools/ 下的 CLI、build:public 的暂存、apps/web 的 dev 服务器插件。三边原先各抄一份
 * 「哪些目录算行程、plan.md 在哪、边界怎么查」，现在只有这一份。浏览器代码不 import 它（有 node:fs，
 * apps/web/src/boundary.test.ts 守着这条）。`@jjj/tripmd` 负责文本 ↔ Trip；这里只负责文件 ↔ 文本。
 */

/**
 * 缺省数据目录：工具仓库自带的 apps/web/public/data（示范数据 + 开发期的行程）。
 * 从本文件位置往上数三层 —— 依赖 pnpm 的 workspace 链接是**符号链接**、Node 解析到真实路径这一事实；
 * 换成 hoisted / npm 那种拷贝式布局，这里会指到 node_modules 里面去。仓库钉了 pnpm，不会发生
 */
export const DEFAULT_DATA_DIR = fileURLToPath(new URL('../../../apps/web/public/data', import.meta.url))

/** 当前数据目录：JJJ_DATA_DIR 指到别处（数据仓库的 trips/），否则缺省 */
export function dataDir(): string {
  const env = process.env['JJJ_DATA_DIR']
  return env ? resolve(env) : DEFAULT_DATA_DIR
}

/**
 * 行程目录列表：非隐藏的子目录，按名排序。`_` 前缀的示范目录也在 —— 入不入册由 buildManifest 决定。
 * 目录不存在直接抛可读的错（JJJ_DATA_DIR 指错是最常见的原因），别让调用方拿到 ENOENT 的原始堆栈；
 * 悬空的符号链接当不存在，指到数据目录外面的符号链接也当不存在 —— 列出来的每一个都能安全地读和写
 */
export function tripDirs(root: string): string[] {
  if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`数据目录不存在或不是目录：${root}（JJJ_DATA_DIR 指错了？）`)
  }
  return readdirSync(root)
    .filter((d) => !d.startsWith('.') && statSync(join(root, d), { throwIfNoEntry: false })?.isDirectory() && insideDir(root, d))
    .sort()
}

export interface TripFile extends ParseResult {
  /** 诊断里指名用：`<id>/plan.md` */
  label: string
}

/**
 * 一份行程的 plan.md 在磁盘上的真实位置：存在、是普通文件、真实路径落在数据目录里，否则 null。
 * 读（readTrip）和写（dev 服务器的开关端点）都从这里拿路径 —— id 来自 URL 时，这就是它的边界检查
 */
export function planFile(root: string, id: string): string | null {
  const file = insideDir(root, join(id, 'plan.md'))
  return file && statSync(file, { throwIfNoEntry: false })?.isFile() ? file : null
}

/** 读并解析一份行程；plan.md 不存在、不是普通文件、或实际落在数据目录外面，返回 null —— 是不是错误由调用方定：data:check 算错，公开版 404 */
export function readTrip(root: string, id: string): TripFile | null {
  const file = planFile(root, id)
  if (!file) return null
  return { ...parse(readFileSync(file, 'utf8')), label: `${id}/plan.md` }
}

/**
 * 一份行程旁边的路网缓存。三种结果，调用方各取所需：
 *   undefined —— 没有这个文件（还没跑过 enrich，常态）
 *   null      —— 有文件但不是 JSON（mergeGeometry / filterGeometry 会把它当「整份不可用」）
 *   其余      —— 解析出来的 JSON，认不认得交给 @jjj/tripmd 的 geometry 规则
 */
export function readGeometry(root: string, id: string): unknown {
  const file = insideDir(root, join(id, 'geometry.json'))
  if (!file || !statSync(file, { throwIfNoEntry: false })?.isFile()) return undefined
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/** 数据目录根下的 space.md，解析后给出；没有这个文件返回 null（没写名片是常态，不是错） */
export function readSpace(root: string): SpaceParseResult | null {
  const file = join(root, 'space.md')
  if (!statSync(file, { throwIfNoEntry: false })?.isFile()) return null
  return parseSpace(readFileSync(file, 'utf8'))
}

/** manifest.json 里的 id（容忍旧形状、坏 JSON、缺文件 —— 一律空数组，浏览器那头同一口径） */
export function readManifestIds(root: string): string[] {
  const file = join(root, 'manifest.json')
  if (!existsSync(file)) return []
  try {
    return manifestIds(JSON.parse(readFileSync(file, 'utf8')))
  } catch {
    return []
  }
}

/**
 * 把 URL 里的相对路径落到目录里的绝对路径；落在目录之外返回 null。
 * dev 服务器开着 host: true，端口转发出去就不是只有自己在访问 —— `..` 不能指哪读哪。
 * 存在的路径按**真实路径**比：目录里放一个指向外面的符号链接，字面上在目录里、实际上不在。
 * 不存在的路径按字面比（让调用方去 404），根目录本身按真实路径解析。
 */
export function insideDir(root: string, rel: string): string | null {
  const realRoot = realpathSync(root)
  const file = resolve(realRoot, rel)
  const real = statSync(file, { throwIfNoEntry: false }) ? realpathSync(file) : file
  return real === realRoot || real.startsWith(realRoot + sep) ? real : null
}

/** 数据目录里会出现的文件类型 —— dev 服务器直出时用 */
export const DATA_MIME: Record<string, string> = {
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json',
  '.ics': 'text/calendar',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}
