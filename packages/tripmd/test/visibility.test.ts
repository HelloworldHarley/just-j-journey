import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from '../src/parse.ts'
import { serialize } from '../src/serialize.ts'

/**
 * visibility：public 进公开版（抹过），private 只进完整版，缺省 private。
 * 拼错的值不能静默变成 public —— 那是把私事发出去。
 */
const md = readFileSync(join(__dirname, '../../../apps/web/public/data/_example/plan.md'), 'utf8')
/** 在 frontmatter 末尾追加一行 */
const withFm = (extra: string) => md.replace('currency: JPY\n', `currency: JPY\n${extra}\n`)

describe('visibility', () => {
  it('缺省 private，摘要里也带着', () => {
    const { trip } = parse(md)
    expect(trip!.visibility).toBe('private')
  })

  it('public 读进来，serialize 写回去', () => {
    const { trip, diagnostics } = parse(withFm('visibility: public'))
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(trip!.visibility).toBe('public')
    expect(serialize(trip!)).toMatch(/^visibility: public$/m)
  })

  it('private 是缺省值，serialize 不写它（二次往返字节稳定）', () => {
    const { trip } = parse(withFm('visibility: private'))
    expect(trip!.visibility).toBe('private')
    expect(serialize(trip!)).not.toMatch(/^visibility:/m)
  })

  it('拼错的值按 private 处理并警告，绝不静默变 public', () => {
    const { trip, diagnostics } = parse(withFm('visibility: pubilc'))
    expect(trip!.visibility).toBe('private')
    const w = diagnostics.find((d) => d.message.includes('visibility'))
    expect(w?.severity).toBe('warning')
    expect(w?.hint).toContain('public / private')
  })

  it('frontmatter 里认不出的键要警告（拼错的 visibilty 不能悄悄消失）', () => {
    const { diagnostics } = parse(withFm('visibilty: public'))
    const w = diagnostics.find((d) => d.message.includes('visibilty'))
    expect(w?.severity).toBe('warning')
    expect(w?.hint).toContain('visibility')
  })
})
