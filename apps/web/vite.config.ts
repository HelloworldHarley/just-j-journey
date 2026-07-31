import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // GitHub Pages 项目页挂在 /<repo>/ 子路径下，CI 里用 BASE_PATH 覆盖。
  // 数据加载（MarkdownTripRepository）跟着 import.meta.env.BASE_URL 走，
  // 路由是 HashRouter —— 静态托管零 rewrite 配置。
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // 监听所有网卡，这样 SSH 端口转发 / VS Code 端口转发都能接上
    host: true,
    // Vite 6 默认会按 Host 头拦请求。直接用公网 IP 或域名访问时会被挡，
    // 放开以便远程开发机上调试。生产构建走静态文件，与此无关。
    allowedHosts: true,
  },
})
