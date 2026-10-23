import { readFileSync, realpathSync, statSync } from 'node:fs'
import { isIP } from 'node:net'
import { join, posix, resolve, sep } from 'node:path'
import { VISIBILITIES } from '@jjj/schema'
import { insideDir, isDefaultDataDir, mimeOf, planFile, readGeometry, readSpace, readTrip, scanEntries, writeDataFile } from '@jjj/datadir'
import {
  GEOMETRY_FILE,
  MANIFEST_FILE,
  PLAN_FILE,
  SPACE_FILE,
  devHomeEntries,
  formatDiagnostics,
  isFixtureId,
  isTripId,
  parse,
  planLabel,
  publicEntries,
  publicPlan,
  setFrontmatterScalar,
  spaceAssets,
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
  if (rel === MANIFEST_FILE) return manifestRoute(s.root, s.publicMode)
  if (s.publicMode) return publicRoute(s.root, rel)
  if (s.external) return fileRoute(s.root, rel)
  return insideDir(s.root, rel) ? null : text(404, '')
}

/** 首页开关的端点路径。公开版的 dev 服务器上**没有**这个端点：公开 UI 不画开关，写路径也就不该存在 */
export function isVisibilityCall(s: DataServer, path: string): boolean {
  return !s.publicMode && path === `${s.base}${VISIBILITY_ENDPOINT}`
}

/**
 * dev 首页读的清单 —— 扫目录现算，不读可能过期的 manifest.json（首页开关改的是 plan.md）。
 * 完整版：入册的行程 + 要上首页的示范目录（@jjj/tripmd 的 devHomeEntries）；公开版：只列 public 且不含示范。
 * 没列的示范目录直链照样能开（#/trip/_example），只是不上首页
 */
export function manifestRoute(root: string, publicMode: boolean): Reply {
  const entries = scanEntries(root)
  return json({ trips: publicMode ? publicEntries(entries) : devHomeEntries(entries) })
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
  const [id, file, ...rest] = rel.split('/')
  if (rest.length === 0 && id && (file === PLAN_FILE || file === GEOMETRY_FILE)) return publicTripFile(root, id, file)
  if (rel === SPACE_FILE) return fileRoute(root, rel)
  const space = readSpace(root)?.space
  if (space && spaceAssets(space).includes(rel)) return fileRoute(root, rel)
  return text(404, '公开版没有这个文件')
}

function publicTripFile(root: string, id: string, file: typeof PLAN_FILE | typeof GEOMETRY_FILE): Reply {
  if (!isTripId(id) || isFixtureId(id)) return text(404, `公开版里没有 ${id}`)
  const read = readTrip(root, id)
  if (!read) return text(404, `找不到 ${planLabel(id)}`)
  if (!read.trip) return text(500, formatDiagnostics(read.label, read.diagnostics))
  if (read.trip.visibility !== 'public') return text(404, `${id} 不是 visibility: public，公开版里没有它`)

  const plan = publicPlan(read.trip, { geometry: file === GEOMETRY_FILE ? readGeometry(root, id) : undefined, label: id })
  if (plan.problem) return text(500, `${plan.problem}\n—— build:public 会在这里失败`)
  if (file === PLAN_FILE) return { status: 200, type: mimeOf(PLAN_FILE), body: plan.md }
  return plan.geometry ? json(plan.geometry) : text(404, `${id} 没有可随公开版走的路网`)
}

/** 仓库外的数据目录：静态直出；目录之外、不存在、是目录 → 404 */
export function fileRoute(root: string, rel: string): Reply {
  const file = insideDir(root, rel)
  if (!file || !statSync(file, { throwIfNoEntry: false })?.isFile()) return text(404, '')
  return { status: 200, type: mimeOf(file), body: readFileSync(file) }
}

export interface VisibilityCall {
  method: string | undefined
  /** 浏览器的 Origin 与请求的 Host —— 必须是本机页面、且同源才准写 */
  origin: string | undefined
  host: string | undefined
  contentType: string | undefined
  body: string
}

/**
 * 首页「公开 / 私有」开关的写路径：只改那份 plan.md 的 frontmatter 一行（文本手术，不做 serialize 往返），
 * 改完再 parse 验收，过了才写回（writeDataFile：写临时文件再改名，真实位置必须在数据目录里）。
 * 来源校验：**必须**带 Origin，且它是本机页面（localhost / 127.0.0.1 / [::1]）、与 Host 同源。
 * 不带 Origin 的请求（curl、别的程序）一律拒绝；作者浏览的别的网页可以用 text/plain 的 POST 绕过预检打到这里，
 * DNS 重绑定的页面能让 Origin 与 Host 都是它自己的域名 —— 两者都过不了「本机页面」这一条。请求体还必须声明是 JSON。
 * I/O 出错直接抛出，由插件统一回通用的 500。
 */
export function visibilityRoute(root: string, call: VisibilityCall): Reply {
  if (call.method !== 'POST') return text(405, '只接受 POST')
  if (!fromLocalPage(call.origin, call.host)) return text(403, '只接受本机页面发来的请求')
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
  if (!file) return text(404, `找不到 ${planLabel(id)}`)

  // 缺省值不写：private 就把这一行删掉，与 serialize 的口径一致
  const next = setFrontmatterScalar(readFileSync(file, 'utf8'), 'visibility', visibility === 'private' ? null : visibility)
  const { trip, diagnostics } = parse(next)
  if (!trip) return text(500, `改完解析不过，没有写回：\n${formatDiagnostics(planLabel(id), diagnostics)}`)
  if (trip.visibility !== visibility) return text(500, `改完解析出来的 visibility 是 ${trip.visibility}，没有写回`)
  writeDataFile(root, join(id, PLAN_FILE), next)
  return json({ id, visibility } satisfies VisibilityRequest)
}

const LOOPBACK_NAMES: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]'])

function fromLocalPage(origin: string | undefined, host: string | undefined): boolean {
  if (!origin || !host) return false
  try {
    const u = new URL(origin)
    return u.host === host && LOOPBACK_NAMES.has(u.hostname)
  } catch {
    return false
  }
}

/**
 * 公开版 dev 下，数据目录若落在 vite 允许直读文件的范围里（server.fs.allow，缺省是整个工作区），
 * `/@fs/<绝对路径>/<id>/plan.md` 会绕过公开版的白名单、由 vite 直接把没抹的原文发出去 ——
 * 返回命中的那一项，插件据此拒绝启动。仓库自带的示范数据本来就能公开，不算
 */
export function rawServingDir(root: string, allow: readonly string[]): string | null {
  if (isDefaultDataDir(root)) return null
  const real = realpathSync(root)
  return allow.find((dir) => {
    const a = resolve(dir)
    return real === a || real.startsWith(a + sep)
  }) ?? null
}

/**
 * 请求的 Host 能不能进 —— 与 vite 自己的 allowedHosts 同一口径：IP 字面量、localhost 与 *.localhost 总能进，
 * 其余要在 allowedHosts 里（`.example.com` 收它和所有子域）；allowedHosts 为 true 全放行。
 * jjj:data 的中间件排在 vite 的 Host 检查前面、直接应答，那道检查管不到这里，所以自己查 ——
 * 不查的话，DNS 重绑定的页面能以它自己的域名读到全部私有行程
 */
export function hostAllowed(host: string | undefined, allowed: true | readonly string[] | undefined): boolean {
  if (allowed === true) return true
  if (!host) return false
  let name: string
  try {
    name = new URL(`http://${host}`).hostname
  } catch {
    return false
  }
  if (name === 'localhost' || name.endsWith('.localhost') || isIP(name.replace(/^\[|\]$/g, '')) !== 0) return true
  return (allowed ?? []).some((a) => (a.startsWith('.') ? name === a.slice(1) || name.endsWith(a) : name === a))
}
