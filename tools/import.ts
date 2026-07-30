#!/usr/bin/env tsx
/**
 * TripMD → trip.json
 *
 *   pnpm import                    导入 data/ 下所有行程
 *   pnpm import seattle-2026-10    只导入一个
 *
 * 产物写到 apps/web/public/data/ ，前端直接 fetch。
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, formatDiagnostics } from '@jjj/tripmd'
import { CATEGORIES, type Day, type TripSummary } from '@jjj/schema'

/**
 * 一天的构成 —— 个人空间卡片上那根竖条。
 *
 * 分组分钟数 + 当天跨度。竖条高度按跨度（看得出哪天长哪天短），
 * 内部按分组堆叠（看得出这天是在玩、在吃、还是在赶路）。
 * 比一颗单色圆点信息量大得多，而且不用挑「代表类别」这种主观判断。
 */
function dayShapeOf(day: Day): { play: number; food: number; other: number; span: number } {
  const acc = { play: 0, food: 0, other: 0 }
  for (const e of day.events) {
    // 时间点事件（时长 0）给一个名义值，否则它在条里完全不可见
    acc[CATEGORIES[e.category].group] += Math.max(e.endMin - e.startMin, 15)
  }
  const span =
    day.events.length === 0
      ? 0
      : Math.max(...day.events.map((e) => e.endMin)) - Math.min(...day.events.map((e) => e.startMin))
  return { ...acc, span }
}

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const DATA = join(ROOT, 'data')
const OUT = join(ROOT, 'apps/web/public/data')

const only = process.argv[2]

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`
const red = (s: string) => `\x1b[31m${s}\x1b[0m`
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`
const green = (s: string) => `\x1b[32m${s}\x1b[0m`
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`

if (!existsSync(DATA)) {
  console.error(red(`找不到 data/ 目录：${DATA}`))
  process.exit(1)
}

// `_` 前缀目录（如 _example）不参与全量导入，但可以显式指名单独跑
const dirs = readdirSync(DATA)
  .filter((d) => !d.startsWith('.') && statSync(join(DATA, d)).isDirectory())
  .filter((d) => (only ? d === only : !d.startsWith('_')))
  .sort()

if (dirs.length === 0) {
  console.error(red(only ? `找不到行程 "${only}"` : 'data/ 下没有任何行程目录'))
  process.exit(1)
}

mkdirSync(OUT, { recursive: true })

const summaries: TripSummary[] = []
let failed = 0

for (const dir of dirs) {
  const mdPath = join(DATA, dir, 'plan.md')
  if (!existsSync(mdPath)) {
    console.error(red(`${dir}: 缺少 plan.md`))
    failed++
    continue
  }

  const src = readFileSync(mdPath, 'utf8')
  const rel = `data/${dir}/plan.md`
  const { trip, diagnostics } = parse(src)

  const errors = diagnostics.filter((d) => d.severity === 'error')
  const warnings = diagnostics.filter((d) => d.severity === 'warning')

  if (diagnostics.length > 0) {
    console.log(formatDiagnostics(rel, diagnostics))
    console.log('')
  }

  if (!trip) {
    console.error(red(`✗ ${dir}  ${errors.length} 个错误，未生成`))
    failed++
    continue
  }

  // 以 trip.id 命名而非目录名 —— 前端按 URL 里的 id 去 fetch
  writeFileSync(join(OUT, `${trip.id}.json`), JSON.stringify(trip, null, 2) + '\n')

  const geocoded = trip.places.filter((p) => p.coord !== null).length
  const evCount = trip.days.reduce((n, d) => n + d.events.length, 0)
  const bookingCount = trip.days.reduce(
    (n, d) => n + d.events.filter((e) => e.flags.includes('needs-booking')).length,
    0,
  )

  summaries.push({
    id: trip.id,
    title: trip.title,
    subtitle: trip.subtitle,
    destination: trip.destination,
    dates: trip.dates,
    dayCount: trip.days.length,
    eventCount: evCount,
    bookingCount,
    dayShape: trip.days.map(dayShapeOf),
  })

  const warnTag = warnings.length > 0 ? yellow(` ${warnings.length} 警告`) : ''
  console.log(
    `${green('✓')} ${bold(dir)}${warnTag}\n` +
      dim(
        `    ${trip.days.length} 天 · ${evCount} 事件 · ${trip.places.length} 地点` +
          `（${geocoded} 有坐标）· ${trip.reference.length} 附录`,
      ),
  )
}

if (summaries.length > 0) {
  summaries.sort((a, b) => b.dates.start.localeCompare(a.dates.start))
  writeFileSync(join(OUT, 'index.json'), JSON.stringify({ trips: summaries }, null, 2) + '\n')
  console.log(dim(`\n→ ${OUT}`))
}

process.exit(failed > 0 ? 1 : 0)
