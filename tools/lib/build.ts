import { execSync } from 'node:child_process'
import { TOOL_ROOT, publicBuildEnv } from '@jjj/datadir'

/**
 * 跑一次 vite 构建 —— publish（公开版）与 check:built（两种产物）共用这一份调用。
 * `publicData` 给了就是公开版：以那个抹除后的暂存目录为数据、打开公开开关，跑的仍是**同一份** SPA。
 * outDir 相对 apps/web
 */
export function viteBuild(opts: { outDir: string; base?: string | undefined; publicData?: string; quiet?: boolean }): void {
  const base = opts.base ? ` --base=${opts.base}` : ''
  execSync(`pnpm --filter @jjj/web exec vite build --outDir ${opts.outDir}${base}`, {
    cwd: TOOL_ROOT,
    stdio: opts.quiet ? ['ignore', 'ignore', 'inherit'] : 'inherit',
    env: opts.publicData ? publicBuildEnv(opts.publicData) : process.env,
  })
}
