import type { Cost } from '@jjj/schema'
import { normalizeText } from './values.ts'

/**
 * 从自由文本里抽取金额。
 *
 * 作者（人或 LLM）写 "约 $70/人"、"$49 × 2 = $98"、"¥3000/人" 这类自然语言，
 * 这里负责把它变成可统计的数字。规则刻意保守：**宁可抽不出（不进统计），
 * 也不要抽错**（预算页上一个错数字比缺一个数字糟得多）。
 */

const CURRENCY_SIGNS: Record<string, string> = {
  $: 'USD',
  '￥': 'CNY',
  '¥': 'JPY', // 上下文里 ¥ 也可能是人民币；由 frontmatter 的 currency 兜底纠正
  '€': 'EUR',
  '£': 'GBP',
  '₩': 'KRW',
}

interface Money {
  amount: number
  currency?: string
}

/** 匹配一个金额："$70" / "¥3,000" / "70 USD"。 */
const MONEY_RE = /([$￥¥€£₩])\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(USD|CNY|JPY|EUR|GBP|KRW|美元|日元|欧元)/g

const CODE_OF_WORD: Record<string, string> = { 美元: 'USD', 日元: 'JPY', 欧元: 'EUR' }

function findMoney(text: string): Money[] {
  const out: Money[] = []
  for (const m of text.matchAll(MONEY_RE)) {
    const num = Number((m[2] ?? m[3] ?? '').replace(/,/g, ''))
    if (!Number.isFinite(num) || num <= 0) continue
    const currency = m[1] ? CURRENCY_SIGNS[m[1]] : (CODE_OF_WORD[m[4] ?? ''] ?? m[4])
    out.push({ amount: num, currency })
  }
  return out
}

export function parseCost(rawInput: string, travelers: number, defaultCurrency?: string): Cost {
  const raw = String(rawInput).trim()
  const text = normalizeText(raw)
  const optional = /可选|optional/i.test(text)

  const monies = findMoney(text)
  if (monies.length === 0) {
    return { raw, amount: null, currency: undefined, optional }
  }

  // "$49 × 2 = $98" 这种带等号的，等号后面就是总额，直接用
  const eqIdx = text.search(/[=＝]/)
  if (eqIdx >= 0) {
    const after = findMoney(text.slice(eqIdx))
    const total = after[after.length - 1]
    if (total) {
      return { raw, amount: total.amount, currency: total.currency ?? defaultCurrency, optional }
    }
  }

  // 区间 "$250–400"：取中值 —— 预算是估计，中值比上限诚实
  const range = /([$￥¥€£₩])\s*([\d,]+)\s*[-–—~]\s*(?:[$￥¥€£₩]\s*)?([\d,]+)/.exec(text)
  if (range) {
    const lo = Number((range[2] ?? '').replace(/,/g, ''))
    const hi = Number((range[3] ?? '').replace(/,/g, ''))
    if (Number.isFinite(lo) && Number.isFinite(hi) && hi >= lo) {
      const perHead = /[/每]\s*人/.test(text)
      const mid = (lo + hi) / 2
      return {
        raw,
        amount: Math.round(perHead ? mid * travelers : mid),
        currency: CURRENCY_SIGNS[range[1] ?? ''] ?? defaultCurrency,
        optional,
      }
    }
  }

  const first = monies[0] as Money
  // "× 2" / "x2" 乘数
  const mult = /[×xX*]\s*(\d+)/.exec(text)
  if (mult) {
    return {
      raw,
      amount: first.amount * Number(mult[1]),
      currency: first.currency ?? defaultCurrency,
      optional,
    }
  }

  // "/人" "每人" → 乘人数
  if (/[/每]\s*人/.test(text)) {
    return {
      raw,
      amount: first.amount * travelers,
      currency: first.currency ?? defaultCurrency,
      optional,
    }
  }

  return { raw, amount: first.amount, currency: first.currency ?? defaultCurrency, optional }
}

/** 正文按「首段 / 其余」切分。首段 = 第一个空行之前。 */
export function splitBody(body: string): { summary: string; detail: string } {
  const trimmed = body.trim()
  if (!trimmed) return { summary: '', detail: '' }
  const idx = trimmed.search(/\n\s*\n/)
  if (idx < 0) return { summary: trimmed, detail: '' }
  return { summary: trimmed.slice(0, idx).trim(), detail: trimmed.slice(idx).trim() }
}
