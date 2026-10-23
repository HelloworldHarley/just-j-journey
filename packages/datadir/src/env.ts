/**
 * 跨进程的环境变量 —— 名字和读法只在这里。同一个变量会被好几个进程读到（CLI、vite 的 dev / build、
 * 公开版构建起的子进程），各读各的写法一漂，就是「CLI 看到的数据目录和 vite 看到的不是同一个」。
 * 只给工具自己的变量（JJJ_CHROMIUM、ORS_API_KEY 之类）不在这里，留在用它的那个工具里。
 */

/** 数据目录：数据仓库的 trips/，不设就用工具仓库自带的示范数据 */
export const DATA_DIR_ENV = 'JJJ_DATA_DIR'
/** 完整站日历订阅的总密钥 —— 只交给完整版构建那一步 */
export const CALENDAR_TOKEN_ENV = 'JJJ_CALENDAR_TOKEN'
/** dev 服务器监听的地址；不设只听本机，手机在局域网里调试时显式打开 */
export const DEV_HOST_ENV = 'JJJ_DEV_HOST'
/** 公开构建开关；浏览器经 import.meta.env 读同一个名字（apps/web/src/lib/public.ts） */
const PUBLIC_ENV = 'VITE_PUBLIC'

export function envValue(name: string): string | undefined {
  return process.env[name] || undefined
}

/**
 * 这次是不是公开构建。vite 插件传 vite 解析好的 env（含 .env 文件），CLI 传 process.env ——
 * 插件只看 process.env 的话，`.env.production` 里写一行就会让界面成了公开版、数据却没抹
 */
export function isPublicBuild(env: Readonly<Record<string, string | undefined>>): boolean {
  return env[PUBLIC_ENV] === '1'
}

/** 起公开版 vite 构建 / dev 子进程用的环境：数据换成抹除后的目录，打开公开开关 */
export function publicBuildEnv(stageDir: string): NodeJS.ProcessEnv {
  return { ...process.env, [DATA_DIR_ENV]: stageDir, [PUBLIC_ENV]: '1' }
}

/** 只设公开开关（`pnpm look --public` 的 dev：数据逐请求现抹，不需要暂存目录） */
export const PUBLIC_DEV_ENV: Readonly<Record<string, string>> = { [PUBLIC_ENV]: '1' }
