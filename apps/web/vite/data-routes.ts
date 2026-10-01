import { readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { extname, posix, relative, sep } from 'node:path'
import { VISIBILITIES } from '@jjj/schema'
import { DATA_MIME, insideDir, planFile, readGeometry, readSpace, readTrip, tripDirs } from '@jjj/datadir'
import {
  filterGeometry,
  formatDiagnostics,
  isFixtureId,
  isTripId,
  parse,
  publicEntries,
  publicPlan,
  setFrontmatterScalar,
  spaceAssets,
  type ManifestEntry,
} from '@jjj/tripmd'
import { VISIBILITY_ENDPOINT, type VisibilityRequest } from '../src/data/visibility-api.ts'

/**
 * dev 服务器对数据目录的全部应答，写成**不碰 http 对象**的函数：收路径与请求体，返回 {status, type, body}。
 * data-plugin.ts 只做 vite 中间件到这里的适配；「哪个 URL 走哪条路」也在这里（dataRoute），每一条分支都能在 vitest 里直接调。
 *
 * 一条总规矩：**整条 URL 路径先解码、规范化，再比前缀、再 insideDir，然后才谈它是什么**。
 * 两次漏洞都出在「比较发生在解码之前」：`//`、`/./`、`%2e` 绕过过公开版的正则，
 * `/%64ata/…` 绕过过 `{base}data/` 的前缀判断 —— 后者落到 vite 自己的静态服务，它再解码一次，就把原文件发了出去。
 */

export interface Reply {
  status: number
  type: string
  body: string | Buffer
}

const TEXT = 'text/plain; charset=utf-8'
const text = (status: number, body: string): Reply => ({ status, type: TEXT, body })
const json = (body: unknown): Reply => ({ status: 200, type: 'application/json', body: JSON.stringify(body) })

/** dev 服务器的形态：数据目录在哪、是不是公开版、目录在不在仓库外、站点挂在哪个 base 下 */
export interface DataServer {
  root: string
  publicMode: boolean
  external: boolean
  base: string
}

/**
 * 请求路径（不含查询串）→ 解码并规范化后的绝对路径。解码失败（坏的百分号转义）返回 null ——
 * 调用方回 400，而不是让 URIError 炸掉整个 dev 进程。解码只做一次，与 vite 静态服务的 decodeURI 同一层：
 * `%2564ata` 解一次是 `%64ata`，两边都不会把它当成 `data`。
 */
export function normalizeUrlPath(raw: string): string | null {
  try {
    return posix.normalize(decodeURIComponent(raw)).replace(/^\/+/, '/')
  } catch {
    return null
  }
}

/**
 * GET 的分派：规范化后的路径 → 应答；null = 不归我们管，交给 vite。
 *   {base}data/manifest.json   两种模式都现算
 *   {base}data/…               公开版走白名单；仓库外的数据目录直出；仓库内的越界 404、其余交给 vite 的静态服务
 * 公开版下 `{base}data/` 之内的路径**永远**在这里答完，不会落到 vite —— vite 服务的 public/data 是全量数据。
 */
export function dataRoute(s: DataServer, path: string): Reply | null {
  const prefix = `${s.base}data/`
  if (!path.startsWith(prefix)) return null
  const rel = path.slice(prefix.length)
  if (rel === 'manifest.json') return manifestRoute(s.root, s.publicMode)
  if (s.publicMode) return publicRoute(s.root, rel)
  if (s.external) return fileRoute(s.root, rel)
  return insideDir(s.root, rel) ? null : text(404, '')
}

/** 首页开关的端点路径。公开版的 dev 服务器上**没有**这个端点：公开 UI 不画开关，写路径也就不该存在 */
export function isVisibilityCall(s: DataServer, path: string): boolean {
  return !s.publicMode && path === `${s.base}${VISIBILITY_ENDPOINT}`
}

/**
 * 完整版 dev 首页上**要看**的示范目录。示范目录各有各的用处，不是都该上首页：
 *   _demo      全要素演示 —— 改界面时拿它看效果，上首页
 *   _example   TripMD 最小示例，给文档用
 *   _showcase  真行程抹除后的副本，给测试和将来的演示站用 —— 和来源那份真行程是同一趟旅行，
 *              首页同时列两张西雅图是 Harley 明确不要的（2026-09-29），改成了卡片上的公开 / 私有开关
 *   _broken    故意写坏的负向样本，解析必失败
 * 公开版不列任何示范（buildManifest 的 `_` 规则），这张表只管完整版 dev。
 */
const DEV_HOME_FIXTURES: readonly string[] = ['_demo']

/**
 * dev 首页读的清单 —— 扫目录现算，不读可能过期的 manifest.json（首页开关改的是 plan.md）。
 * 完整版：入册的真行程 + 上面那张表里的示范；公开版：只列 public 且不含示范。
 * 没列的示范目录直链照样能开（#/trip/_showcase），只是不上首页
 */
export function manifestRoute(root: string, publicMode: boolean): Reply {
  const entries: ManifestEntry[] = tripDirs(root).flatMap((id) => {
    const trip = readTrip(root, id)?.trip
    return trip ? [{ id, visibility: trip.visibility }] : []
  })
  if (publicMode) return json({ trips: publicEntries(entries) })
  return json({ trips: entries.filter((e) => !isFixtureId(e.id) || DEV_HOME_FIXTURES.includes(e.id)) })
}

/**
 * 公开版 dev：能答的只有这几种，其余一律 404 —— 与 build:public 落盘的文件集合逐项对应：
 *   <id>/plan.md                   走 publicPlan（sanitize → serialize → 再 parse → 抹净断言）；不是 public / 是示范目录 → 404；
 *                                  解析不过或结构块命中 → 500，和 build:public 会失败的情形一致
 *   <id>/geometry.json             用公开版 trip 过滤后的路网（同 stagePublic），一条都不剩 → 404
 *   space.md 与它引用的本地文件    原样（路径在 parseSpace 里已规范化、校验过不越界）
 * 黑名单式的「只拦几种、其余放行」曾让作者放在行程目录里的任何文件都能被 fetch 到。
 */
export function publicRoute(root: string, rel: string): Reply {
  const m = /^([^/]+)\/(plan\.md|geometry\.json)$/.exec(rel)
  if (m) return publicTripFile(root, m[1]!, m[2] as 'plan.md' | 'geometry.json')
  if (rel === 'space.md') return fileRoute(root, rel)
  const space = readSpace(root)?.space
  if (space && spaceAssets(space).includes(rel)) return fileRoute(root, rel)
  return text(404, '公开版没有这个文件')
}

function publicTripFile(root: string, id: string, file: 'plan.md' | 'geometry.json'): Reply {
  if (!isTripId(id) || isFixtureId(id)) return text(404, `公开版里没有 ${id}`)
  const read = readTrip(root, id)
  if (!read) return text(404, `找不到 ${id}/plan.md`)
  if (!read.trip) return text(500, formatDiagnostics(read.label, read.diagnostics))
  if (read.trip.visibility !== 'public') return text(404, `${id} 不是 visibility: public，公开版里没有它`)

  const plan = publicPlan(read.trip)
  if (!plan.trip) return text(500, `${id} 抹除后解析不过：\n${formatDiagnostics(read.label, plan.diagnostics)}`)
  if (plan.fatal.length > 0) {
    return text(500, `${id} 公开版结构块里仍有敏感值：${plan.fatal.map((l) => `第 ${l.line} 行「${l.value}」`).join('，')} —— build:public 会在这里失败`)
  }
  if (file === 'plan.md') return { status: 200, type: DATA_MIME['.md']!, body: plan.md }
  const raw = readGeometry(root, id)
  const geometry = raw === undefined ? null : filterGeometry(plan.trip, raw)
  return geometry ? json(geometry) : text(404, `${id} 没有可随公开版走的路网`)
}

/** 仓库外的数据目录：静态直出；目录之外、不存在、是目录 → 404 */
export function fileRoute(root: string, rel: string): Reply {
  const file = insideDir(root, rel)
  if (!file || !statSync(file, { throwIfNoEntry: false })?.isFile()) return text(404, '')
  return { status: 200, type: DATA_MIME[extname(file)] ?? 'application/octet-stream', body: readFileSync(file) }
}

export interface VisibilityCall {
  method: string | undefined
  /** 浏览器的 Origin 与请求的 Host —— 同源才准写 */
  origin: string | undefined
  host: string | undefined
  contentType: string | undefined
  body: string
}

/**
 * 首页「公开 / 私有」开关的写路径：只改那份 plan.md 的 frontmatter 一行（文本手术，不做 serialize 往返），
 * 改完再 parse 验收，过了才写回，写回是「写临时文件再改名」—— plan.md 是唯一的真相，不能留半截。
 * 同源校验：dev 服务器开着 host: true，作者浏览别的网页时那页可以用 text/plain 的 POST 绕过预检打到这里，
 * 把一份私有行程翻成公开 —— 有 Origin 就必须和 Host 一致，且请求体必须声明是 JSON。
 * 路径走 planFile：真实路径必须落在数据目录里，目录内指向外面的符号链接写不出去。
 */
export function visibilityRoute(root: string, call: VisibilityCall): Reply {
  if (call.method !== 'POST') return text(405, '只接受 POST')
  if (call.origin !== undefined && !sameOrigin(call.origin, call.host)) return text(403, '跨站请求：Origin 与 Host 不一致')
  if (!call.contentType?.startsWith('application/json')) return text(415, '请求体必须是 application/json')

  let payload: Partial<Record<keyof VisibilityRequest, unknown>>
  try {
    payload = JSON.parse(call.body) as typeof payload
  } catch {
    return text(400, '请求体不是 JSON')
  }
  const { id, visibility } = payload
  if (typeof id !== 'string' || !isTripId(id)) return text(400, 'id 不是合法的行程 slug')
  if (typeof visibility !== 'string' || !(VISIBILITIES as readonly string[]).includes(visibility)) {
    return text(400, `visibility 只能是 ${VISIBILITIES.join(' / ')}`)
  }
  const file = planFile(root, id)
  if (!file) return text(404, `找不到 ${id}/plan.md`)

  try {
    // 缺省值不写：private 就把这一行删掉，与 serialize 的口径一致
    const next = setFrontmatterScalar(readFileSync(file, 'utf8'), 'visibility', visibility === 'private' ? null : visibility)
    const { trip, diagnostics } = parse(next)
    if (!trip) return text(500, `改完解析不过，没有写回：\n${formatDiagnostics(`${id}/plan.md`, diagnostics)}`)
    if (trip.visibility !== visibility) return text(500, `改完解析出来的 visibility 是 ${trip.visibility}，没有写回`)
    writeFileSync(`${file}.tmp`, next)
    renameSync(`${file}.tmp`, file)
  } catch (e) {
    return text(500, `写回失败：${e instanceof Error ? e.message : String(e)}`)
  }
  return json({ id, visibility } satisfies VisibilityRequest)
}

function sameOrigin(origin: string, host: string | undefined): boolean {
  try {
    return host !== undefined && new URL(origin).host === host
  } catch {
    return false
  }
}

/** 构建期整份拷贝时要跳过的：数据目录内任何一段以 `.` 开头的路径（.git / .env / .DS_Store 及其下一切）—— 数据仓库里的杂物不该进产物 */
export function shipsToDist(root: string, path: string): boolean {
  return !relative(root, path).split(sep).some((seg) => seg.startsWith('.'))
}
