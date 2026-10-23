import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { dataPlugin } from './vite/data-plugin.ts'
import { DEV_PORT, devHost } from './vite/dev-server.ts'

// GitHub Pages 项目页挂在 /<repo>/ 子路径下，CI 里用 `vite build --base=/<repo>/` 覆盖。
// 数据加载（MarkdownTripRepository）跟着 import.meta.env.BASE_URL 走，
// 路由是 HashRouter —— 静态托管零 rewrite 配置。
// 数据从哪来、公开版 dev 怎么抹、首页开关怎么写回：全在 vite/data-plugin.ts。
export default defineConfig({
  plugins: [react(), tailwindcss(), dataPlugin()],
  optimizeDeps: {
    // maplibre-gl 的瓦片解析跑在 web worker 里；dev 的依赖预打包
    // 不会带上它的 worker 文件（maplibre-gl-worker.mjs 404 → 画布空白）。
    // 排除出预打包让浏览器直接吃它的 ESM。生产构建不受影响。
    exclude: ['maplibre-gl'],
  },
  server: {
    port: DEV_PORT,
    // 默认只听本机（理由见 vite/dev-server.ts）；端口转发照常能接上。
    // Host 头沿用 vite 的缺省检查（IP 与 localhost 放行）—— 不开 allowedHosts: true，那会向 DNS 重绑定敞开
    host: devHost(),
  },
})
