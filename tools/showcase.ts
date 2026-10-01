#!/usr/bin/env tsx
/**
 * 从数据目录里的一份真行程重生成 _showcase —— 抹除后的公开版副本。
 *
 *   pnpm showcase:refresh seattle-2026-10
 *
 * 给 fork 的人看「真实规模的示范」，同时是 sanitize 的回归 fixture：roundtrip / patch 测试吃它，
 * 迁移第 4 步删掉真行程后测试不受影响。重跑后 git diff 一眼看出抹没抹干净。
 *
 * id 改成 _showcase（目录名 = id 是首页路由的约定）。`_` 前缀让它 dev-only、CI 部署前从 dist 删掉；
 * 迁移第 4 步把目录改成不带 `_` 的名字（frontmatter id 同步改），工具仓库的 Pages 才变成演示站。
 * 目标永远是工具仓库自己的 apps/web/public/data，不跟 JJJ_DATA_DIR 走 —— 示范数据属于代码，
 * 来源那份真行程才在数据目录里。
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_DATA_DIR, dataDir, readGeometry, readTrip } from '@jjj/datadir'
import { formatDiagnostics } from '@jjj/tripmd'
import { bold, die, dim, green, yellow } from './lib/cli.ts'
import { proseWarnings, publicArtifacts } from './lib/stage-public.ts'

const id = process.argv[2]
if (!id) die('用法：pnpm showcase:refresh <行程目录>')
const src = dataDir()
const out = join(DEFAULT_DATA_DIR, '_showcase')

const read = readTrip(src, id)
if (!read) die(`找不到 ${id}/plan.md（数据目录 ${src}）`)
const { trip, diagnostics, label } = read
if (!trip) die(formatDiagnostics(label, diagnostics))

// 改的是**来源**而不是抹完的结果：id / 标题这些字段 sanitize 原样放行，走同一条规则链就不用开后门。
// 标题加**前缀**：它不上 dev 首页（和来源真行程是同一趟），但直链、测试输出、迁移第 4 步之后的演示站都要能一眼
// 和真行程区分开；首页卡片不显示 subtitle，而标题在 390px 上会截断 —— 区分词放后面等于没放
const source = {
  ...trip,
  id: '_showcase',
  title: `公开示范 · ${trip.title}`,
  subtitle: '公开示范 · 抹除敏感信息后的真实行程',
  visibility: 'public' as const,
}
let artifacts
try {
  artifacts = publicArtifacts(source, readGeometry(src, id), '_showcase')
} catch (e) {
  die(e instanceof Error ? e.message : String(e))
}

mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'plan.md'), artifacts.md)
// 路网只带对得上的那部分（民宿那几段自然掉了）；一条都不剩就连旧文件一起删
if (artifacts.geometry) writeFileSync(join(out, 'geometry.json'), JSON.stringify(artifacts.geometry))
else rmSync(join(out, 'geometry.json'), { force: true })
for (const w of proseWarnings('_showcase', artifacts.prose)) console.log(`  ${yellow('⚠')} ${w}`)
console.log(`${green('✓')} ${bold('_showcase')} ${dim(`← ${id}，${artifacts.prose.length} 处正文命中需过目`)}`)
