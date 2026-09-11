import { describe, expect, it } from 'vitest'
import { buildManifest, manifestIds, publicEntries } from '../src/manifest.ts'

const entries = [
  { id: 'seattle-2026-10', visibility: 'public' as const },
  { id: 'tokyo-2027-01', visibility: 'private' as const },
  { id: '_demo', visibility: 'public' as const },
]

describe('manifest', () => {
  it('_ 前缀目录不入册，其余带着 visibility', () => {
    expect(buildManifest(entries)).toEqual({
      trips: [
        { id: 'seattle-2026-10', visibility: 'public' },
        { id: 'tokyo-2027-01', visibility: 'private' },
      ],
    })
  })

  it('公开版只收 public，且 _ 前缀照样排除', () => {
    expect(publicEntries(entries).map((e) => e.id)).toEqual(['seattle-2026-10'])
  })

  it('浏览器读 id：新形状与旧的字符串数组都认，垃圾跳过', () => {
    expect(manifestIds({ trips: [{ id: 'a', visibility: 'public' }, 'b', 42, { nope: 1 }] })).toEqual(['a', 'b'])
    expect(manifestIds({})).toEqual([])
    expect(manifestIds(null)).toEqual([])
  })
})
