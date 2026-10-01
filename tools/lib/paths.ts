import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 工具仓库根 —— `.env`、apps/web 的 vite、暂存目录都从这里找。数据目录另在 `@jjj/datadir` */
export const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))
