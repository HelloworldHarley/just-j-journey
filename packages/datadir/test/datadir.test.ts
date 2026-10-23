import { existsSync, readdirSync, readFileSync, symlinkSync } from 'node:fs'
import { join, sep } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { serialize } from '@jjj/tripmd'
import { makeDay, makeTrip } from '@jjj/tripmd/test-support'
import {
  DEFAULT_DATA_DIR,
  TOOL_ROOT,
  copyDataTree,
  dataDir,
  hasDataFile,
  insideDir,
  isDefaultDataDir,
  planFile,
  readGeometry,
  readManifestIds,
  readSpace,
  readTrip,
  scanEntries,
  strayDirs,
  tripDirs,
  writeDataFile,
  writeManifest,
} from '../src/index.ts'
import { DIR, removeTrees, tempTree, writeTree } from './support/index.ts'

/** 一份能解析的最小行程，frontmatter id 由调用方定 */
const planOf = (id: string, visibility: 'public' | 'private' = 'private'): string =>
  serialize(makeTrip({ id, visibility, days: [makeDay()] }))

/** 一个合成的数据目录：几份行程、一个隐藏目录、散文件、示范目录、资源文件夹，加几种恶意形态 */
let root: string
let outside: string
beforeAll(() => {
  outside = tempTree('outside', { 'secret.md': 'outside', 'plan.md': planOf('outside'), 'me.png': 'png' })
  root = tempTree('datadir', {
    'a-trip/plan.md': '---\nid: a\n---\n', // 缺必填字段：解析必失败
    'a-trip/geometry.json': '{not json',
    'b-trip/geometry.json': '{"version":1,"routes":{}}', // 没有 plan.md：不是行程
    'c-trip/plan.md': planOf('c-trip', 'public'),
    'd-trip/plan.md': planOf('somewhere-else'), // id 与目录名不一致
    '_demo/plan.md': planOf('_demo'),
    'tokyo.2027/plan.md': planOf('tokyo.2027'), // 名字不是合法 id
    'images/me.png': 'png', // 名片的资源文件夹
    '.hidden/plan.md': planOf('.hidden'),
    'empty-dir': DIR,
    'dir-plan/plan.md': DIR, // plan.md 是个目录
    'space.md': '---\nname: x\n---\n',
    'manifest.json': JSON.stringify({ trips: [{ id: 'a-trip', visibility: 'public' }, 'b-trip'] }),
    ghost: { link: '/nonexistent/nope' }, // 悬空的符号链接
    escape: { link: outside }, // 指向目录外的符号链接，里面恰好也有一份 plan.md
    'avatar-out.png': { link: join(outside, 'me.png') }, // 指向目录外的文件
  })
})
afterAll(() => removeTrees(root, outside))

describe('tripDirs / strayDirs', () => {
  it('行程 = 名字合法、有 plan.md、真实位置在里面；示范目录也在，按名排序', () => {
    expect(tripDirs(root)).toEqual(['_demo', 'a-trip', 'c-trip', 'd-trip'])
  })
  it('名字不合法却有 plan.md 的单独报出来；资源文件夹、空目录、隐藏目录、指出去的链接都不算', () => {
    expect(strayDirs(root)).toEqual(['tokyo.2027'])
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
    expect(readTrip(DEFAULT_DATA_DIR, '_example')?.trip?.id).toBe('_example')
  })
  it('frontmatter 的 id 与目录名不一致：当解析失败，诊断指到 id 那一行', () => {
    const r = readTrip(root, 'd-trip')!
    expect(r.trip).toBeNull()
    expect(r.diagnostics).toContainEqual(expect.objectContaining({ severity: 'error', line: 2, message: expect.stringContaining('somewhere-else') }))
  })
})

describe('readGeometry / readSpace', () => {
  it('路网缓存三态：没有文件 undefined、不是 JSON null、其余原样', () => {
    expect(readGeometry(root, 'empty-dir')).toBeUndefined()
    expect(readGeometry(root, 'a-trip')).toBeNull()
    expect(readGeometry(root, 'b-trip')).toEqual({ version: 1, routes: {} })
    expect(readGeometry(root, 'escape')).toBeUndefined()
  })
  it('名片：有就解析，没有就 null；指到目录外的不读', () => {
    expect(readSpace(root)?.space?.name).toBe('x')
    expect(readSpace(join(root, 'a-trip'))).toBeNull()
    const linked = tempTree('linked-space', { 'space.md': { link: join(outside, 'secret.md') } })
    expect(readSpace(linked)).toBeNull()
    removeTrees(linked)
  })
})

describe('readManifestIds', () => {
  it('新旧形状都认；缺文件与坏 JSON 都是空数组', () => {
    expect(readManifestIds(root)).toEqual(['a-trip', 'b-trip'])
    expect(readManifestIds(join(root, 'a-trip'))).toEqual([])
    writeTree(root, { 'b-trip/manifest.json': '{not json' })
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
  it('不存在的路径按最近一个存在的祖先判：目录内的照常给出，指出去的链接下面的新文件算外面', () => {
    expect(insideDir(root, 'a-trip/nothing.md')).toBe(join(root, 'a-trip', 'nothing.md'))
    expect(insideDir(root, 'ghost')).toBe(join(root, 'ghost'))
    expect(insideDir(root, 'escape/new-file.md')).toBeNull()
  })
})

describe('dataDir', () => {
  it('JJJ_DATA_DIR 的相对路径按工具仓库根解析，不管在哪个目录读 —— vite 在 apps/web 里跑，CLI 在根目录跑，两边必须指向同一处', () => {
    const before = { cwd: process.cwd(), env: process.env['JJJ_DATA_DIR'] }
    try {
      process.env['JJJ_DATA_DIR'] = '../just-j-journey-personal-space/trips'
      const want = join(TOOL_ROOT, '../just-j-journey-personal-space/trips')
      process.chdir(TOOL_ROOT)
      expect(dataDir()).toBe(want)
      process.chdir(join(TOOL_ROOT, 'apps/web'))
      expect(dataDir()).toBe(want)
      process.env['JJJ_DATA_DIR'] = '/abs/elsewhere'
      expect(dataDir()).toBe('/abs/elsewhere')
      delete process.env['JJJ_DATA_DIR']
      expect(dataDir()).toBe(DEFAULT_DATA_DIR)
    } finally {
      process.chdir(before.cwd)
      if (before.env === undefined) delete process.env['JJJ_DATA_DIR']
      else process.env['JJJ_DATA_DIR'] = before.env
    }
  })
})

describe('写与拷', () => {
  it('writeDataFile：写进去、不留临时文件；目标在指出去的链接下面就拒绝', () => {
    writeDataFile(root, 'c-trip/calendar.ics', 'BEGIN:VCALENDAR')
    expect(readFileSync(join(root, 'c-trip', 'calendar.ics'), 'utf8')).toBe('BEGIN:VCALENDAR')
    expect(readdirSync(join(root, 'c-trip')).filter((f) => f.endsWith('.tmp'))).toEqual([])
    expect(() => writeDataFile(root, 'escape/plan.md', 'x')).toThrow('数据目录外面')
    expect(readFileSync(join(outside, 'plan.md'), 'utf8')).toBe(planOf('outside'))
  })
  it('scanEntries / writeManifest：只收能解析的行程，示范目录不入册', () => {
    expect(scanEntries(root)).toEqual([
      { id: '_demo', visibility: 'private' },
      { id: 'c-trip', visibility: 'public' },
    ])
    const out = tempTree('manifest-out')
    expect(writeManifest(out, scanEntries(root))).toEqual({ trips: [{ id: 'c-trip', visibility: 'public' }] })
    expect(readManifestIds(out)).toEqual(['c-trip'])
    removeTrees(out)
  })
  it('copyDataTree：dotfiles、顶层 `_` 示范目录、指出去的链接都不拷；目录内的链接拷它指向的内容，成环不转圈', () => {
    symlinkSync(join(root, 'images'), join(root, 'images', 'loop'))
    symlinkSync(join(root, 'c-trip', 'plan.md'), join(root, 'c-alias.md'))
    const out = tempTree('copy-out')
    copyDataTree(root, out)
    expect(existsSync(join(out, 'c-trip', 'plan.md'))).toBe(true)
    expect(readFileSync(join(out, 'c-alias.md'), 'utf8')).toBe(planOf('c-trip', 'public'))
    expect(existsSync(join(out, 'images', 'me.png'))).toBe(true)
    for (const gone of ['_demo', '.hidden', 'escape', 'avatar-out.png', 'ghost']) expect(existsSync(join(out, gone)), gone).toBe(false)
    removeTrees(out)
  })
  it('hasDataFile：目录内的普通文件才算', () => {
    expect(hasDataFile(root, 'images/me.png')).toBe(true)
    expect(hasDataFile(root, 'avatar-out.png')).toBe(false)
    expect(hasDataFile(root, 'images')).toBe(false)
  })
  it('isDefaultDataDir 按真实路径比', () => {
    expect(isDefaultDataDir(DEFAULT_DATA_DIR + sep)).toBe(true)
    expect(isDefaultDataDir(join(DEFAULT_DATA_DIR, '..', 'data'))).toBe(true)
    expect(isDefaultDataDir(root)).toBe(false)
  })
})
