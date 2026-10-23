import { DEV_HOST_ENV, envValue } from '@jjj/datadir'

/** dev 服务器的端口与监听地址 —— vite.config 与 `pnpm look` 共用这一份 */
export const DEV_PORT = 5173
/** `pnpm look --public` 的公开版 dev 用下一个端口，两个能同时开 */
export const PUBLIC_DEV_PORT = DEV_PORT + 1

/**
 * 监听地址：默认只听本机。dev 服务器能读全部私有行程、能把行程翻成公开，
 * 开在所有网卡上等于把这些交给同一个 Wi-Fi 下的任何人。SSH / VS Code 的端口转发连的是本机回环，不受影响；
 * 要拿手机在局域网里看，显式设 JJJ_DEV_HOST=0.0.0.0
 */
export function devHost(): string {
  return envValue(DEV_HOST_ENV) ?? '127.0.0.1'
}
