import { rmSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join, resolve, sep } from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import {
  CALENDAR_TOKEN_ENV,
  assertDataDir,
  copyDataTree,
  dataDir,
  envValue,
  isDefaultDataDir,
  isPublicBuild,
} from '@jjj/datadir'
import { SITE_DATA_DIR } from '@jjj/tripmd'
import {
  dataRoute,
  hostAllowed,
  isVisibilityCall,
  normalizeUrlPath,
  rawServingDir,
  visibilityRoute,
  type DataServer,
  type Reply,
} from './data-routes.ts'
import { calendarToken, writeCalendarFeeds } from './calendar-feeds.ts'

/**
 * 数据目录接进 vite —— 浏览器只认 `{base}data/…` 这一组相对路径（TripRepository 接缝不动），
 * 这个插件决定那组路径背后是哪份数据、以什么形态给出去。应答逻辑在 data-routes.ts，这里只做适配：
 *
 *   数据目录       JJJ_DATA_DIR 指到别处（数据仓库的 trips/），否则仓库自带的 public/data。
 *                  在仓库外时 dev 直接从那个目录答（不回退到 public/data，两份混着就不知道谁是真相），目录也进 watcher，
 *                  任何文件一动就整页刷新 —— 与数据在 public/data 时的行为一致。
 *   构建           产物里的 data/ 一律从数据目录重拷（copyDataTree：不带 dotfiles、`_` 示范目录、指出去的链接）。
 *   manifest.json  dev 里两种模式都现算（扫目录读 plan.md），首页开关改完立刻反映、新建目录不用先跑 data:check；
 *                  磁盘上那份是给构建用的。
 *   公开版 dev     VITE_PUBLIC=1（`pnpm look --public`）：数据也得是抹过的，而且**只答 build:public 会落盘的那几种文件**，
 *                  其余 404 —— 规则链与构建同一条（publicPlan），构建会失败的行程在这里回 500。
 *   写路径         POST {base}api/visibility —— 首页「公开 / 私有」开关，只在完整版的 dev 服务器上存在，公开版没有。
 *
 * 信任边界：dev 服务器默认只听本机（vite/dev-server.ts）；这里的中间件排在 vite 自己的 Host 检查前面，所以自己查 Host；
 * 整条请求路径先解码、规范化，再比前缀、再 insideDir；出错只回一句通用文字，详情打在终端。
 */

/** 首页开关的请求体只有 `{id, visibility}`，4KB 绰绰有余 */
const MAX_BODY = 4096
const TEXT = 'text/plain; charset=utf-8'

export function dataPlugin(): Plugin {
  const root = dataDir()
  const external = !isDefaultDataDir(root)
  let publicMode = false
  let base = '/'
  let command: 'build' | 'serve' = 'serve'
  let outDir = ''
  let calToken: string | null = null

  return {
    name: 'jjj:data',
    configResolved(cfg) {
      base = cfg.base
      command = cfg.command
      outDir = resolve(cfg.root, cfg.build.outDir)
      // 读 vite 解析好的 env（含 .env 文件）而不是 process.env —— 浏览器读的就是这一份，两边才不会一个公开一个完整
      publicMode = isPublicBuild(cfg.env)
      // 只在构建时看密钥：带着它跑公开版构建会在这里直接失败，而不是等产物发出去
      if (command === 'build') calToken = calendarToken(envValue(CALENDAR_TOKEN_ENV), publicMode)
    },
    configureServer(server) {
      assertDataDir(root)
      const raw = publicMode ? rawServingDir(root, server.config.server.fs.allow) : null
      if (raw) {
        throw new Error(
          `公开版 dev 拒绝启动：数据目录 ${root} 在 vite 能直读的范围（${raw}）里，/@fs/ 能绕过抹除拿到原文。` +
            '把数据目录放到工具仓库外面（比如 ../just-j-journey-personal-space/trips）',
        )
      }
      if (external) watchExternal(server, root)
      const ctx: DataServer = { root, publicMode, external, base }
      const allowedHosts = server.config.server.allowedHosts

      server.middlewares.use((req, res, next) => {
        if (!hostAllowed(req.headers.host, allowedHosts)) return send(res, { status: 403, type: TEXT, body: 'Host 不在允许范围内' })
        // 先把整条路径解码、规范化，之后所有判断都在这份上做 —— 不在原始 URL 上比前缀（/%64ata/… 的教训）
        const path = normalizeUrlPath((req.url ?? '').split('?')[0] ?? '')
        if (path === null) return send(res, { status: 400, type: TEXT, body: '路径编码不合法' })

        // 任何一处抛出都回 500 而不是让 dev 进程死掉；响应里不带异常原文（会有数据目录的绝对路径），详情打在终端
        const fail = (e: unknown): void => {
          server.config.logger.error(`[jjj] ${req.method ?? ''} ${path} 出错：${e instanceof Error ? (e.stack ?? e.message) : String(e)}`)
          send(res, { status: 500, type: TEXT, body: '服务器内部错误，详情见 dev 服务器的终端' })
        }
        if (isVisibilityCall(ctx, path)) {
          readBody(req, MAX_BODY)
            .then((body) => {
              if (body === null) return send(res, { status: 413, type: TEXT, body: '请求体太大' })
              send(
                res,
                visibilityRoute(root, {
                  method: req.method,
                  origin: req.headers.origin,
                  host: req.headers.host,
                  contentType: req.headers['content-type'],
                  body,
                }),
              )
            })
            .catch(fail)
          return
        }
        let reply: Reply | null
        try {
          reply = dataRoute(ctx, path)
        } catch (e) {
          return fail(e)
        }
        if (reply) send(res, reply)
        else next()
      })
    },
    closeBundle() {
      if (command !== 'build') return
      assertDataDir(root)
      // 产物里的 data/ 一律从数据目录重拷：缺省数据目录时 vite 从 public/ 带过来的那份里有 `_` 示范目录
      const out = join(outDir, SITE_DATA_DIR)
      rmSync(out, { recursive: true, force: true })
      copyDataTree(root, out)
      // 完整站的日历订阅：每份行程一把钥匙的路径，Access 只对 cal/ 放行（@jjj/tripmd 的 layout.ts）
      if (calToken) {
        const ids = writeCalendarFeeds(root, outDir, calToken)
        console.log(`[jjj] 日历订阅：${ids.length} 份行程写到 cal/ 下（${ids.join(', ') || '无'}）`)
      }
    },
  }
}

/** 数据目录在仓库外时 Vite 不监听它：加进 watcher，目录里任何文件一动就整页刷新 */
function watchExternal(server: ViteDevServer, root: string): void {
  server.watcher.add(root)
  const reload = (file: string): void => {
    if (!file.startsWith(root + sep)) return
    server.config.logger.info(`[jjj] 数据目录有变 → 整页刷新（${file.slice(root.length + 1)}）`)
    server.ws.send({ type: 'full-reload', path: '*' })
  }
  server.watcher.on('change', reload)
  server.watcher.on('add', reload)
  server.watcher.on('unlink', reload)
}

function send(res: ServerResponse, reply: Reply): void {
  res.statusCode = reply.status
  res.setHeader('content-type', reply.type)
  res.end(reply.body)
}

/** 读请求体；超过 limit 字节返回 null（读完再说，好回 413 而不是掐断连接） */
function readBody(req: IncomingMessage, limit: number): Promise<string | null> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size <= limit) chunks.push(c)
    })
    req.on('end', () => resolvePromise(size > limit ? null : Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
