#!/usr/bin/env tsx
/**
 * 构建产物体检 —— 验「打包出来的网站，地图到底能不能画」。
 *
 *   pnpm check:built
 *
 * 为什么必须对产物验：dev 直接从 node_modules 加载 maplibre（worker 就躺在旁边），
 * `vite preview` 又有 SPA 回退（缺失文件回 200 + index.html）—— 两处都照不出
 * 「worker 没进包」这一类失败，而它真实发生过：线上地图只剩 pin、没有底图，
 * 瘫了 8 天才被人肉发现。这个脚本把那次的教训固化成关口。
 *
 * 两层检查：
 *   1. 结构层（离线、必跑）：worker 产物存在；它的相对 import 全部落在 dist 里
 *      （`?url` 只拷单文件、依赖缺失的那层坑就在这里现形）；主 chunk 里真的
 *      引用了它（`setWorkerUrl` 的接线没断）。
 *   2. 浏览器层（可选）：无回退静态服务器（模拟 GitHub Pages）挂上产物，
 *      无头 Chromium 打开地图页，断言 web worker 真的起了、瓦片请求真的发生。
 *      找不到 Chromium / playwright-core 时**明确报跳过** —— 跳过不是绿。
 *
 * 浏览器层的依赖故意不进 package.json（仓库约定：Playwright 只做临时脚本）：
 *   - Chromium：自动在 ~/.cache/ms-playwright 里找，或 JJJ_CHROMIUM=<可执行文件> 指定
 *   - playwright-core：就近 import，或 JJJ_PLAYWRIGHT=<包目录> 指定
 */
import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
/** base 用真实仓库名 —— 检查的就是「挂在子路径下」这个 CI 形态 */
const BASE = '/just-j-journey/'
/** 独立产物目录，不覆盖手动 `pnpm build` 的 dist */
const OUT = join(ROOT, 'apps/web/dist-check')

const green = (s: string) => `\x1b[32m${s}\x1b[0m`
const red = (s: string) => `\x1b[31m${s}\x1b[0m`
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`

const fails: string[] = []
const ok = (msg: string) => console.log(`${green('✓')} ${msg}`)
const bad = (msg: string) => {
  console.error(`${red('✗')} ${msg}`)
  fails.push(msg)
}

// ── 构建（与 CI 同一形态：子路径 base）─────────────────────────
console.log(dim(`vite build --base=${BASE} → apps/web/dist-check`))
execSync(`pnpm --filter @jjj/web exec vite build --base=${BASE} --outDir dist-check`, {
  cwd: ROOT,
  stdio: ['ignore', 'ignore', 'inherit'],
})

// ── 结构层 ──────────────────────────────────────────────────────
const assetsDir = join(OUT, 'assets')
const assets = readdirSync(assetsDir)

const worker = assets.find((f) => /^maplibre-gl-worker-.*\.m?js$/.test(f))
if (worker) ok(`worker 产物存在：assets/${worker}`)
else bad('dist 里没有 maplibre-gl-worker-*.js —— 瓦片解析器根本没进包，地图必然只剩 pin')

if (worker) {
  // ?url 单拷文件的坑：worker 自己 import "./maplibre-gl-shared.mjs"，依赖没进包时
  // worker 能起动却死在 import 上 —— 症状和 404 一模一样。逐条解析它的相对引用。
  const src = readFileSync(join(assetsDir, worker), 'utf8')
  const refs = [...src.matchAll(/(?:from\s*|import\s*\(?\s*)"(\.\/[^"]+)"/g)].map((m) => m[1]!)
  const missing = refs.filter((r) => !existsSync(join(assetsDir, r)))
  if (missing.length === 0) ok(`worker 的相对引用全部在包里（${refs.length} 条）`)
  else bad(`worker 引用了不在包里的文件：${missing.join(', ')} —— 它会在 import 上悄悄死掉`)

  // setWorkerUrl 的接线：某个主 chunk 必须以字符串持有 worker 的文件名
  const wired = assets.some((f) => f !== worker && f.endsWith('.js') && readFileSync(join(assetsDir, f), 'utf8').includes(worker))
  if (wired) ok('主 chunk 引用了 worker 的地址（setWorkerUrl 接线完好）')
  else bad('没有任何 chunk 引用 worker 文件名 —— setWorkerUrl 的接线断了，maplibre 会退回运行时拼地址')
}

// ── 浏览器层（可选）────────────────────────────────────────────
const chromium = findChromium()
const pw = await loadPlaywright()

if (!chromium || !pw) {
  console.log(
    yellow('⚠ 浏览器层跳过') +
      dim(
        `（${chromium ? '' : '找不到 Chromium；'}${pw ? '' : '找不到 playwright-core；'}` +
          `npx playwright install chromium 后用 JJJ_CHROMIUM / JJJ_PLAYWRIGHT 指定）`,
      ),
  )
} else {
  await browserPass(pw, chromium)
}

console.log(fails.length ? red(`\n✗ ${fails.length} 项没过`) : green('\n✓ 构建产物里的地图正常'))
process.exit(fails.length ? 1 : 0)

// ── 细节 ────────────────────────────────────────────────────────

/** 模拟 GitHub Pages：静态直出、缺文件就 404 —— **绝不**回退 index.html */
function serve(): Promise<{ port: number; close: () => void }> {
  const MIME: Record<string, string> = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
    '.ics': 'text/calendar', '.woff2': 'font/woff2', '.md': 'text/markdown',
  }
  const server = createServer((req, res) => {
    const path = (req.url ?? '').split('?')[0]!
    if (!path.startsWith(BASE)) { res.writeHead(404).end(); return }
    let file = join(OUT, decodeURIComponent(path.slice(BASE.length)))
    if (path.endsWith('/')) file = join(file, 'index.html')
    if (!existsSync(file)) { res.writeHead(404).end(); return }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
  })
  return new Promise((r) => {
    server.listen(0, () => r({
      port: (server.address() as { port: number }).port,
      close: () => server.close(),
    }))
  })
}

async function browserPass(pw: { chromium: { launch: (o: object) => Promise<Browser> } }, exe: string): Promise<void> {
  const { port, close } = await serve()
  const browser = await pw.chromium.launch({ executablePath: exe })
  try {
    const page = await browser.newPage()
    const notFound: string[] = []
    page.on('response', (r) => {
      if (r.status() >= 400) notFound.push(`${r.status()} ${r.url()}`)
    })
    await page.goto(`http://localhost:${port}${BASE}#/trip/seattle-2026-10/map`, { waitUntil: 'load' })

    // 条件等待而不是赌一个固定秒数：瓦片来自公网，快慢不由我们定。
    // 最多等 25 秒，两个条件都到齐就提前收工。
    const countTiles = (): Promise<number> =>
      page.evaluate(() =>
        performance
          .getEntriesByType('resource')
          .filter((e) => /\.pbf(\?|$)|\/planet\//.test((e as { name: string }).name)).length,
      )
    let tiles = 0
    for (let waited = 0; waited < 25_000; waited += 500) {
      tiles = await countTiles()
      if (page.workers().length > 0 && tiles > 0) break
      await page.waitForTimeout(500)
    }

    if (page.workers().length > 0) ok(`浏览器里起了 ${page.workers().length} 个 web worker`)
    else bad('浏览器里一个 web worker 都没起来 —— 瓦片不会解析')

    if (tiles > 0) ok(`请求到了 ${tiles} 块瓦片`)
    else bad('一块瓦片都没请求 —— worker 没在干活（或断网；离线机器请忽略浏览器层）')

    const workerMiss = notFound.filter((u) => u.includes('maplibre-gl-worker'))
    if (workerMiss.length === 0) ok('没有对 worker 的失败请求')
    else bad(`worker 请求失败：${workerMiss.join('; ')}`)
  } finally {
    await browser.close()
    close()
  }
}

interface Browser {
  newPage(): Promise<{
    on(ev: string, fn: (r: { status(): number; url(): string }) => void): void
    goto(url: string, o: object): Promise<unknown>
    waitForTimeout(ms: number): Promise<void>
    workers(): unknown[]
    evaluate<T>(fn: () => T): Promise<T>
  }>
  close(): Promise<void>
}

function findChromium(): string | null {
  const env = process.env['JJJ_CHROMIUM']
  if (env && existsSync(env)) return env
  const cache = join(homedir(), '.cache/ms-playwright')
  if (!existsSync(cache)) return null
  // 取版本号最大的一份 —— 目录形如 chromium-1223
  const dirs = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort()
  for (const d of dirs.reverse()) {
    const exe = join(cache, d, 'chrome-linux64/chrome')
    if (existsSync(exe)) return exe
  }
  return null
}

async function loadPlaywright(): Promise<{ chromium: { launch: (o: object) => Promise<Browser> } } | null> {
  const env = process.env['JJJ_PLAYWRIGHT']
  if (env) {
    try {
      return await import(pathToFileURL(join(env, 'index.mjs')).href)
    } catch {
      console.log(yellow(`⚠ JJJ_PLAYWRIGHT=${env} 指向的 playwright-core 加载失败`))
    }
  }
  try {
    // 经变量 import：playwright-core 有意不在依赖里（仓库约定），
    // 字面量写法会让 typecheck 在没装它的机器上失败
    const optional = 'playwright-core'
    return await import(optional)
  } catch {
    return null
  }
}
