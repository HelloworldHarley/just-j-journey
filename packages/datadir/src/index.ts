import { copyFileSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  GEOMETRY_FILE,
  MANIFEST_FILE,
  PLAN_FILE,
  SPACE_FILE,
  buildManifest,
  isFixtureId,
  isTripId,
  manifestIds,
  parse,
  parseSpace,
  planLabel,
  type Manifest,
  type ManifestEntry,
  type ParseResult,
  type SpaceParseResult,
} from '@jjj/tripmd'
import { DATA_DIR_ENV, envValue } from './env.ts'

export * from './env.ts'

/**
 * 数据目录 —— 代码与数据的分界线，**以文件形态**看它的唯一一处。布局（文件叫什么）在 @jjj/tripmd 的 layout.ts。
 *
 * 谁用：tools/ 下的 CLI、build:public 的暂存、apps/web 的 vite 插件。浏览器代码不 import 它（有 node:fs，
 * tools/arch/boundary.test.ts 守着这条）。`@jjj/tripmd` 负责文本 ↔ Trip；这里只负责文件 ↔ 文本。
 *
 * 一条边界贯穿所有函数：**真实位置在数据目录之外的东西，既不列出、也不读、也不拷、也不写**。
 * 目录里放一个指向外面的符号链接，字面上在里面、实际上不在 —— dev 服务器、构建、CLI 都按同一个 insideDir 判。
 */

/**
 * 工具仓库根目录。从本文件位置往上数三层 —— 依赖 pnpm 的 workspace 链接是**符号链接**、
 * Node 解析到真实路径这一事实；换成 hoisted / npm 那种拷贝式布局，这里会指到 node_modules 里面去。
 * 仓库钉了 pnpm，不会发生
 */
export const TOOL_ROOT = resolve(fileURLToPath(new URL('../../../', import.meta.url)))

/** 缺省数据目录：工具仓库自带的 apps/web/public/data（示范数据） */
export const DEFAULT_DATA_DIR = resolve(TOOL_ROOT, 'apps/web/public/data')

/**
 * 当前数据目录：JJJ_DATA_DIR 指到别处（数据仓库的 trips/），否则缺省。
 * **相对路径按工具仓库根目录解析，不按当前目录**：同一个变量会被好几个进程读到 ——
 * CLI 在仓库根跑，而 `pnpm build` / `dev` / `look` 起的 vite 在 apps/web 里跑。按当前目录解析时，
 * 文档里的 `JJJ_DATA_DIR=../just-j-journey-personal-space/trips` 对 CLI 是对的，对 vite 却指到
 * apps/ 下一个不存在的目录：构建报错、dev 默默显示示范数据。绝对路径（CI 里用的）不受影响
 */
export function dataDir(): string {
  const env = envValue(DATA_DIR_ENV)
  return env ? resolve(TOOL_ROOT, env) : DEFAULT_DATA_DIR
}

/** 是不是工具仓库自带的那份数据目录：按真实路径比，符号链接、结尾斜杠、相对写法都不影响 */
export function isDefaultDataDir(root: string): boolean {
  return realOfNearest(resolve(root)) === realOfNearest(DEFAULT_DATA_DIR)
}

/** 数据目录不存在或不是目录：抛可读的错 —— JJJ_DATA_DIR 指错是最常见的原因，别让调用方拿到 ENOENT 的原始堆栈 */
export function assertDataDir(root: string): void {
  if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`数据目录不存在或不是目录：${root}（JJJ_DATA_DIR 指错了？）`)
  }
}

/**
 * 行程目录：名字是合法的行程 id、里面有 plan.md、真实位置在数据目录内，按名排序。
 * `_` 前缀的示范目录也在 —— 入不入册由 buildManifest 决定。
 * 没有 plan.md 的子目录（名片的图片文件夹之类）不是行程，安静跳过；名字不合法却有 plan.md 的见 strayDirs
 */
export function tripDirs(root: string): string[] {
  return subdirs(root).filter((d) => isTripId(d) && planFile(root, d) !== null)
}

/** 有 plan.md、名字却不是合法行程 id 的目录（`tokyo.2027`、中文名）—— 它进不了任何清单，data:check 要大声报出来 */
export function strayDirs(root: string): string[] {
  return subdirs(root).filter((d) => !isTripId(d) && planFile(root, d) !== null)
}

function subdirs(root: string): string[] {
  assertDataDir(root)
  return readdirSync(root)
    .filter((d) => !d.startsWith('.') && insideDir(root, d) !== null && isDir(join(root, d)))
    .sort()
}

export interface TripFile extends ParseResult {
  /** 诊断里指名用：`<id>/plan.md` */
  label: string
}

/**
 * 一份行程的 plan.md 在磁盘上的真实位置：存在、是普通文件、真实路径落在数据目录里，否则 null。
 * 读（readTrip）和写（dev 服务器的开关端点、enrich）都从这里拿路径 —— id 来自 URL 时，这就是它的边界检查
 */
export function planFile(root: string, id: string): string | null {
  const file = insideDir(root, join(id, PLAN_FILE))
  return file && isFile(file) ? file : null
}

/**
 * 读并解析一份行程；plan.md 不存在、不是普通文件、或实际落在数据目录外面，返回 null —— 是不是错误由调用方定：
 * data:check 算错，公开版 404。frontmatter 的 id 必须等于目录名，否则当解析失败处理（见 checkTripId）
 */
export function readTrip(root: string, id: string): TripFile | null {
  const file = planFile(root, id)
  if (!file) return null
  const text = readFileSync(file, 'utf8')
  return { ...checkTripId(parse(text), id, text), label: planLabel(id) }
}

/**
 * 行程 id = 目录名。首页按目录名列出行程、按 frontmatter 的 id 拼链接与收藏键，两者不一致时
 * 链接、开关、收藏全都落空 —— 所以不一致就是错误，与解析失败同一待遇（trip 为 null），哪里读到都一样响
 */
function checkTripId(r: ParseResult, id: string, text: string): ParseResult {
  if (!r.trip || r.trip.id === id) return r
  const line = text.split('\n').findIndex((l) => /^id\s*:/.test(l)) + 1 || 1
  return {
    trip: null,
    diagnostics: [
      ...r.diagnostics,
      {
        severity: 'error',
        line,
        message: `frontmatter 的 id「${r.trip.id}」与目录名「${id}」不一致`,
        hint: `行程 id 就是目录名：把 id 改成 ${id}，或者把目录改名`,
      },
    ],
  }
}

/**
 * 一份行程旁边的路网缓存。三种结果，调用方各取所需：
 *   undefined —— 没有这个文件（还没跑过 enrich，常态）
 *   null      —— 有文件但不是 JSON（mergeGeometry / filterGeometry 会把它当「整份不可用」）
 *   其余      —— 解析出来的 JSON，认不认得交给 @jjj/tripmd 的 geometry 规则
 */
export function readGeometry(root: string, id: string): unknown {
  const text = readDataFile(root, join(id, GEOMETRY_FILE))
  if (text === null) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** 数据目录根下的 space.md，解析后给出；没有这个文件返回 null（没写名片是常态，不是错） */
export function readSpace(root: string): SpaceParseResult | null {
  const text = readDataFile(root, SPACE_FILE)
  return text === null ? null : parseSpace(text)
}

/** manifest.json 里的 id（容忍旧形状、坏 JSON、缺文件 —— 一律空数组，浏览器那头同一口径） */
export function readManifestIds(root: string): string[] {
  const text = readDataFile(root, MANIFEST_FILE)
  if (text === null) return []
  try {
    return manifestIds(JSON.parse(text))
  } catch {
    return []
  }
}

/** 扫目录现算清单：能解析的行程与它的 visibility。dev 首页、`pnpm look` 都从这里拿，不读可能过期的 manifest.json */
export function scanEntries(root: string): ManifestEntry[] {
  return tripDirs(root).flatMap((id) => {
    const trip = readTrip(root, id)?.trip
    return trip ? [{ id, visibility: trip.visibility }] : []
  })
}

/** 写 manifest.json，返回写进去的内容：入册规则（`_` 不入册）在 buildManifest */
export function writeManifest(root: string, entries: readonly ManifestEntry[]): Manifest {
  const doc = buildManifest(entries)
  writeDataFile(root, MANIFEST_FILE, JSON.stringify(doc, null, 2) + '\n')
  return doc
}

/** 数据目录里有没有这个文件（真实位置在目录内的普通文件）—— 名片引用的头像、二维码要靠它核对 */
export function hasDataFile(root: string, rel: string): boolean {
  const file = insideDir(root, rel)
  return file !== null && isFile(file)
}

/** 数据目录里一个文件的文本；不存在、不是普通文件、或真实位置在目录外，返回 null */
export function readDataFile(root: string, rel: string): string | null {
  const file = insideDir(root, rel)
  return file && isFile(file) ? readFileSync(file, 'utf8') : null
}

/**
 * 往数据目录里写一个文件：先写临时文件再改名 —— plan.md 是唯一的真相，进程半路被打断也不能留下半截。
 * 目标的真实位置必须在目录内（目录里指向外面的链接写不出去）；改名替换的是目录项本身，不会顺着链接写到外面
 */
export function writeDataFile(root: string, rel: string, text: string): string {
  const file = insideDir(root, rel)
  if (!file) throw new Error(`拒绝写到数据目录外面：${rel}`)
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, text)
  renameSync(tmp, file)
  return file
}

/** 把数据目录里的一个文件拷到 dest；不存在或在目录外就不拷，返回是否拷了 */
export function copyDataFile(root: string, rel: string, dest: string): boolean {
  const file = insideDir(root, rel)
  if (!file || !isFile(file)) return false
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(file, dest)
  return true
}

/**
 * 构建时把数据目录整份拷进产物。不拷的：任何一段以 `.` 开头的（.git / .env / .DS_Store 及其下一切）、
 * 顶层 `_` 开头的示范目录（它们只给 dev 用）、真实位置在数据目录外面的（指出去的符号链接）。
 * 指向目录内的符号链接拷的是它指向的内容；同一个真实目录只走一次，链接成环也不会转圈
 */
export function copyDataTree(root: string, out: string): void {
  const seen = new Set<string>()
  const walk = (rel: string): void => {
    const real = insideDir(root, rel)
    if (!real || seen.has(real)) return
    seen.add(real)
    for (const name of readdirSync(real)) {
      if (name.startsWith('.') || (rel === '' && isFixtureId(name))) continue
      const child = rel === '' ? name : join(rel, name)
      const childReal = insideDir(root, child)
      if (!childReal) continue
      if (isDir(childReal)) walk(child)
      else if (isFile(childReal)) {
        mkdirSync(dirname(join(out, child)), { recursive: true })
        copyFileSync(childReal, join(out, child))
      }
    }
  }
  walk('')
}

/**
 * 把相对路径落到目录里的真实路径；落在目录之外返回 null。存在的路径按**真实路径**比 —— 目录里一个
 * 指向外面的符号链接，字面上在里面、实际上不在。不存在的路径取它最近一个存在的祖先的真实路径再接上剩下的部分：
 * 指向外面的目录链接下面的新文件同样算外面（写路径靠这一条）
 */
export function insideDir(root: string, rel: string): string | null {
  const realRoot = realpathSync(root)
  const real = realOfNearest(resolve(realRoot, rel))
  return real === realRoot || real.startsWith(realRoot + sep) ? real : null
}

function realOfNearest(path: string): string {
  if (statSync(path, { throwIfNoEntry: false })) return realpathSync(path)
  const parent = dirname(path)
  return parent === path ? path : join(realOfNearest(parent), basename(path))
}

const isFile = (p: string): boolean => statSync(p, { throwIfNoEntry: false })?.isFile() === true
const isDir = (p: string): boolean => statSync(p, { throwIfNoEntry: false })?.isDirectory() === true

/** 数据目录里会出现的文件类型 —— dev 服务器直出、构建体检的静态服务器都用这张表 */
export const DATA_MIME: Readonly<Record<string, string>> = {
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json',
  '.ics': 'text/calendar',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

export function mimeOf(path: string): string {
  return DATA_MIME[extname(path).toLowerCase()] ?? 'application/octet-stream'
}
