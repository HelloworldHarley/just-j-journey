/**
 * 只改 frontmatter 里的一个标量键，文件其余部分一个字节不动。
 *
 * 不走 parse → serialize 往返：serialize 会把整份文件重排成规范形态，作者手写的注释、
 * 排版、区块顺序全没了 —— 为了改一行 `visibility` 付这个代价不值。这里做的是文本手术，
 * 改完由调用方再 parse 一遍验收（解析器仍是唯一校验器）。
 *
 * `value` 按原样写进去、不加引号 —— 枚举值（public / private）用不着；需要引号的值调用方自己包。
 * `value` 为 null 表示删掉这一行：缺省值不写，与 serialize 的口径一致。
 */
export function setFrontmatterScalar(md: string, key: string, value: string | null): string {
  const lines = md.split('\n')
  if (lines[0]?.trim() !== '---') throw new Error('缺少 frontmatter：文件必须以 --- 开头')
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  if (end === -1) throw new Error('frontmatter 没有闭合的 ---')

  const isKey = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`)
  const at = lines.findIndex((l, i) => i > 0 && i < end && isKey.test(l))
  const line = value === null ? null : `${key}: ${value}`

  if (at !== -1) {
    if (line === null) lines.splice(at, 1)
    else lines[at] = line
  } else if (line !== null) {
    lines.splice(end, 0, line) // 新键追加在闭合 --- 之前
  }
  return lines.join('\n')
}
