import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { readGeometry, readSpace, readTrip, tripDirs } from '@jjj/datadir'
import { buildManifest, formatDiagnostics, isFixtureId, publicNotices, publicPlan, spaceAssets, type ManifestEntry } from '@jjj/tripmd'
import { ROOT } from './paths.ts'

/**
 * 公开版数据目录的生成 —— `pnpm build:public` 与 `pnpm check:built --public` 共用这一份。
 *
 * 规则链与「能不能发」的判断都在 `@jjj/tripmd` 的 publicPlan，
 * 这里只负责「哪些行程、哪些文件、写到哪」。库函数不打印、不退出：失败抛 Error，CLI 决定怎么报。
 */

/** 公开版的临时数据目录（gitignored）。留在仓库里而不用系统 tmp，出问题时直接翻 */
export const STAGE_DIR = join(ROOT, 'apps/web/.public-data')

export interface StagedTrip {
  id: string
  /** 正文命中与 hide 提醒，publish 逐行打印 */
  notices: string[]
  /** 过滤后还剩多少条路线 / 原来多少条 */
  routes: { kept: number; total: number }
}

export interface StageResult {
  staged: StagedTrip[]
  /** 因为不是 public 而跳过的目录 */
  skipped: string[]
}

/**
 * 把数据目录变成公开版数据目录：
 *   visibility: public 的行程 → publicPlan → plan.md + 过滤后的 geometry.json
 *   space.md + 名片引用的本地文件（头像、打赏二维码 —— 二维码本来就是给别人扫的）原样拷
 *   manifest 重生成；**不生成** calendar.ics；`_` 前缀目录一律不收（示范 / 负向样本）
 * 解析失败或抹净断言命中 → 抛 Error，stage 目录留着现场。
 */
export function stagePublic(src: string, stage: string): StageResult {
  const dirs = tripDirs(src) // 数据目录不存在在这里就抛，带可读的消息
  rmSync(stage, { recursive: true, force: true })
  mkdirSync(stage, { recursive: true })
  const staged: StagedTrip[] = []
  const skipped: string[] = []
  const entries: ManifestEntry[] = []

  for (const id of dirs) {
    if (isFixtureId(id)) continue
    const read = readTrip(src, id)
    if (!read) continue
    if (!read.trip) throw new Error(`${read.label} 解析失败：\n${formatDiagnostics(read.label, read.diagnostics)}`)
    if (read.trip.visibility !== 'public') {
      skipped.push(id)
      continue
    }
    const raw = readGeometry(src, id)
    const plan = publicPlan(read.trip, { geometry: raw, label: id })
    if (plan.problem) throw new Error(plan.problem)
    const { md, geometry } = plan
    mkdirSync(join(stage, id), { recursive: true })
    writeFileSync(join(stage, id, 'plan.md'), md)
    if (geometry) writeFileSync(join(stage, id, 'geometry.json'), JSON.stringify(geometry))
    const total = raw ? Object.keys((raw as { routes?: object }).routes ?? {}).length : 0
    staged.push({ id, notices: publicNotices(id, plan), routes: { kept: geometry ? Object.keys(geometry.routes).length : 0, total } })
    entries.push({ id, visibility: 'public' })
  }

  writeFileSync(join(stage, 'manifest.json'), JSON.stringify(buildManifest(entries), null, 2) + '\n')

  // 个人空间名片：公开版与完整版共用同一份，区别只在列出的行程
  const space = readSpace(src)
  if (space) {
    cpSync(join(src, 'space.md'), join(stage, 'space.md'))
    // spaceAssets 的路径在解析时已经规范化、校验过不越界（parseSpace），这里拼上去是安全的
    for (const f of space.space ? spaceAssets(space.space) : []) {
      const from = join(src, f)
      if (!existsSync(from)) continue // data:check 已经拦过缺文件，这里只管拷
      mkdirSync(dirname(join(stage, f)), { recursive: true })
      cpSync(from, join(stage, f))
    }
  }
  return { staged, skipped }
}

