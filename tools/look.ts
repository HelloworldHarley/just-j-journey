#!/usr/bin/env tsx
/**
 * 改完代码看一眼 —— 起 dev 服务器，端口就绪后把常看的几页开进浏览器。
 *
 *   pnpm look                      完整版 :5173 → 只开首页，行程自己点进去
 *   pnpm look --public             公开版 :5174（VITE_PUBLIC=1）：数据逐请求现抹、只列 public 行程，
 *                                  作者专用的待填 / 待订 / 日历入口都不画 —— 和 build:public 的产物一样，只是带 HMR
 *   pnpm look --both               两个一起起，并排对照
 *   pnpm look --page list,map,info 首页之外再开第一份行程的这几个视图；--trip _demo 换行程
 *   pnpm look --no-open            只起服务器不开浏览器（仍打印会开哪些地址、怎么开 Chrome）
 *   pnpm look --profile 邮箱或目录名 指定 Chrome profile；也可用环境变量 JJJ_CHROME_PROFILE
 *   pnpm look --new-window         开成独立新窗口，而不是在已有窗口里加标签页
 *
 * 浏览器强制用 Chrome，profile 缺省选**当前提交者**（仓库的 `git user.email`）登录的那个；
 * 怎么找、怎么开在 lib/chrome.ts。
 *
 * dev 服务器带 HMR：起一次之后改代码浏览器自己刷，不用重跑；Ctrl+C 把起的服务器一起关掉。
 * 端口被占（另一个终端里跑着 pnpm dev）就自动往上找空的并提示 —— 完整版走奇数、公开版走偶数。
 * JJJ_DATA_DIR 照常生效（首页读的是那个目录的 manifest.json）。
 *
 * 只看 dev。动了地图要验构建产物，走 `pnpm check:built`（dev 与产物解析 worker 的方式不同）。
 */
import { execSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { dataDir, readManifestIds } from '@jjj/datadir'
import { resolveBrowser } from './lib/chrome.ts'
import { bold, die, dim, green, yellow } from './lib/cli.ts'
import { ROOT } from './lib/paths.ts'

interface Mode {
  name: string
  /** 想要的端口；被占时从这里每隔 2 往上找（完整版奇数、公开版偶数，两者不会撞） */
  basePort: number
  /** 实际起在哪 */
  port: number
  env: Record<string, string>
}
const FULL: Mode = { name: '完整版', basePort: 5173, port: 5173, env: {} }
const PUBLIC: Mode = { name: '公开版', basePort: 5174, port: 5174, env: { VITE_PUBLIC: '1' } }

const args = process.argv.slice(2)
const flag = (f: string): boolean => args.includes(f)
/** `--trip _demo` 与 `--trip=_demo` 都认 */
const opt = (f: string): string | undefined => {
  const i = args.indexOf(f)
  if (i !== -1 && args[i + 1] && !args[i + 1]!.startsWith('--')) return args[i + 1]
  return args.find((a) => a.startsWith(`${f}=`))?.slice(f.length + 1)
}

const modes = flag('--both') ? [FULL, PUBLIC] : flag('--public') ? [PUBLIC] : [FULL]
/** 缺省只开首页 —— 行程自己点进去；--page 才多开视图 */
const views = (opt('--page') ?? '').split(',').filter(Boolean)
/** 数据目录里入册的第一份行程 —— 没有 manifest 就只开首页 */
const trip = views.length > 0 ? (opt('--trip') ?? readManifestIds(dataDir())[0] ?? null) : null
const open = !flag('--no-open')

const routes = ['#/', ...(trip ? views.map((v) => `#/trip/${trip}/${v}`) : [])]
if (views.length > 0 && !trip) {
  console.log(yellow('数据目录里没有可读的 manifest.json —— 先跑 pnpm data:check，或用 --trip 指定；这次只开首页'))
}

// ── 起服务器 ──────────────────────────────────────────────────
// 端口先探一遍再起：--strictPort 撞上别人（另一个终端里的 pnpm dev）会直接起不来，
// 而「等端口就绪」又会被那个别人的服务器骗过去，把浏览器开到不知是哪一版的页面上
for (const m of modes) {
  m.port = await freePort(m.basePort)
  if (m.port !== m.basePort) {
    console.log(yellow(`⚠ :${m.basePort} 已被占用（另一个终端的 pnpm dev？lsof -ti:${m.basePort} 看是谁），${m.name}改用 :${m.port}`))
  }
}

// 直接起 vite 而不经 pnpm exec：日志干净，Ctrl+C 也少一层转发
const vite = join(ROOT, 'apps/web/node_modules/.bin/vite')
if (!existsSync(vite)) die('找不到 apps/web 的 vite —— 先 pnpm install')

const children = new Map<Mode, ChildProcess>()
for (const m of modes) {
  console.log(`${dim('起')} ${bold(m.name)} ${dim(`:${m.port}${Object.keys(m.env).length ? ` ${Object.entries(m.env).map(([k, v]) => `${k}=${v}`).join(' ')}` : ''}`)}`)
  const child = spawn(vite, ['--port', String(m.port), '--strictPort'], {
    cwd: join(ROOT, 'apps/web'),
    stdio: 'inherit',
    env: { ...process.env, ...m.env },
  })
  children.set(m, child)
  child.on('exit', (code) => {
    children.delete(m)
    // 最后一个服务器退了（Ctrl+C，或端口被占起不来）就跟着退
    if (children.size === 0) process.exit(code ?? 0)
  })
}
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    for (const c of children.values()) c.kill(sig)
  })
}

// ── 等端口就绪，再开浏览器 ─────────────────────────────────────
const browser = resolveBrowser({
  profile: opt('--profile') ?? process.env['JJJ_CHROME_PROFILE'] ?? gitEmail(),
  newWindow: flag('--new-window'),
})
console.log(dim(browser.describe))
if (browser.warning) console.log(yellow(browser.warning))
for (const m of modes) {
  const up = await waitFor(m)
  if (!up) {
    console.log(
      yellow(children.has(m) ? `⚠ ${m.name} :${m.port} 20 秒内没应答 —— 看上面的日志` : `⚠ ${m.name} 没起来 —— 看上面 vite 的报错`),
    )
    continue
  }
  const urls = routes.map((r) => `http://localhost:${m.port}/${r}`)
  for (const u of urls) console.log(`${green('→')} ${u}`)
  if (open) await browser.open(urls)
}

/** 仓库生效的提交者邮箱（repo-local 覆盖 global —— 个人仓库与工作仓库账号不同就靠这个） */
function gitEmail(): string | undefined {
  try {
    return execSync('git config user.email', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || undefined
  } catch {
    return undefined
  }
}

/** 从 base 起每隔 2 找一个空端口 —— 像 vite 那样真去 listen 一下（host: true 监听所有地址，探默认地址就够） */
async function freePort(base: number): Promise<number> {
  for (let p = base; p < base + 40; p += 2) if (await portFree(p)) return p
  die(`:${base} 往上 20 个端口全被占了`)
}

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer()
    probe.once('error', () => resolve(false))
    probe.once('listening', () => probe.close(() => resolve(true)))
    probe.listen(port)
  })
}

/** 等**我们自己起的**那个服务器应答；它先退了就不等了 —— 不会被别的进程在同一端口上的 200 骗到 */
async function waitFor(m: Mode, ms = 20_000): Promise<boolean> {
  const until = Date.now() + ms
  while (Date.now() < until) {
    if (!children.has(m)) return false
    try {
      const res = await fetch(`http://localhost:${m.port}/`)
      if (res.ok) return true
    } catch {
      // 还没监听，继续等
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}
