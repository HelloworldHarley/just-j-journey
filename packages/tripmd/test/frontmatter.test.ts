import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from '../src/parse.ts'
import { setFrontmatterScalar } from '../src/frontmatter.ts'

/**
 * 首页「公开 / 私有」开关走的写路径：只动 frontmatter 一行，文件其余字节不变。
 * 用真 fixture 而不是手搓字符串，才能顺带证明改完仍是解析器认的 TripMD。
 */
const md = readFileSync(join(__dirname, '../../../apps/web/public/data/_example/plan.md'), 'utf8')
/** frontmatter 之后的全部内容 —— 断言「其余一个字节不动」用 */
const body = (s: string) => s.slice(s.indexOf('\n---\n', 4))

describe('setFrontmatterScalar', () => {
  it('没有这个键：追加在闭合 --- 之前，其余字节不变', () => {
    expect(md).not.toMatch(/^visibility:/m)
    const out = setFrontmatterScalar(md, 'visibility', 'public')
    expect(out).toMatch(/^visibility: public\n---\n/m)
    expect(body(out)).toBe(body(md))
    expect(out.split('\n').length).toBe(md.split('\n').length + 1)
  })

  it('已有这个键：原位替换，不新增行', () => {
    const once = setFrontmatterScalar(md, 'visibility', 'public')
    const twice = setFrontmatterScalar(once, 'visibility', 'private')
    expect(twice).toMatch(/^visibility: private$/m)
    expect(twice.match(/^visibility:/gm)).toHaveLength(1)
    expect(twice.split('\n').length).toBe(once.split('\n').length)
  })

  it('value 为 null 删掉这一行；本来就没有时原样返回', () => {
    const once = setFrontmatterScalar(md, 'visibility', 'public')
    expect(setFrontmatterScalar(once, 'visibility', null)).toBe(md)
    expect(setFrontmatterScalar(md, 'visibility', null)).toBe(md)
  })

  it('幂等：同一值设两次等于设一次', () => {
    const once = setFrontmatterScalar(md, 'visibility', 'public')
    expect(setFrontmatterScalar(once, 'visibility', 'public')).toBe(once)
  })

  it('只认行首的键：拼错的 visibilty 和别的键的值里出现的字样都不算命中', () => {
    const tricky = md.replace('currency: JPY\n', 'currency: JPY\nvisibilty: public\nsubtitle: visibility: yes\n')
    const out = setFrontmatterScalar(tricky, 'visibility', 'public')
    expect(out).toContain('visibilty: public\n') // 拼错的那行原样留着，交给解析器去警告
    expect(out).toContain('subtitle: visibility: yes\n')
    expect(out.match(/^visibility: public$/gm)).toHaveLength(1)
  })

  it('改完仍是解析器认的 TripMD，且 visibility 真的变了', () => {
    const pub = parse(setFrontmatterScalar(md, 'visibility', 'public'))
    expect(pub.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(pub.trip!.visibility).toBe('public')
    const back = parse(setFrontmatterScalar(setFrontmatterScalar(md, 'visibility', 'public'), 'visibility', null))
    expect(back.trip!.visibility).toBe('private')
  })

  it('没有 frontmatter 或没闭合：抛错而不是瞎写', () => {
    expect(() => setFrontmatterScalar('# 没有 frontmatter\n', 'visibility', 'public')).toThrow('缺少 frontmatter')
    expect(() => setFrontmatterScalar('---\nid: x\n', 'visibility', 'public')).toThrow('没有闭合')
  })
})
