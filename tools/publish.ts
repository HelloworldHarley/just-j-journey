#!/usr/bin/env tsx
/**
 * 公开版构建 —— 给别人看的个人空间站。
 *
 *   pnpm build:public                    → apps/web/dist-public（Cloudflare Pages 挂根路径，不用 base）
 *   pnpm build:public --base=/repo/      挂在子路径下时（工具仓库 CI 用它当关口，形态同 GitHub Pages 项目页）
 *   pnpm build:public --stage-only       只生成暂存数据目录、打印提醒，不构建（发布前过目公开版长什么样）
 *
 * 做法：数据目录里 visibility: public 的行程过 sanitize，写进 apps/web/.public-data，
 * 再以 JJJ_DATA_DIR 指向它、VITE_PUBLIC=1 跑**同一份** vite build。
 * 产物与完整版（pnpm build）是同一个 SPA，只是数据换了、缺的字段不再画「待填」。
 *
 * 抹除规则见 packages/tripmd/src/sanitize.ts（白名单）与 leaks.ts（泄漏拦截）；发布步骤见 docs/PUBLISHING.md。
 */
import { dataDir } from '@jjj/datadir'
import { viteBuild } from './lib/build.ts'
import { bold, die, dim, green, yellow } from './lib/cli.ts'
import { STAGE_DIR, stagePublic, type StageResult } from './lib/stage-public.ts'

const args = process.argv.slice(2)
const stageOnly = args.includes('--stage-only')
const base = args.find((a) => a.startsWith('--base='))?.slice('--base='.length)
const OUT = 'dist-public'

const src = dataDir()
console.log(dim(`数据目录 ${src} → 公开版暂存 ${STAGE_DIR}`))

let result: StageResult
try {
  result = stagePublic(src, STAGE_DIR)
} catch (e) {
  die(e instanceof Error ? e.message : String(e))
}
for (const t of result.staged) {
  const routes = t.routes.total > 0 ? ` · 路网 ${t.routes.kept}/${t.routes.total} 条随行` : ''
  console.log(`${green('✓')} ${bold(t.id)} ${dim(`已抹除${routes}`)}`)
  for (const w of t.notices) console.log(`  ${yellow('⚠')} ${w}`)
}
if (result.skipped.length > 0) console.log(dim(`跳过 ${result.skipped.length} 份非公开行程：${result.skipped.join(', ')}`))
if (result.staged.length === 0) {
  console.log(yellow('没有任何 visibility: public 的行程 —— 公开版会是一个空的个人空间'))
}
if (stageOnly) process.exit(0)

viteBuild({ outDir: OUT, base, publicData: STAGE_DIR })
console.log(`${green('✓')} ${bold(`apps/web/${OUT}`)} ${dim(`${result.staged.length} 份公开行程`)}`)
