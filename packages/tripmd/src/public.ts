import type { Trip } from '@jjj/schema'
import { findLeaks, type Leak } from './leaks.ts'
import { parse } from './parse.ts'
import { sanitize } from './sanitize.ts'
import { serialize } from './serialize.ts'
import type { Diagnostic } from './diagnostics.ts'

/**
 * 一份行程的公开版 —— 规则链只此一条：sanitize → serialize → **再 parse 验收** → 抹净断言。
 *
 * `build:public` 落盘、`showcase:refresh` 重生成示范、公开版 dev 逐请求现算，三处都得走完整条链，
 * 否则 dev 里看着干净的行程可能在 CI 里被抹净断言拦下（或者反过来）。此前 dev 只跑了前两步。
 * 纯函数：不打印、不退出，结果全在返回值里，调用方决定是 die 还是回 500。
 */
export interface PublicPlan {
  /** 公开版 plan.md 文本 */
  md: string
  /** 重新解析出来的公开版 Trip；解析不过时为 null，此时 md 不该发出去 */
  trip: Trip | null
  /** 再 parse 的诊断 */
  diagnostics: Diagnostic[]
  /** 结构块里的命中 —— 一条都不能有，有就是 sanitize 漏了字段 */
  fatal: Leak[]
  /** 正文里的命中 —— 正文按设计不抹，只提醒 */
  prose: Leak[]
}

export function publicPlan(source: Trip): PublicPlan {
  const md = serialize(sanitize(source))
  const { trip, diagnostics } = parse(md)
  const leaks = findLeaks(md, source)
  return { md, trip, diagnostics, fatal: leaks.filter((l) => l.inFence), prose: leaks.filter((l) => !l.inFence) }
}
