import { describe, expect, it } from 'vitest'
import { sources } from './sources.ts'

/**
 * 规则归位锁：每条规则只能写在它的唯一归属里。
 *
 * 一行一条：规则在代码里长什么样（pattern，匹配去掉注释后的源码）、在哪些目录里找、唯一允许出现的文件。
 * 断言是「命中的文件 == home」—— 别处冒出副本会红，归属文件里规则被改名或搬走（锁随之失效）也会红。
 * 把一条规则归位后，在这里加一行；旧位置的副本必须先删掉，否则这一行加不进来。
 */

interface Lock {
  rule: string
  pattern: RegExp
  scope: string[]
  home: string[]
}

const ALL_CODE = ['packages', 'apps/web/src', 'apps/web/vite', 'apps/web/vite.config.ts', 'tools']

const LOCKS: Lock[] = [
  {
    rule: '是不是公开构建，浏览器端只在一处读',
    pattern: /VITE_PUBLIC/,
    scope: ['apps/web/src'],
    home: ['apps/web/src/lib/public.ts'],
  },
  {
    rule: '日期字符串交给 Date 只在 tripmd 的 UTC 锚定函数里发生',
    pattern: /new Date\(\s*[^\s)]/,
    scope: ALL_CODE,
    home: ['packages/tripmd/src/values.ts'],
  },
  {
    rule: '首次引用 / 重复提及只有一个扫描',
    pattern: /\b(function|const|let)\s+detailIndex\b/,
    scope: ALL_CODE,
    home: ['packages/tripmd/src/resolve.ts'],
  },
]

describe('规则只写在一处', () => {
  for (const lock of LOCKS) {
    it(lock.rule, () => {
      const hits = sources(...lock.scope)
        .filter((s) => lock.pattern.test(s.code))
        .map((s) => s.path)
      expect(hits.sort()).toEqual([...lock.home].sort())
    })
  }
})
