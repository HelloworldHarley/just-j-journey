import { cpSync, rmSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve, sep } from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import { DEFAULT_DATA_DIR, dataDir } from '@jjj/datadir'
import { dataRoute, isVisibilityCall, normalizeUrlPath, shipsToDist, visibilityRoute, type DataServer, type Reply } from './data-routes.ts'

/**
 * 数据目录接进 vite —— 浏览器只认 `{base}data/…` 这一组相对路径（TripRepository 接缝不动），
 * 这个插件决定那组路径背后是哪份数据、以什么形态给出去。应答逻辑在 data-routes.ts，这里只做适配：
 *
 *   数据目录       JJJ_DATA_DIR 指到别处（数据仓库的 trips/），否则仓库自带的 public/data。
 *                  在仓库外时 dev 直接从那个目录答（不回退到 public/data，两份混着就不知道谁是真相），
 *                  build 时整份拷进 dist/data（跳过 dotfiles）、先删掉从 public/ 带过来的那份；目录也进 watcher，
 *                  任何文件一动就整页刷新 —— 与数据在 public/data 时的行为一致。
 *   manifest.json  dev 里两种模式都现算（扫目录读 plan.md），首页开关改完立刻反映、新建目录不用先跑 data:check；
 *                  磁盘上那份是给构建用的。
 *   公开版 dev     VITE_PUBLIC=1（`pnpm look --public`）：数据也得是抹过的，而且**只答 build:public 会落盘的那几种文件**，
 *                  其余 404 —— 规则链与构建同一条（publicPlan），构建会失败的行程在这里回 500。
 *   写路径         POST {base}api/visibility —— 首页「公开 / 私有」开关，只在完整版的 dev 服务器上存在，公开版没有。
 *
 * 整条请求路径先解码、规范化，再比前缀、再 insideDir —— dev 服务器开着 host: true，端口转发出去就不是只有自己在访问。
 */
export function dataPlugin(): Plugin {
  const root = dataDir()
  const external = root !== DEFAULT_DATA_DIR
  const publicMode = process.env['VITE_PUBLIC'] === '1'
  let base = '/'
  let command: 'build' | 'serve' = 'serve'
  let outDir = ''

  return {
    name: 'jjj:data',
    configResolved(cfg) {
      base = cfg.base
      command = cfg.command
      outDir = resolve(cfg.root, cfg.build.outDir)
    },
    configureServer(server) {
      if (external) watchExternal(server, root)
      const ctx: DataServer = { root, publicMode, external, base }

      server.middlewares.use((req, res, next) => {
        // 先把整条路径解码、规范化，之后所有判断都在这份上做 —— 不在原始 URL 上比前缀（/%64ata/… 的教训）
        const path = normalizeUrlPath((req.url ?? '').split('?')[0] ?? '')
        if (path === null) return send(res, { status: 400, type: 'text/plain; charset=utf-8', body: '路径编码不合法' })

        // 任何一处抛出都回 500 而不是让 dev 进程死掉：一个坏请求不该打掉整个会话
        const fail = (e: unknown): void => send(res, { status: 500, type: 'text/plain; charset=utf-8', body: String(e) })
        if (isVisibilityCall(ctx, path)) {
          readBody(req)
            .then((body) =>
              visibilityRoute(root, {
                method: req.method,
                origin: req.headers.origin,
                host: req.headers.host,
                contentType: req.headers['content-type'],
                body,
              }),
            )
            .then((reply) => send(res, reply), fail)
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
      if (!external || command !== 'build') return
      if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`数据目录不存在：${root}（JJJ_DATA_DIR 指错了？）`)
      const out = `${outDir}${sep}data`
      rmSync(out, { recursive: true, force: true })
      cpSync(root, out, { recursive: true, dereference: true, filter: (from) => shipsToDist(root, from) })
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

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
