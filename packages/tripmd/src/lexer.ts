/**
 * 行式扫描器：把 TripMD 切成带行号的 token。
 *
 * 只做词法，不懂语义。关键职责是**正确吃掉围栏代码块** ——
 * 附录里可能有普通的 ``` 代码块，不能被当成 trip-* 结构块，
 * 也不能让里面的 ## 被误认成章节标题。
 */

export type Token =
  | { kind: 'frontmatter'; line: number; yaml: string }
  | { kind: 'heading'; line: number; level: number; text: string }
  | { kind: 'fence'; line: number; info: string; content: string; raw: string }
  | { kind: 'line'; line: number; text: string }

const FENCE_RE = /^(\s*)(`{3,}|~{3,})\s*(.*)$/

export function lex(src: string): Token[] {
  // 统一换行符；BOM 会让 frontmatter 的 --- 匹配失败，先剥掉
  const lines = src.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n')
  const tokens: Token[] = []
  let i = 0

  // ── frontmatter：仅当文件第一行就是 --- 时成立 ──
  if (lines[0]?.trim() === '---') {
    let end = -1
    for (let j = 1; j < lines.length; j++) {
      if (lines[j]?.trim() === '---') {
        end = j
        break
      }
    }
    if (end > 0) {
      tokens.push({ kind: 'frontmatter', line: 2, yaml: lines.slice(1, end).join('\n') })
      i = end + 1
    }
  }

  for (; i < lines.length; i++) {
    const text = lines[i] ?? ''
    const lineNo = i + 1

    const fence = FENCE_RE.exec(text)
    if (fence) {
      const indent = fence[1] ?? ''
      const marker = fence[2] ?? '```'
      const info = (fence[3] ?? '').trim()
      const closeRe = new RegExp(`^\\s*${marker[0] === '`' ? '`' : '~'}{${marker.length},}\\s*$`)
      const body: string[] = []
      let closed = false
      let j = i + 1
      for (; j < lines.length; j++) {
        const cur = lines[j] ?? ''
        if (closeRe.test(cur)) {
          closed = true
          break
        }
        body.push(cur)
      }
      const raw = closed
        ? lines.slice(i, j + 1).join('\n')
        : lines.slice(i).join('\n')
      tokens.push({ kind: 'fence', line: lineNo, info, content: body.join('\n'), raw })
      i = closed ? j : lines.length
      void indent
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(text)
    if (heading) {
      tokens.push({
        kind: 'heading',
        line: lineNo,
        level: (heading[1] ?? '#').length,
        text: (heading[2] ?? '').trim(),
      })
      continue
    }

    tokens.push({ kind: 'line', line: lineNo, text })
  }

  return tokens
}

/** 把连续的 line/fence token 还原成 Markdown 正文，并裁掉首尾空行。 */
export function proseOf(tokens: Token[]): string {
  const out: string[] = []
  for (const t of tokens) {
    if (t.kind === 'line') out.push(t.text)
    else if (t.kind === 'fence') out.push(t.raw)
    else if (t.kind === 'heading') out.push(`${'#'.repeat(t.level)} ${t.text}`)
  }
  return out.join('\n').replace(/^\s*\n+/, '').replace(/\n+\s*$/, '')
}
