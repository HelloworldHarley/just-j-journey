import type { Trip } from '@jjj/schema'
import { lex } from './lexer.ts'

/**
 * 抹净断言 —— 拿完整版里**该被抹掉的值**当黑名单，逐个在公开版文本里找。
 *
 * 黑名单从 Trip 现算，不写死任何真值（工具仓库是公开的，真值不能进测试或代码）。
 * 只收足够特异的字段：票价 / 班次号 / 座位 / 预订金额 / 长途备注 / 民宿英文名、备注、精确坐标 / 硬约束的 label 与 note。
 * carrier、cabin、baggage、refund 这种通用词（「达美」「1 件」）正文里合法出现太多，不进黑名单。
 *
 * 结构块（```trip-* 围栏）里的命中 = sanitize 漏了，致命；正文里的命中只警告 ——
 * 正文按设计不抹，附录预算表里出现票价是作者自己决定要公开的。
 */
export interface Leak {
  value: string
  /** 公开版文本里的 1-based 行号 */
  line: number
  /** 命中发生在 ```trip-* 结构块里 */
  inFence: boolean
}

export function sensitiveValues(trip: Trip): string[] {
  const out = new Set<string>()
  const add = (v: string | undefined): void => {
    const s = v?.trim()
    if (s && s.length >= 3) out.add(s)
  }
  // 金额另加一份裸数字（"$339.42" → "339.42"，"$715" → "715"），免得换个货币写法漏网。
  // 逗号分组的整数（"¥11,220"）再多加一份去逗号形式（"11220"）——
  // 否则 {3,} 只会从 "11,220" 里抠出结尾的 "220"，几乎没有特异性，白白进黑名单添噪音。
  // **只对金额做**：备注、班次里的数字（"确认号 ABC123" → "123"）到处都能撞上，会把扫描变成噪音
  const addMoney = (v: string | undefined): void => {
    add(v)
    const m = v ? /\d[\d,]*\.\d+|\d[\d,]{2,}/.exec(v) : null
    if (!m) return
    if (m[0] !== v) add(m[0])
    if (m[0].includes(',')) add(m[0].replace(/,/g, ''))
  }
  for (const j of trip.journeys) {
    addMoney(j.cost?.raw)
    for (const t of j.transports) {
      addMoney(t.price)
      add(t.number)
      add(t.seat)
      add(t.note)
      for (const l of t.legs) {
        add(l.number)
        add(l.seat)
      }
    }
  }
  for (const r of [...trip.stays, ...trip.rentals]) addMoney(r.cost?.raw)
  for (const p of trip.places) {
    if (p.category !== 'homestay') continue
    add(p.nameEn)
    add(p.note)
    add(p.url)
    add(p.gmapsPlaceId)
    if (p.coord) add(`${p.coord[1]}, ${p.coord[0]}`) // 作者格式：纬度在前
  }
  return [...out]
}

/**
 * 硬约束的 label / note —— 作者往这里写的恰恰是确认号、值机码、门锁密码。
 * 单独成一张名单，因为它是自由文本：「派克市场」「AC Hotel」这样的 label 与地点名撞上很正常。
 * 所以只在两处查：`trip-constraints` 围栏里（出现就说明 sanitize 没把整块丢掉，致命）和正文里（提醒）；
 * 别的结构块里不查，免得一个与地点同名的 label 把构建打挂
 */
export function constraintValues(trip: Trip): string[] {
  return [...new Set(trip.constraints.flatMap((c) => [c.label, c.note]).map((v) => v?.trim()).filter((v): v is string => Boolean(v && v.length >= 3)))]
}

export function findLeaks(publicMd: string, source: Trip): Leak[] {
  const values = sensitiveValues(source)
  const withConstraints = [...values, ...constraintValues(source)]
  const leaks: Leak[] = []
  // 逐行扫描：命中即记一条 Leak，line 是该行在公开版文本里的 1-based 行号
  const scan = (lines: string[], startLine: number, inFence: boolean, list = withConstraints): void => {
    lines.forEach((text, i) => {
      for (const v of list) if (text.includes(v)) leaks.push({ value: v, line: startLine + i, inFence })
    })
  }
  // 复用词法扫描器（lexer.ts）而不是自己重新数 ``` / ~~~，
  // 这样附录里普通代码块（```/~~~，包括长度更长的围栏、或恰好写着字面 "```trip-" 的示例文本）
  // 不会被误当成结构块 —— lex() 已经处理了标记长度匹配和嵌套围栏这些坑
  for (const tok of lex(publicMd)) {
    if (tok.kind === 'frontmatter') continue // frontmatter 从不装黑名单字段，跳过
    else if (tok.kind === 'line') scan([tok.text], tok.line, false)
    else if (tok.kind === 'heading') scan([`${'#'.repeat(tok.level)} ${tok.text}`], tok.line, false)
    else if (tok.kind === 'fence' && tok.info.startsWith('trip-')) {
      scan(tok.content.split('\n'), tok.line + 1, true, tok.info === 'trip-constraints' ? withConstraints : values)
    }
    else scan(tok.raw.split('\n'), tok.line, false)
  }
  return leaks
}
