#!/usr/bin/env tsx
/**
 * enrich 管道 —— 补两样地图自己算不出来的东西：真实路网 polyline、缺失的地点坐标。
 *
 *   pnpm enrich <dir>                    算路线，写 <dir>/geometry.json（需 ORS_API_KEY）
 *   pnpm enrich <dir> --geocode          查缺坐标，打印清单，**不写任何东西**
 *   pnpm enrich <dir> --geocode --apply  你过目之后，把 coord 写回 plan.md
 *
 * 两条硬规矩：
 *
 * 1. **plan.md 是唯一真相**，geometry.json 只是派生缓存。每条路线记录都带上算它时
 *    用的起终点坐标，浏览器加载时一比对不上就整条丢弃 —— 那一段回到直线。
 *    地点坐标一改，旧路线自动失效，绝不会出现「线还连着旧位置」。
 * 2. **运行时零 API 调用**是地图的硬约束。所有网络请求只发生在这个离线工具里。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { TRANSPORTS, type Place, type TransportMode, type Trip } from '@jjj/schema'
import {
  formatDiagnostics,
  missingCoords,
  parse,
  routableLegs,
  type GeometryDoc,
  type GeometryRecord,
} from '@jjj/tripmd'
import { ROOT, dataDir } from './lib/paths.ts'
import { bold, die, dim, green, red, yellow } from './lib/cli.ts'

const DATA = dataDir()
if (process.env['JJJ_DATA_DIR']) console.log(dim(`数据目录 ${DATA}`))

/**
 * key 从仓库根的 `.env` 读（已在 .gitignore 里，不进仓库）。
 * 显式 export 的环境变量优先 —— 临时换一个 key 时不用去改文件。
 * 这里的 ROOT 是工具仓库根，不是数据目录：.env 跟着代码走，不跟着数据仓库走。
 */
function secret(name: string): string | undefined {
  const exported = process.env[name]
  if (exported) return exported
  try {
    process.loadEnvFile(join(ROOT, '.env'))
  } catch {
    return undefined // 没有 .env 是常态
  }
  return process.env[name]
}

// geometry.json 的形状、键的算法、「该算哪些段」与「端点还对不对得上」
// 全在 `@jjj/tripmd/geometry.ts` —— 浏览器合并、这个工具、data:check 共用一份。

/** 约 1 米，与 tripmd 端点校验同一个容差 */
const COORD_EPS = 1e-5

const sameCoord = (a: [number, number], b: [number, number]): boolean =>
  Math.abs(a[0] - b[0]) < COORD_EPS && Math.abs(a[1] - b[1]) < COORD_EPS

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── 入口 ────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const dir = args.find((a) => !a.startsWith('--'))

for (const f of flags) {
  if (f !== '--geocode' && f !== '--apply') die(`不认识的选项 ${f}（只有 --geocode 和 --apply）`)
}
if (!dir) die('用法：pnpm enrich <行程目录> [--geocode] [--apply]')
if (flags.has('--apply') && !flags.has('--geocode')) {
  die('--apply 只跟 --geocode 一起用（路线本来就直接写 geometry.json）')
}

const mdPath = join(DATA, dir!, 'plan.md')
if (!existsSync(mdPath)) die(`找不到 ${dir}/plan.md`)

const { trip, diagnostics } = parse(readFileSync(mdPath, 'utf8'))
const errors = diagnostics.filter((d) => d.severity === 'error')
if (!trip || errors.length > 0) {
  console.error(formatDiagnostics(`data/${dir}/plan.md`, errors))
  die(`${dir} 解析失败 —— 先把 plan.md 修好（pnpm data:check ${dir}）`)
}

// ── 路线 ────────────────────────────────────────────────────────

/** ORS 的 profile。只列 routable 的模式 —— 轨道/公交/轮渡/飞行没有公开线路几何 */
const ORS_PROFILE: Partial<Record<TransportMode, string>> = {
  walk: 'foot-walking',
  drive: 'driving-car',
  rideshare: 'driving-car',
  bike: 'cycling-regular',
}

interface Want {
  mode: TransportMode
  from: [number, number]
  to: [number, number]
  label: string
}

async function routes(trip: Trip): Promise<void> {
  const apiKey = secret('ORS_API_KEY')
  if (!apiKey) {
    die(
      'ORS_API_KEY 没设。去 https://openrouteservice.org 注册一个免费 key（邮箱即可），\n' +
        '写进仓库根的 .env（`ORS_API_KEY=...`，已在 .gitignore 里）或直接 export。\n' +
        `补坐标那一半不需要它：pnpm enrich ${dir} --geocode`,
    )
  }

  // 该算哪些段是 tripmd 说了算（与 data:check 的分母同一个口径）；
  // 这里只按键去重 —— 同一对地点同一方式在别的天重复出现时只请求一次
  const needs = routableLegs(trip)
  const wanted = new Map<string, Want>()
  for (const n of needs) {
    if (!ORS_PROFILE[n.mode]) continue // routable 但 ORS 没有对应 profile
    wanted.set(n.key, {
      mode: n.mode,
      from: n.from.coord!,
      to: n.to.coord!,
      label: `${n.from.name} → ${n.to.name}`,
    })
  }
  const legCount = trip.days.reduce((n, d) => n + d.legs.length, 0)

  const outPath = join(DATA, dir!, 'geometry.json')
  const kept = reusable(outPath, wanted)
  const todo = [...wanted].filter(([k]) => !kept[k])

  console.log(
    dim(
      `${legCount} 段路里 ${needs.length} 段可算（${wanted.size} 条不同路线）· ` +
        `复用 ${Object.keys(kept).length} 条 · 待请求 ${todo.length} 条\n` +
        `其余走轨道 / 公交 / 轮渡 / 飞行或端点缺坐标，没有公开线路几何，继续画虚线`,
    ),
  )

  const routesOut: Record<string, GeometryRecord> = { ...kept }
  let failed = 0
  for (const [i, [key, want]] of todo.entries()) {
    if (i > 0) await sleep(1500) // ORS 免费档约 40 次/分
    const poly = await orsRoute(apiKey, want)
    if (!poly) {
      failed++
      continue
    }
    routesOut[key] = { poly, from: want.from, to: want.to }
    console.log(`  ${green('✓')} ${want.label} ${dim(`${TRANSPORTS[want.mode].zh} · ${poly.length}B`)}`)
  }

  const doc: GeometryDoc = {
    version: 1,
    // 排序输出：重跑的 diff 只反映真实变化，不反映请求顺序
    routes: Object.fromEntries(Object.entries(routesOut).sort(([a], [b]) => (a < b ? -1 : 1))),
  }
  const n = Object.keys(doc.routes).length
  if (n === 0) {
    console.log(yellow('一条都没算出来，不写文件（保留现状总好过写个空壳）'))
    process.exit(failed > 0 ? 1 : 0)
  }
  writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n')
  console.log(
    `${green('✓')} ${bold(`${dir}/geometry.json`)} ${dim(`${n} 条路线`)}` +
      (failed > 0 ? yellow(`  ${failed} 条失败，那几段仍画虚线`) : ''),
  )
}

/**
 * 复用上一次的成果 —— 只有键还被需要、且两端坐标仍然对得上的记录才留。
 * 重跑不白烧配额；地点坐标改过的那几条会自然掉队，下面重算。
 */
function reusable(path: string, wanted: Map<string, Want>): Record<string, GeometryRecord> {
  if (!existsSync(path)) return {}
  let doc: GeometryDoc
  try {
    doc = JSON.parse(readFileSync(path, 'utf8')) as GeometryDoc
  } catch {
    console.log(yellow('现有 geometry.json 不是合法 JSON，整份重算'))
    return {}
  }
  if (doc?.version !== 1 || typeof doc.routes !== 'object') return {}
  const out: Record<string, GeometryRecord> = {}
  for (const [key, rec] of Object.entries(doc.routes)) {
    const want = wanted.get(key)
    if (!want || !rec?.poly) continue
    if (!sameCoord(rec.from, want.from) || !sameCoord(rec.to, want.to)) continue
    out[key] = rec
  }
  return out
}

/** 一次 ORS 请求。任何失败都只是「这一段没有真路」，不中断整轮。 */
async function orsRoute(apiKey: string, want: Want): Promise<string | null> {
  const profile = ORS_PROFILE[want.mode]!
  try {
    const res = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}`, {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: [want.from, want.to] }),
    })
    if (!res.ok) {
      console.log(`  ${yellow('⚠')} ${want.label} ${dim(`HTTP ${res.status}：${(await res.text()).slice(0, 120)}`)}`)
      return null
    }
    const body = (await res.json()) as { routes?: { geometry?: string }[] }
    const poly = body.routes?.[0]?.geometry
    if (!poly) {
      console.log(`  ${yellow('⚠')} ${want.label} ${dim('返回里没有 geometry')}`)
      return null
    }
    return poly
  } catch (e) {
    console.log(`  ${yellow('⚠')} ${want.label} ${dim(String(e))}`)
    return null
  }
}

// ── 地理编码 ────────────────────────────────────────────────────

/** 命中这些说明只匹配到了行政区划，不是那个具体地点 —— 一律标低置信度 */
const COARSE = new Set([
  'city',
  'town',
  'village',
  'hamlet',
  'county',
  'state',
  'country',
  'region',
  'province',
  'municipality',
  'administrative',
  'suburb',
  'neighbourhood',
  'postcode',
])

interface Hit {
  place: Place
  query: string
  lat: number
  lng: number
  display: string
  /** 有理由怀疑时写下原因；空串 = 看着可信 */
  doubt: string
}

async function geocode(trip: Trip, apply: boolean): Promise<void> {
  const missing = missingCoords(trip)
  if (missing.length === 0) {
    console.log(`${green('✓')} ${dir} 没有缺坐标的地点`)
    return
  }

  // 用行程已有坐标框出的范围做软偏置 —— 同名地点满世界都是，
  // 「Capitol Hill」在华盛顿特区也有一个。不做硬裁剪：范围外的照样返回，只是标出来。
  const box = viewbox(trip)
  console.log(dim(`${missing.length} 个地点缺坐标，向 Nominatim 逐个查（每次间隔 1.2s）…\n`))

  const hits: Hit[] = []
  let first = true
  for (const place of missing) {
    const tries = candidates(place)
    let result: Awaited<ReturnType<typeof search>> | null = null
    for (const q of tries) {
      if (!first) await sleep(1200) // Nominatim 硬性限速 1 次/秒
      first = false
      result = await search(q, box)
      if (result.top) break
    }
    if (!result?.top) {
      console.log(`${red('✗')} ${bold(place.name)} ${dim(result?.why ?? '没查到')}`)
      continue
    }

    const hit = judge(place, result.query, result.top, box, tries[0]!)
    hits.push(hit)
    const mark = hit.doubt ? yellow('⚠') : green('✓')
    console.log(
      `${mark} ${bold(place.name)} ${dim(`← ${hit.query}`)}\n` +
        `    ${hit.display}\n` +
        `    ${bold(`${hit.lat.toFixed(4)}, ${hit.lng.toFixed(4)}`)}` +
        (hit.doubt ? yellow(`   ${hit.doubt}`) : ''),
    )
  }

  if (!apply) {
    console.log(
      dim(
        `\n什么都没写。核对无误后：pnpm enrich ${dir} --geocode --apply\n` +
          '（带 ⚠ 的建议先在地图上确认 —— 偏 20 公里的点比没有点更糟）',
      ),
    )
    return
  }

  // 落在行程范围外的几乎必然是同名的另一个地方（Asadero Sinaloa 匹配到了墨西哥）。
  // 工具既然已经知道它不对，就不该把它写进 plan.md —— 剩下的 ⚠ 是判断题，交给人。
  const ok = hits.filter((h) => !h.doubt.includes('落在行程范围之外'))
  for (const h of hits) {
    if (!ok.includes(h)) {
      console.log(yellow(`\n跳过 ${bold(h.place.name)}：${h.display.split(',').slice(-2).join(',').trim()}`))
      console.log(dim('    离行程太远，几乎肯定是同名的另一个地方。要用就自己在 plan.md 里填'))
    }
  }
  if (ok.length === 0) die('没有可写入的结果')
  writeCoords(ok)
}

/** 行程已有坐标的包络框，四周放宽 0.5° 后当 Nominatim 的软偏置窗口 */
function viewbox(trip: Trip): [number, number, number, number] | null {
  const pts = trip.places.map((p) => p.coord).filter((c): c is [number, number] => c !== null)
  if (pts.length === 0) return null
  const lngs = pts.map((c) => c[0])
  const lats = pts.map((c) => c[1])
  const pad = 0.5
  return [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad]
}

/**
 * 一个地点要试的查询词，从最全到最短。
 *
 * `en:` 字段的文档写着「geocoding 优先用它」—— 中文名字在 OSM 里基本查不到。
 * 但作者写的 en 往往是「主名 + 地标 + 城市」（`Elliott's Oyster House Pier 56 Seattle`），
 * 而 Nominatim 的自由文本搜索对这种拼串很挑，整串一个字都匹配不上。于是逐步退让：
 * 先去掉逗号后的后缀，再一个个丢掉末尾的词，直到只剩两个词为止。
 * 越退越可能匹配到别的东西 —— 所以实际用了哪个词会打在清单上，由人过目。
 */
function candidates(place: Place): string[] {
  const full = place.nameEn ?? place.name
  const out = [full]
  let words = full.split(',')[0]!.trim().split(/\s+/)
  while (words.length >= 2) {
    const q = words.join(' ')
    if (!out.includes(q)) out.push(q)
    words = words.slice(0, -1)
  }
  return out
}

interface NominatimHit {
  lat: string
  lon: string
  display_name: string
  addresstype?: string
  category?: string
  type?: string
}

/** 一次 Nominatim 查询。失败原因随结果带回来，由调用方统一打印 —— 免得报两遍 */
async function search(
  query: string,
  box: [number, number, number, number] | null,
): Promise<{ query: string; top: NominatimHit | null; why: string }> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  if (box) url.searchParams.set('viewbox', box.join(','))

  try {
    const res = await fetch(url, {
      // Nominatim 的使用条款要求可识别的 User-Agent，默认那个会被拒
      headers: { 'User-Agent': 'just-j-journey-enrich/0.1 (github.com/HelloworldHarley/just-j-journey)' },
    })
    if (!res.ok) return { query, top: null, why: `HTTP ${res.status}` }
    const [top] = (await res.json()) as NominatimHit[]
    return { query, top: top ?? null, why: `没查到（${query}）` }
  } catch (e) {
    return { query, top: null, why: String(e) }
  }
}

/** 结果可不可信 —— 由工具说清楚理由，由人拍板。偏 20 公里的点比没有点更糟。 */
function judge(
  place: Place,
  query: string,
  top: NominatimHit,
  box: [number, number, number, number] | null,
  full: string,
): Hit {
  const lat = Number(top.lat)
  const lng = Number(top.lon)
  const dropped = full.split(/\s+/).length - query.split(/\s+/).length
  const doubts: string[] = []
  if (!place.nameEn) doubts.push('没有 en: 名，按中文名查的')
  // 丢一个词多半只是甩掉「Seattle」这类冗余；丢两个以上就开始丢掉限定信息了
  if (dropped >= 2) doubts.push(`查询词从 ${dropped + query.split(/\s+/).length} 个词砍到 ${query.split(/\s+/).length} 个才查到`)
  if (top.addresstype && COARSE.has(top.addresstype)) doubts.push(`只匹配到 ${top.addresstype} 中心`)
  if (box && (lng < box[0] || lng > box[2] || lat < box[1] || lat > box[3])) doubts.push('落在行程范围之外')
  return {
    place,
    query,
    lat,
    lng,
    display: top.display_name,
    doubt: doubts.length ? `⚠ ${doubts.join('；')}` : '',
  }
}

/**
 * 把坐标写回 plan.md —— **定点文本编辑，不是整份重写**。
 *
 * 不能走 `applyPatch` → `serialize`：serialize 不是逐字节忠实的（YAML 字符串会被
 * 重新加引号），对 seattle 那份跑一遍有 95 行无关变动，7 处真实改动会被淹没。
 * 所以这里只在 `trip-places` 块里按名字定位记录、插一行 `coord:`，其余字节不动。
 * 写完立刻重新 parse 验证 —— 解析器是唯一的验证器；不通过就一个字节都不落盘。
 */
function writeCoords(hits: Hit[]): void {
  const before = readFileSync(mdPath, 'utf8')
  const lines = before.split('\n')

  const fence = lines.findIndex((l) => l.trim() === '```trip-places')
  if (fence < 0) die('plan.md 里没有 ```trip-places 块，不知道往哪写')
  const end = lines.findIndex((l, i) => i > fence && l.trim() === '```')
  if (end < 0) die('```trip-places 块没有收尾')

  // 从后往前插，前面记录的行号才不会被移动
  const plan: { at: number; text: string; name: string }[] = []
  for (const hit of hits) {
    const start = lines.findIndex(
      (l, i) => i > fence && i < end && recordName(l) === hit.place.name,
    )
    if (start < 0) {
      console.log(yellow(`⚠ ${hit.place.name}：在 trip-places 里找不到同名记录，跳过`))
      continue
    }
    const stop = lines.findIndex((l, i) => i > start && (i >= end || /^\s*- /.test(l)))
    const body = lines.slice(start, stop < 0 ? end : stop)
    if (body.some((l) => /^\s*coord:/.test(l))) {
      console.log(yellow(`⚠ ${hit.place.name}：已经有 coord 了，跳过`))
      continue
    }
    // 跟在 `en:` 之后，没有 en 就跟在 name 之后 —— 与文件里既有的字段顺序一致
    const enAt = body.findIndex((l) => /^\s*en:/.test(l))
    const at = start + (enAt >= 0 ? enAt : 0) + 1
    const indent = /^(\s*)/.exec(lines[start] ?? '')?.[1] ?? ''
    plan.push({
      at,
      text: `${indent}  coord: ${hit.lat.toFixed(4)}, ${hit.lng.toFixed(4)}`,
      name: hit.place.name,
    })
  }

  if (plan.length === 0) die('没有一条可写')
  for (const p of [...plan].sort((a, b) => b.at - a.at)) lines.splice(p.at, 0, p.text)
  const after = lines.join('\n')

  // 解析器是唯一的验证器：过不了就不落盘
  const check = parse(after)
  const bad = check.diagnostics.filter((d) => d.severity === 'error')
  if (!check.trip || bad.length > 0) {
    console.error(formatDiagnostics(`data/${dir}/plan.md`, bad))
    die('写入后解析不过，已放弃（文件未改动）')
  }

  writeFileSync(mdPath, after)
  console.log(`\n${green('✓')} ${bold(`${dir}/plan.md`)} ${dim(`写入 ${plan.length} 个 coord`)}`)
  for (const p of plan) console.log(dim(`    ${p.name} ${p.text.trim()}`))
  console.log(dim(`\n接着算路线：pnpm enrich ${dir}`))
}

/** `- name: 派克市场` → `派克市场`；不是记录首行就返回 null */
function recordName(line: string): string | null {
  const m = /^\s*-\s+name:\s*(.+?)\s*$/.exec(line)
  if (!m) return null
  return m[1]!.replace(/^["'](.*)["']$/, '$1')
}

// ── 派活 ────────────────────────────────────────────────────────
//
// 放在文件末尾是必须的，不是风格：顶层 await 会在下方那些 `const`（COARSE、
// ORS_PROFILE）初始化之前就跑完，写在上面必然撞 TDZ。

if (flags.has('--geocode')) {
  await geocode(trip, flags.has('--apply'))
} else {
  await routes(trip)
}
