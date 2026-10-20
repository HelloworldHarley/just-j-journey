import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * 测试用的临时数据目录 —— 用到文件系统的测试（datadir、vite 插件、暂存公开版）都从这里搭。
 *
 * 目录树写成一张表，一眼看出这份数据目录长什么样，不再是一串 mkdir / writeFile。
 * 返回的根已经 realpath 过：macOS 的临时目录在 /var 下，而 /var 是 /private/var 的链接，
 * 被测代码处处 realpath，不解开就会把自己的临时目录误判成「指到目录外的链接」。
 *
 * 浏览器之外的测试经 `@jjj/datadir/test-support` 引用；只给测试用，`tools/arch/boundary.test.ts` 锁住生产代码不许引它。
 */

/** 空目录（有文件的目录不用写，写文件时自动建出上级） */
export const DIR = { dir: true } as const

/** 表里的一项：字符串 = 文件内容；`DIR` = 空目录；`{ link }` = 指向 link 的符号链接（目标可以不存在） */
export type Entry = string | typeof DIR | { link: string }

/** 新建一个临时目录，按表写好内容，返回它的真实路径 */
export function tempTree(name: string, tree: Record<string, Entry> = {}): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), `jjj-${name}-`)))
  writeTree(root, tree)
  return root
}

/** 在已有目录里按表补写内容；键是相对路径 */
export function writeTree(root: string, tree: Record<string, Entry>): void {
  for (const [rel, entry] of Object.entries(tree)) {
    const path = join(root, rel)
    if (typeof entry !== 'string' && 'dir' in entry) {
      mkdirSync(path, { recursive: true })
      continue
    }
    mkdirSync(dirname(path), { recursive: true })
    if (typeof entry === 'string') writeFileSync(path, entry)
    else symlinkSync(entry.link, path)
  }
}

/** 删掉测试建的临时目录 */
export function removeTrees(...roots: string[]): void {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
}
