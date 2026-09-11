import { cpSync, existsSync, readFileSync, rmSync, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { defineConfig } from 'vite'
import type { Plugin, ResolvedConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const DATA_MIME: Record<string, string> = {
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json',
  '.ics': 'text/calendar',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

/**
 * 数据目录可配置 —— 只有 JJJ_DATA_DIR 设了才起作用，否则 public/data 照旧。
 *
 * dev：/data/* 直接从那个目录答，找不到就 404（不回退到 public/data，两份混着就不知道谁是真相）。
 * build：把它整份拷进 dist/data，**先删掉**从 public/ 带过来的那份。
 * TripRepository 接缝因此不用动：浏览器仍 fetch 同一相对路径，只是构建时放进去的是哪份数据变了。
 * dev 中间件对解出的路径做目录内校验 —— host: true 开着端口转发，`..` 逃逸不能指哪读哪。
 */
function dataDirPlugin(dir: string | undefined): Plugin {
  let cfg: ResolvedConfig
  return {
    name: 'jjj:data-dir',
    configResolved(c) {
      cfg = c
    },
    configureServer(server) {
      if (!dir) return
      const root = resolve(dir)
      const prefix = `${cfg.base}data/`
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0] ?? ''
        if (!url.startsWith(prefix)) return next()
        const file = resolve(root, decodeURIComponent(url.slice(prefix.length)))
        // 目录之外一律 404：dev 服务器开着 host: true，端口转发出去就不是只有自己在访问
        if (file !== root && !file.startsWith(root + sep)) {
          res.statusCode = 404
          res.end()
          return
        }
        if (!existsSync(file) || statSync(file).isDirectory()) {
          res.statusCode = 404
          res.end()
          return
        }
        res.setHeader('content-type', DATA_MIME[extname(file)] ?? 'application/octet-stream')
        res.end(readFileSync(file))
      })
    },
    closeBundle() {
      if (!dir || cfg.command !== 'build') return
      const out = resolve(cfg.root, cfg.build.outDir, 'data')
      rmSync(out, { recursive: true, force: true })
      cpSync(dir, out, { recursive: true })
    },
  }
}

// GitHub Pages 项目页挂在 /<repo>/ 子路径下，CI 里用 `vite build --base=/<repo>/` 覆盖。
// 数据加载（MarkdownTripRepository）跟着 import.meta.env.BASE_URL 走，
// 路由是 HashRouter —— 静态托管零 rewrite 配置。
export default defineConfig({
  plugins: [react(), tailwindcss(), dataDirPlugin(process.env['JJJ_DATA_DIR'] ? resolve(process.env['JJJ_DATA_DIR']) : undefined)],
  optimizeDeps: {
    // maplibre-gl 的瓦片解析跑在 web worker 里；dev 的依赖预打包
    // 不会带上它的 worker 文件（maplibre-gl-worker.mjs 404 → 画布空白）。
    // 排除出预打包让浏览器直接吃它的 ESM。生产构建不受影响。
    exclude: ['maplibre-gl'],
  },
  server: {
    port: 5173,
    // 监听所有网卡，这样 SSH 端口转发 / VS Code 端口转发都能接上
    host: true,
    // Vite 6 默认会按 Host 头拦请求。直接用公网 IP 或域名访问时会被挡，
    // 放开以便远程开发机上调试。生产构建走静态文件，与此无关。
    allowedHosts: true,
  },
})
