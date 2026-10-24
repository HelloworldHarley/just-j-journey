/**
 * 全角 → 半角，顺带收敛空白。LLM 中英混排时全角符号很常见。
 * **一切匹配之前先过它**：枚举、时刻、日期、时长、金额 —— 读到的值认不认得，不该取决于输入法。
 * 作者的自由文本（名字、备注、正文）不过它：「，」「：」是作者写的字，不该被改掉。
 */
export function normalizeText(s: string): string {
  return s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
