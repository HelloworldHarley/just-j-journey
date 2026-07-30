import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
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
