import type { Trip } from '@jjj/schema'
import { formatDiagnostics, type Diagnostic } from './diagnostics.ts'
import { filterGeometry, type GeometryDoc } from './geometry.ts'
import { findLeaks, type Leak } from './leaks.ts'
import { parse } from './parse.ts'
import { hideReminders, sanitize } from './sanitize.ts'
import { serialize } from './serialize.ts'

/**
 * 一份行程的公开版 —— 规则链只此一条：sanitize → serialize → **再 parse 验收** → 抹净断言 → 过滤路网。
 *
 * `build:public` 落盘、`showcase:refresh` 重生成示范、公开版 dev 逐请求现算，三处都调它，
 * 判「能不能发」的口径也在这里（problem），调用方只决定是抛错、退出还是回 500。纯函数：不打印、不读文件。
 */
export interface PublicPlan {
  /** 公开版 plan.md 文本 */
  md: string
  /** 重新解析出来的公开版 Trip；解析不过时为 null */
  trip: Trip | null
  /** 再 parse 的诊断 */
  diagnostics: Diagnostic[]
  /** 结构字段里出现了抹掉的值 —— 一条都不能有 */
  fatal: Leak[]
  /** 正文里、或「只提醒」的自由文本出现了抹掉的值 —— 正文按设计不抹，作者过目即可 */
  warnings: Leak[]
  /** 可能忘了写 hide 的地方，不拦截 */
  reminders: string[]
  /** 用公开版 trip 过滤后的路网缓存（民宿 id 派生自门牌、记录里存着精确坐标，不能原样拷）；没给或一条不剩为 null */
  geometry: GeometryDoc | null
  /** 不能发的原因；null = 可以发 */
  problem: string | null
}

export function publicPlan(source: Trip, opts: { geometry?: unknown; label?: string } = {}): PublicPlan {
  const label = opts.label ?? source.id
  const { trip: redacted, secrets } = sanitize(source)
  const md = serialize(redacted)
  const { trip, diagnostics } = parse(md)
  const leaks = trip ? findLeaks(trip, secrets) : []
  const fatal = leaks.filter((l) => l.fatal)
  return {
    md,
    trip,
    diagnostics,
    fatal,
    warnings: leaks.filter((l) => !l.fatal),
    reminders: hideReminders(source),
    geometry: trip && opts.geometry !== undefined ? filterGeometry(trip, opts.geometry) : null,
    problem: !trip
      ? `${label} 抹除后解析不过：\n${formatDiagnostics(`${label}/plan.md`, diagnostics)}`
      : fatal.length > 0
        ? `${label} 的公开版里仍有抹掉的值：\n` +
          fatal.map((l) => `  ${l.where}：「${l.value}」（完整版里在 ${l.source}）`).join('\n') +
          '\n同一个值在别处又写了一遍就改写那一处；它本该公开就回 packages/tripmd/src/sanitize.ts 改策略表'
        : null,
  }
}

/** 提醒行 —— build:public 与 showcase:refresh 打的是同一句话 */
export function publicNotices(label: string, plan: Pick<PublicPlan, 'warnings' | 'reminders'>): string[] {
  return [
    ...plan.warnings.map((l) => `${label} ${l.where} 出现「${l.value}」（完整版里在 ${l.source}）—— 正文不抹，确认这是你想公开的`),
    ...plan.reminders.map((r) => `${label} ${r}`),
  ]
}
