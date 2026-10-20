#!/usr/bin/env tsx
/**
 * 从数据目录里的一份真行程重生成示范行程 —— 抹除后的公开版副本，工具仓库唯一的「真实规模」样本。
 *
 *   JJJ_DATA_DIR=../just-j-journey-personal-space/trips pnpm showcase:refresh seattle-2026-10
 *
 * 给 fork 的人看、也是 sanitize 的回归 fixture：roundtrip / patch 测试吃它。重跑后 git diff 一眼看出抹没抹干净。
 * id 固定为 SHOWCASE_ID（目录名 = id 是首页路由的约定），不带 `_`：它入册、随 CI 部署，就是演示站的内容。
 * 目标永远是工具仓库自己的 apps/web/public/data，不跟 JJJ_DATA_DIR 走 —— 示范数据属于代码，
 * 来源那份真行程在数据仓库里（迁移第 4 步之后工具仓库不再有真行程）。
 */
import { mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_DATA_DIR, dataDir, readGeometry, readTrip } from '@jjj/datadir'
import { formatDiagnostics, publicNotices, publicPlan } from '@jjj/tripmd'
import { bold, die, dim, green, yellow } from './lib/cli.ts'

/** 示范行程的 id / 目录名。改它要同步改 roundtrip / patch 测试里的路径 */
const SHOWCASE_ID = 'showcase-seattle-2026-10'
const TITLE_PREFIX = '公开示范 · '

const id = process.argv[2]
if (!id) die('用法：JJJ_DATA_DIR=<数据目录> pnpm showcase:refresh <行程目录>')
const src = dataDir()
if (realpathSync(src) === realpathSync(DEFAULT_DATA_DIR)) die('示范行程的来源是数据仓库里的真行程，要带 JJJ_DATA_DIR（工具仓库自带的数据目录里没有真行程）')
const out = join(DEFAULT_DATA_DIR, SHOWCASE_ID)

const read = readTrip(src, id)
if (!read) die(`找不到 ${id}/plan.md（数据目录 ${src}）`)
const { trip, diagnostics, label } = read
if (!trip) die(formatDiagnostics(label, diagnostics))
// 来源必须是完整版：拿示范行程自己当来源，标题会叠成「公开示范 · 公开示范 · …」，而且没有任何东西可抹
if (trip.id === SHOWCASE_ID || trip.title.startsWith(TITLE_PREFIX)) die(`${id} 已经是示范行程，来源要用数据仓库里的完整版`)

// 改的是**来源**而不是抹完的结果：id / 标题这些字段 sanitize 原样放行，走同一条规则链就不用开后门。
// 标题加**前缀**：演示站的读者要一眼知道这是示范而不是作者本人的行程；dev 里同时指着数据仓库看时，
// 也要和真行程区分开。首页卡片不显示 subtitle，而标题在 390px 上会截断 —— 区分词放后面等于没放
const source = {
  ...trip,
  id: SHOWCASE_ID,
  title: `${TITLE_PREFIX}${trip.title}`,
  subtitle: '公开示范 · 抹除敏感信息后的真实行程',
  visibility: 'public' as const,
}
const artifacts = publicPlan(source, { geometry: readGeometry(src, id), label: SHOWCASE_ID })
if (artifacts.problem) die(artifacts.problem)

mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'plan.md'), artifacts.md)
// 路网只带对得上的那部分（民宿那几段自然掉了）；一条都不剩就连旧文件一起删
if (artifacts.geometry) writeFileSync(join(out, 'geometry.json'), JSON.stringify(artifacts.geometry))
else rmSync(join(out, 'geometry.json'), { force: true })
const notices = publicNotices(SHOWCASE_ID, artifacts)
for (const w of notices) console.log(`  ${yellow('⚠')} ${w}`)
console.log(`${green('✓')} ${bold(SHOWCASE_ID)} ${dim(`← ${id}，${notices.length} 条提醒需过目`)}`)
