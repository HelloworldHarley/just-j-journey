/**
 * 诊断信息。
 *
 * 错误信息质量是这套格式能不能用的关键 —— LLM 的输出必然有偏差，
 * 修复循环快不快，取决于报错能不能一眼定位并给出改法。
 * 因此每条诊断都要求：行号 + 说清哪错了 + 尽量给出 hint 怎么改。
 */

export type Severity = 'error' | 'warning'

export interface Diagnostic {
  severity: Severity
  /** 1-based 行号 */
  line: number
  message: string
  /** 修复建议。能给就给 —— 「无效」远不如「是否想写 X」有用 */
  hint?: string
}

export class DiagnosticBag {
  readonly items: Diagnostic[] = []

  error(line: number, message: string, hint?: string): void {
    this.items.push({ severity: 'error', line, message, hint })
  }

  warn(line: number, message: string, hint?: string): void {
    this.items.push({ severity: 'warning', line, message, hint })
  }

  get hasErrors(): boolean {
    return this.items.some((d) => d.severity === 'error')
  }

  get errorCount(): number {
    return this.items.filter((d) => d.severity === 'error').length
  }

  get warningCount(): number {
    return this.items.filter((d) => d.severity === 'warning').length
  }

  sorted(): Diagnostic[] {
    return [...this.items].sort((a, b) => a.line - b.line)
  }
}

/** 编辑距离 —— 用来在枚举值拼错时给出「是否想写 X」。 */
function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i, ...Array<number>(n).fill(0)]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min((cur[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost)
    }
    prev = cur
  }
  return prev[n] ?? Math.max(m, n)
}

/** 在候选集里找最接近的值。距离超过阈值返回 null，避免给出荒唐的建议。 */
export function suggest(input: string, candidates: readonly string[]): string | null {
  const q = input.trim().toLowerCase()
  let best: string | null = null
  let bestD = Infinity
  for (const c of candidates) {
    const d = editDistance(q, c.toLowerCase())
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  const limit = Math.max(2, Math.floor(q.length / 3))
  return best !== null && bestD <= limit ? best : null
}

/**
 * 枚举值建议 —— 把别名也纳入候选，再映射回规范值。
 *
 * 没有这一步的话，"sightseing" 找不到 "sight"（编辑距离 5，超阈值），
 * 但它离别名 "sightseeing" 只有 1。别名表本来就是为了接住 LLM 的习惯写法，
 * 让它同时服务于纠错才算物尽其用。
 */
export function suggestEnum<T extends string>(
  input: string,
  canonical: readonly T[],
  aliases: Record<string, T>,
): T | null {
  const direct = suggest(input, canonical)
  if (direct) return direct as T
  const aliasHit = suggest(input, Object.keys(aliases))
  return aliasHit ? (aliases[aliasHit] ?? null) : null
}

/** 把诊断渲染成终端可读的多行文本。 */
export function formatDiagnostics(file: string, diags: Diagnostic[]): string {
  if (diags.length === 0) return ''
  const width = Math.max(...diags.map((d) => String(d.line).length))
  return diags
    .map((d) => {
      const tag = d.severity === 'error' ? '错误' : '警告'
      const loc = `${file}:${String(d.line).padStart(width)}`
      const head = `${loc}  ${tag}  ${d.message}`
      return d.hint ? `${head}\n${' '.repeat(loc.length + 8)}${d.hint}` : head
    })
    .join('\n')
}
