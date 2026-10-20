import { readdirSync, readFileSync, statSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, join, relative, sep } from 'node:path'
import { ROOT } from '../lib/paths.ts'

/**
 * 架构测试共用的源码扫描：列出生产源码、剥掉注释、抽出 import。
 * 只做字符串层面的扫描 —— 够用来锁「谁能 import 谁」「某条规则只能写在哪」，不当编译器用。
 */

export interface Source {
  /** 仓库相对路径，正斜杠 */
  path: string
  /** 去掉注释后的源码：注释里提到某个名字不算「规则出现在这里」 */
  code: string
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-check', 'dist-public', '.public-data'])

/** 测试不算生产代码：`*.test.ts(x)` 与任何一层叫 `test` 的目录（含 tripmd 的 test/support） */
export function isTestPath(rel: string): boolean {
  return /\.test\.tsx?$/.test(rel) || rel.split('/').includes('test')
}

const toRel = (abs: string): string => relative(ROOT, abs).split(sep).join('/')

/** 给定目录（或单个文件）下的全部生产源码，路径相对仓库根 */
export function sources(...paths: string[]): Source[] {
  const out: Source[] = []
  const visit = (abs: string): void => {
    if (statSync(abs).isDirectory()) {
      for (const d of readdirSync(abs, { withFileTypes: true })) {
        if (!SKIP_DIRS.has(d.name)) visit(join(abs, d.name))
      }
      return
    }
    const rel = toRel(abs)
    if (/\.tsx?$/.test(rel) && !isTestPath(rel)) {
      out.push({ path: rel, code: stripComments(readFileSync(abs, 'utf8')) })
    }
  }
  for (const p of paths) visit(join(ROOT, p))
  return out
}

/**
 * 去掉 `//` 与 `/* … *\/` 注释，字符串原样保留（URL 里的 `//` 不是注释）。
 * 单双引号字符串不跨行：碰到换行就当它结束 —— 正则字面量里的引号最多让这一行认错，不会一路错到文件尾。
 */
export function stripComments(src: string): string {
  let out = ''
  let quote: string | null = null
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    if (quote) {
      out += c
      if (c === '\\') out += src[++i] ?? ''
      else if (c === quote || (c === '\n' && quote !== '`')) quote = null
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
      out += '\n'
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      const body = src.slice(i, end < 0 ? src.length : end + 2)
      out += body.replace(/[^\n]/g, '') // 留住换行，行号不变
      i += body.length - 1
      continue
    }
    if (c === "'" || c === '"' || c === '`') quote = c
    out += c
  }
  return out
}

const IMPORT_RES = [
  /\bfrom\s*['"]([^'"]+)['"]/g, // import … from / export … from
  /\bimport\s*\(\s*['"`]([^'"`]+)['"`]/g, // import('…')
  /\bimport\s+['"]([^'"]+)['"]/g, // import '…'（只为副作用）
  /\brequire\s*\(\s*['"]([^'"]+)['"]/g,
]

/** 一份源码引用的全部模块说明符 */
export function importsOf(code: string): string[] {
  return IMPORT_RES.flatMap((re) => [...code.matchAll(re)].map((m) => m[1]!))
}

/** `node:fs`、`fs`、`fs/promises` 都算 node 内建 */
export function isNodeBuiltin(spec: string): boolean {
  return spec.startsWith('node:') || builtinModules.includes(spec.split('/')[0]!)
}

/** 相对说明符解析成仓库相对路径；非相对的原样返回 null */
export function resolveRelative(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null
  return toRel(join(ROOT, dirname(from), spec))
}
