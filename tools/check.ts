#!/usr/bin/env tsx
/**
 * 质检门 + manifest 维护。单工件架构下唯一的数据 CLI。
 *
 *   pnpm data:check              校验全部行程 + 更新 manifest.json
 *   pnpm data:check <dir>        只校验一个（含 _ 前缀目录）
 *
 * 注意它**不再生成任何展示用数据** —— 浏览器直接 fetch plan.md 现场解析，
 * 不存在"忘了重新导入"这回事。这里只做两件事：
 *   1. CI / 提交前把关：错误退出码非零
 *   2. 维护 manifest.json（首页需要知道有哪些行程；_ 前缀目录不入册）
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, formatDiagnostics, mergeGeometry, summarize } from '@jjj/tripmd'
import type { Trip } from '@jjj/schema'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const DATA = join(ROOT, 'apps/web/public/data')

const only = process.argv[2]

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`
const red = (s: string) => `\x1b[31m${s}\x1b[0m`
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`
const green = (s: string) => `\x1b[32m${s}\x1b[0m`
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`

const dirs = readdirSync(DATA)
  .filter((d) => !d.startsWith('.') && statSync(join(DATA, d)).isDirectory())
  .filter((d) => (only ? d === only : true))
  .sort()

if (dirs.length === 0) {
  console.error(red(only ? `找不到行程 "${only}"` : 'data 下没有任何行程目录'))
  process.exit(1)
}

let failed = 0
const manifest: string[] = []

for (const dir of dirs) {
  const mdPath = join(DATA, dir, 'plan.md')
  if (!existsSync(mdPath)) {
    console.error(red(`${dir}: 缺少 plan.md`))
    failed++
    continue
  }

  const rel = `data/${dir}/plan.md`
  const { trip, diagnostics } = parse(readFileSync(mdPath, 'utf8'))
  const errors = diagnostics.filter((d) => d.severity === 'error')
  const warnings = diagnostics.filter((d) => d.severity === 'warning')

  // _broken 是故意写坏的诊断样本：它必须失败，失败了才算过
  if (dir === '_broken') {
    if (errors.length > 0) {
      console.log(`${green('✓')} ${bold(dir)} ${dim(`按预期报出 ${errors.length} 个错误`)}`)
    } else {
      console.error(red(`✗ ${dir} 应该报错却通过了 —— 诊断能力退化`))
      failed++
    }
    continue
  }

  if (diagnostics.length > 0) {
    console.log(formatDiagnostics(rel, diagnostics))
  }
  if (!trip) {
    console.error(red(`✗ ${dir}  ${errors.length} 个错误`))
    failed++
    continue
  }

  const s = summarize(trip)
  const warnTag = warnings.length > 0 ? yellow(` ${warnings.length} 警告`) : ''
  console.log(
    `${green('✓')} ${bold(dir)}${warnTag} ${dim(
      `${s.dayCount} 天 · ${s.eventCount} 事件 · ${s.bookingCount} 待订`,
    )}`,
  )
  geometryHealth(dir, trip)
  if (!dir.startsWith('_')) manifest.push(dir)
}

/**
 * geometry.json 的体检行 —— 方案 B（polyline 存旁路文件）主要风险的对冲。
 *
 * 派生文件会与 plan.md 脱节，而脱节的表现是「地图默默画回直线」，无声无息。
 * 这一行把它变得可见。**失效不算错误、不影响退出码**：回退本来就是设计内的行为，
 * 这里只是告诉你有多少段没走真路、该不该重跑 enrich。
 */
function geometryHealth(dir: string, trip: Trip): void {
  const path = join(DATA, dir, 'geometry.json')
  if (!existsSync(path)) return // 没跑过 enrich 的行程就是没有，不是问题

  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    console.log(`  ${yellow('⚠')} ${dim('geometry.json 不是合法 JSON，整份忽略 —— 全部回退直线')}`)
    return
  }

  // mergeGeometry 会就地写 trip，这里只要计数；trip 在这个循环之后就不再用了
  const r = mergeGeometry(trip, raw)
  if (!r) {
    console.log(`  ${yellow('⚠')} ${dim('geometry.json 版本或结构不认识，整份忽略 —— 全部回退直线')}`)
    return
  }
  const bad = [
    r.stale > 0 ? `${r.stale} 条坐标对不上` : '',
    r.broken > 0 ? `${r.broken} 条解不开` : '',
    r.orphan > 0 ? `${r.orphan} 条无人认领` : '',
  ].filter(Boolean)
  const tail = bad.length > 0 ? yellow(`（${bad.join(' · ')}，均回退直线，跑 pnpm enrich ${dir} 重算）`) : ''
  console.log(`  ${dim(`路线 ${r.used}/${r.needed} 有效`)} ${tail}`)
}

// 全量跑的时候顺手把 manifest 对齐 —— 新增行程 = 建目录 + 跑一次 check
if (!only && failed === 0) {
  writeFileSync(join(DATA, 'manifest.json'), JSON.stringify({ trips: manifest }, null, 2) + '\n')
  console.log(dim(`\nmanifest.json ← [${manifest.join(', ')}]`))
}

process.exit(failed > 0 ? 1 : 0)
