import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))

/**
 * 数据目录 —— 代码与数据的分界线。
 * 缺省是仓库自带的 apps/web/public/data（示范数据 + 开发期的行程）；
 * 数据仓库的工作流把 JJJ_DATA_DIR 指到它自己的 trips/（含 space.md）。
 * data:check / enrich / build / publish 全从这里取路径，浏览器那头不知道也不需要知道。
 */
export function dataDir(): string {
  const env = process.env['JJJ_DATA_DIR']
  return env ? resolve(env) : join(ROOT, 'apps/web/public/data')
}
