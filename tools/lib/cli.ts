/** 终端着色、致命退出、等待 —— CLI 原先各抄一份，现在只有这一份 */
export const dim = (s: string): string => `\x1b[2m${s}\x1b[0m`
export const red = (s: string): string => `\x1b[31m${s}\x1b[0m`
export const yellow = (s: string): string => `\x1b[33m${s}\x1b[0m`
export const green = (s: string): string => `\x1b[32m${s}\x1b[0m`
export const bold = (s: string): string => `\x1b[1m${s}\x1b[0m`

// 函数声明而非箭头常量：只有这样 TS 才认它「不返回」，`if (!x) die()` 之后 x 才收窄
export function die(msg: string): never {
  console.error(red(msg))
  process.exit(1)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
