import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_DATA_DIR, insideDir, planFile, readGeometry, readManifestIds, readSpace, readTrip, tripDirs } from '../src/index.ts'

/** 一个合成的数据目录：两份行程、一个隐藏目录、一个散文件、一份示范目录，加几种恶意形态 */
let root: string
let outside: string
beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'jjj-datadir-')))
  outside = realpathSync(mkdtempSync(join(tmpdir(), 'jjj-outside-')))
  for (const d of ['b-trip', 'a-trip', '_demo', '.hidden', 'empty-dir', 'dir-plan']) mkdirSync(join(root, d))
  writeFileSync(join(root, 'space.md'), '---\nname: x\n---\n')
  writeFileSync(join(root, 'a-trip', 'plan.md'), '---\nid: a\n---\n') // 缺必填字段：解析必失败
  mkdirSync(join(root, 'dir-plan', 'plan.md')) // plan.md 是个目录
  writeFileSync(join(root, 'manifest.json'), JSON.stringify({ trips: [{ id: 'a-trip', visibility: 'public' }, 'b-trip'] }))
  symlinkSync('/nonexistent/nope', join(root, 'ghost')) // 悬空的符号链接
  writeFileSync(join(outside, 'secret.md'), 'outside')
  writeFileSync(join(outside, 'plan.md'), '---\nid: outside\n---\n')
  symlinkSync(outside, join(root, 'escape')) // 指向目录外的符号链接，里面恰好也有一份 plan.md
  writeFileSync(join(root, 'b-trip', 'geometry.json'), '{"version":1,"routes":{}}')
  writeFileSync(join(root, 'a-trip', 'geometry.json'), '{not json')
})
afterAll(() => {
  rmSync(root, { recursive: true, force: true })
  rmSync(outside, { recursive: true, force: true })
})

describe('tripDirs', () => {
  it('非隐藏子目录、按名排序；散文件、悬空链接、指到目录外的链接都不算；_ 前缀与没有 plan.md 的目录也列出来', () => {
    expect(tripDirs(root)).toEqual(['_demo', 'a-trip', 'b-trip', 'dir-plan', 'empty-dir'])
  })
  it('数据目录不存在：抛可读的错，不是 ENOENT 堆栈', () => {
    expect(() => tripDirs(join(root, 'nope'))).toThrow('数据目录不存在')
    expect(() => tripDirs(join(root, 'space.md'))).toThrow('不是目录')
  })
})

describe('readTrip', () => {
  it('没有 plan.md、或 plan.md 是目录、或真实位置在目录外：返回 null，不抛', () => {
    expect(readTrip(root, 'empty-dir')).toBeNull()
    expect(readTrip(root, 'dir-plan')).toBeNull()
    expect(readTrip(root, 'ghost')).toBeNull()
    expect(readTrip(root, 'escape')).toBeNull()
    expect(planFile(root, 'escape')).toBeNull() // 写路径拿的也是它：链接出去的 plan.md 写不到
    expect(planFile(root, 'a-trip')).toBe(join(root, 'a-trip', 'plan.md'))
  })
  it('有文件就解析，带上诊断用的标签', () => {
    const r = readTrip(root, 'a-trip')!
    expect(r.label).toBe('a-trip/plan.md')
    expect(r.trip).toBeNull()
    expect(r.diagnostics.some((d) => d.severity === 'error')).toBe(true)
  })
  it('缺省数据目录里的 _example 能读出来', () => {
    expect(readTrip(DEFAULT_DATA_DIR, '_example')?.trip?.id).toBeTruthy()
  })
})

describe('readGeometry / readSpace', () => {
  it('路网缓存三态：没有文件 undefined、不是 JSON null、其余原样', () => {
    expect(readGeometry(root, 'empty-dir')).toBeUndefined()
    expect(readGeometry(root, 'a-trip')).toBeNull()
    expect(readGeometry(root, 'b-trip')).toEqual({ version: 1, routes: {} })
    expect(readGeometry(root, 'escape')).toBeUndefined()
  })
  it('名片：有就解析，没有就 null', () => {
    expect(readSpace(root)?.space?.name).toBe('x')
    expect(readSpace(join(root, 'a-trip'))).toBeNull()
  })
})

describe('readManifestIds', () => {
  it('新旧形状都认；缺文件与坏 JSON 都是空数组', () => {
    expect(readManifestIds(root)).toEqual(['a-trip', 'b-trip'])
    expect(readManifestIds(join(root, 'a-trip'))).toEqual([])
    writeFileSync(join(root, 'b-trip', 'manifest.json'), '{not json')
    expect(readManifestIds(join(root, 'b-trip'))).toEqual([])
  })
})

describe('insideDir', () => {
  it('目录内的路径落成真实路径，目录本身也算', () => {
    expect(insideDir(root, 'a-trip/plan.md')).toBe(join(root, 'a-trip', 'plan.md'))
    expect(insideDir(root, '')).toBe(root)
  })
  it('`..` 逃出去、只是前缀相同的兄弟目录、绝对路径，都算外面', () => {
    expect(insideDir(root, '../x')).toBeNull()
    expect(insideDir(root, `..${sep}${root.split(sep).pop()}-evil${sep}plan.md`)).toBeNull()
    expect(insideDir(root, '/etc/hosts')).toBeNull()
  })
  it('目录里一个指向外面的符号链接：字面在里面、真实在外面 → 外面', () => {
    expect(insideDir(root, 'escape/secret.md')).toBeNull()
    expect(insideDir(root, 'escape')).toBeNull()
  })
  it('不存在的路径按字面判（交给调用方 404），悬空链接同理', () => {
    expect(insideDir(root, 'a-trip/nothing.md')).toBe(join(root, 'a-trip', 'nothing.md'))
    expect(insideDir(root, 'ghost')).toBe(join(root, 'ghost'))
  })
})
