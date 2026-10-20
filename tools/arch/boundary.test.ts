import { describe, expect, it } from 'vitest'
import { importsOf, isNodeBuiltin, isTestPath, resolveRelative, sources } from './sources.ts'

/**
 * 分层边界：谁能 import 谁。typecheck 不拦这些 —— 比如 `@jjj/datadir` 是 @jjj/web 的 devDependency
 * （vite 插件要用），apps/web/src 里 import 它照样编译通过，到浏览器才因为 node:fs 炸掉。
 *
 * 每一层写明：能用哪些工作区包（只认包名本身，子路径一律不许 —— `@jjj/tripmd/test-support` 因此进不了生产代码）、
 * 能不能碰 node、相对 import 能不能出本层目录。任何一层都不许 import 测试目录里的东西。
 */

interface Layer {
  name: string
  paths: string[]
  workspace: string[]
  /** 能否使用 node 内建模块与 process / Buffer 等全局 */
  node: boolean
  /** 相对 import 必须留在 paths[0] 之内（浏览器端的包不许绕过包入口去拿别人的源码） */
  contained: boolean
}

const LAYERS: Layer[] = [
  { name: 'schema', paths: ['packages/schema/src'], workspace: [], node: false, contained: true },
  { name: 'tripmd', paths: ['packages/tripmd/src'], workspace: ['@jjj/schema'], node: false, contained: true },
  {
    name: 'web 浏览器端',
    paths: ['apps/web/src'],
    workspace: ['@jjj/schema', '@jjj/tripmd'],
    node: false,
    contained: true,
  },
  {
    name: 'datadir',
    paths: ['packages/datadir/src'],
    workspace: ['@jjj/schema', '@jjj/tripmd'],
    node: true,
    contained: true,
  },
  {
    name: 'vite 插件',
    paths: ['apps/web/vite', 'apps/web/vite.config.ts'],
    workspace: ['@jjj/schema', '@jjj/tripmd', '@jjj/datadir'],
    node: true,
    contained: false,
  },
  {
    name: 'tools',
    paths: ['tools'],
    workspace: ['@jjj/schema', '@jjj/tripmd', '@jjj/datadir'],
    node: true,
    contained: false,
  },
]

/** 浏览器里没有的 node 全局 */
const NODE_GLOBALS = /\b(process|Buffer|__dirname|__filename)\b|\brequire\s*\(/

function violations(layer: Layer): string[] {
  const files = sources(...layer.paths)
  if (files.length === 0) return [`${layer.paths.join(', ')} 下没有源码 —— 目录搬家了？这一层的边界没在检查`]
  const out: string[] = []
  for (const f of files) {
    for (const spec of importsOf(f.code)) {
      const target = resolveRelative(f.path, spec)
      if (target !== null) {
        if (isTestPath(target)) out.push(`${f.path} → ${spec}（测试目录）`)
        else if (layer.contained && !target.startsWith(`${layer.paths[0]}/`)) out.push(`${f.path} → ${spec}（出了本层）`)
      } else if (spec.startsWith('@jjj/')) {
        if (!layer.workspace.includes(spec)) out.push(`${f.path} → ${spec}`)
      } else if (!layer.node && isNodeBuiltin(spec)) {
        out.push(`${f.path} → ${spec}（node 内建）`)
      }
    }
    if (!layer.node) {
      const g = NODE_GLOBALS.exec(f.code)
      if (g) out.push(`${f.path} 用了 node 全局 ${g[0]}`)
    }
  }
  return out
}

describe('分层边界', () => {
  for (const layer of LAYERS) {
    it(`${layer.name} 只 import 允许的东西`, () => {
      expect(violations(layer)).toEqual([])
    })
  }
})
