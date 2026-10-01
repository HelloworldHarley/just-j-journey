import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 浏览器代码的边界 —— 这条规矩此前只写在注释里，typecheck 不拦：
 * `@jjj/datadir` 是 @jjj/web 的 devDependency（vite 插件要用），apps/web/src 下任何文件都能 import 它，
 * 编译照过，到浏览器里才因为 node:fs 炸掉。这里把边界变成会红的断言。
 * 允许的例外只有测试文件自己（它们跑在 node 里）。
 */
const SRC = join(import.meta.dirname, '.')
const FORBIDDEN = [/from ['"]@jjj\/datadir['"]/, /from ['"]node:/]

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name)
    if (d.isDirectory()) return walk(p)
    return /\.(ts|tsx)$/.test(d.name) && !/\.test\.tsx?$/.test(d.name) ? [p] : []
  })
}

describe('浏览器代码不碰 node', () => {
  it('apps/web/src 下没有任何文件 import @jjj/datadir 或 node: 内建模块', () => {
    const offenders = walk(SRC).filter((f) => FORBIDDEN.some((re) => re.test(readFileSync(f, 'utf8'))))
    expect(offenders.map((f) => f.slice(SRC.length + 1))).toEqual([])
  })
})
