import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_DATA_DIR } from '@jjj/datadir'
import { setFrontmatterScalar } from '@jjj/tripmd'
import { dataRoute, fileRoute, isVisibilityCall, manifestRoute, normalizeUrlPath, publicRoute, shipsToDist, visibilityRoute, type DataServer } from './data-routes.ts'

/**
 * dev 服务器应答的直接测试 —— 不起 vite，直接调路由函数。
 * 数据目录用 _example 拼：一份 public（pub）、一份 private（priv）、一份 `_` 示范（_fix，public）、
 * 行程目录里多放一个不该发的文件、名片 + 头像 + 一个名片没引用的图。
 */
let root: string
let outside: string
const example = readFileSync(join(DEFAULT_DATA_DIR, '_example/plan.md'), 'utf8')
const asPublic = setFrontmatterScalar(example, 'visibility', 'public')
const body = (r: { body: string | Buffer }): string => r.body.toString()

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'jjj-routes-')))
  for (const [id, md] of [['pub', asPublic], ['priv', example], ['_fix', asPublic], ['_demo', example]] as const) {
    mkdirSync(join(root, id))
    writeFileSync(join(root, id, 'plan.md'), md)
  }
  writeFileSync(join(root, 'pub', 'confirmations.pdf'), 'not for the public')
  writeFileSync(join(root, 'pub', 'calendar.ics'), 'BEGIN:VCALENDAR')
  writeFileSync(join(root, 'space.md'), '---\nname: 测试\navatar: avatar.png\n---\n')
  writeFileSync(join(root, 'avatar.png'), 'png')
  writeFileSync(join(root, 'private-photo.png'), 'png')
  // 目录内一个指到外面的行程目录：外面那份是 public 的 plan.md
  outside = realpathSync(mkdtempSync(join(tmpdir(), 'jjj-routes-out-')))
  writeFileSync(join(outside, 'plan.md'), asPublic)
  symlinkSync(outside, join(root, 'linked'))
})
afterAll(() => {
  rmSync(root, { recursive: true, force: true })
  rmSync(outside, { recursive: true, force: true })
})

describe('normalizeUrlPath', () => {
  it('整条路径解码一次再规范化：// 与 /./ 收掉，前缀里的百分号转义也解开；坏转义返回 null 而不是抛', () => {
    expect(normalizeUrlPath('/data/pub//plan.md')).toBe('/data/pub/plan.md')
    expect(normalizeUrlPath('/data/./pub/plan.md')).toBe('/data/pub/plan.md')
    expect(normalizeUrlPath('/data/%2e/pub/plan.md')).toBe('/data/pub/plan.md')
    expect(normalizeUrlPath('/%64ata/pub/plan.md')).toBe('/data/pub/plan.md')
    expect(normalizeUrlPath('//data/pub/plan.md')).toBe('/data/pub/plan.md')
    expect(normalizeUrlPath('/%2564ata/pub/plan.md')).toBe('/%64ata/pub/plan.md') // 只解一次，与 vite 同层
    expect(normalizeUrlPath('/data/%zz')).toBeNull()
  })
})

describe('dataRoute（分派）', () => {
  const pub = (): DataServer => ({ root, publicMode: true, external: false, base: '/' })
  const full = (): DataServer => ({ root, publicMode: false, external: false, base: '/' })
  it('公开版：前缀以任何写法到达，都由白名单答完，绝不落给 vite 的静态服务（那里是全量数据）', () => {
    for (const raw of ['/data/pub/plan.md', '/%64ata/pub/plan.md', '/d%61ta/pub/plan.md', '//data/pub//plan.md']) {
      const r = dataRoute(pub(), normalizeUrlPath(raw)!)
      expect(r, raw).not.toBeNull()
      expect(body(r!), raw).not.toMatch(/price:|number:|seat:/)
    }
    for (const raw of ['/%64ata/priv/plan.md', '/%64ata/pub/calendar.ics', '/%64ata/_fix/plan.md']) {
      expect(dataRoute(pub(), normalizeUrlPath(raw)!)?.status, raw).toBe(404)
    }
  })
  it('完整版、仓库内的数据目录：目录内交给 vite（null），越界 404，别的路径不归我们管', () => {
    expect(dataRoute(full(), '/data/pub/plan.md')).toBeNull()
    // 纵深防御：就算有人绕过 normalizeUrlPath 直接喂进来，insideDir 也拒掉
    expect(dataRoute(full(), '/data/../../etc/passwd')?.status).toBe(404)
    // 正常路径：规范化之后已经不在 /data/ 下了，不归我们管
    expect(dataRoute(full(), normalizeUrlPath('/data/../../etc/passwd')!)).toBeNull()
    expect(dataRoute(full(), '/src/main.tsx')).toBeNull()
  })
  it('base 子路径：只认 {base}data/', () => {
    const sub: DataServer = { ...pub(), base: '/jjj/' }
    expect(dataRoute(sub, '/data/pub/plan.md')).toBeNull()
    expect(dataRoute(sub, '/jjj/data/pub/plan.md')?.status).toBe(200)
  })
  it('公开版的 dev 服务器上没有写端点', () => {
    expect(isVisibilityCall(full(), '/api/visibility')).toBe(true)
    expect(isVisibilityCall(pub(), '/api/visibility')).toBe(false)
  })
})

describe('manifestRoute', () => {
  it('完整版 dev：真行程全列，示范只列 _demo（_showcase 和来源真行程是同一趟，首页不要两张）；公开版：只列 public 且不含示范', () => {
    const full = JSON.parse(body(manifestRoute(root, false))) as { trips: { id: string }[] }
    expect(full.trips.map((t) => t.id).sort()).toEqual(['_demo', 'priv', 'pub'])
    const pub = JSON.parse(body(manifestRoute(root, true))) as { trips: { id: string }[] }
    expect(pub.trips.map((t) => t.id)).toEqual(['pub'])
  })
})

describe('publicRoute', () => {
  it('public 行程的 plan.md 是抹过的：没有 price / number / seat，再解析得到的 visibility 是 public', () => {
    const r = publicRoute(root, 'pub/plan.md')
    expect(r.status).toBe(200)
    expect(body(r)).not.toMatch(/price:|number:|seat:/)
    expect(body(r)).toMatch(/^visibility: public$/m)
  })
  it('不是 public、示范目录、不存在、指到目录外、文件不在白名单上（含 calendar.ics 与行程目录里的杂物）→ 404', () => {
    for (const rel of ['priv/plan.md', '_fix/plan.md', '_demo/plan.md', 'nope/plan.md', 'linked/plan.md', 'pub/calendar.ics', 'pub/confirmations.pdf', 'pub/', 'pub', 'private-photo.png', 'manifest.json.bak']) {
      expect(publicRoute(root, rel).status, rel).toBe(404)
    }
  })
  it('名片与它引用的头像放行；没引用的图不放', () => {
    expect(publicRoute(root, 'space.md').status).toBe(200)
    expect(publicRoute(root, 'avatar.png').status).toBe(200)
    expect(publicRoute(root, 'private-photo.png').status).toBe(404)
  })
  it('没有路网缓存的公开行程：geometry.json 404（而不是 500 或原文件）', () => {
    expect(publicRoute(root, 'pub/geometry.json').status).toBe(404)
  })
})

describe('fileRoute', () => {
  it('目录内的文件直出并带类型；越界、不存在、目录 → 404', () => {
    const r = fileRoute(root, 'space.md')
    expect(r.status).toBe(200)
    expect(r.type).toContain('text/markdown')
    expect(fileRoute(root, '../etc/passwd').status).toBe(404)
    expect(fileRoute(root, 'pub').status).toBe(404)
    expect(fileRoute(root, 'pub/nothing').status).toBe(404)
  })
})

describe('visibilityRoute', () => {
  const call = (over: Partial<Parameters<typeof visibilityRoute>[1]>) =>
    visibilityRoute(root, {
      method: 'POST',
      origin: 'http://localhost:5173',
      host: 'localhost:5173',
      contentType: 'application/json',
      body: JSON.stringify({ id: 'priv', visibility: 'public' }),
      ...over,
    })
  it('往返：private → public 多一行，public → private 删掉那行，文件其余字节不动', () => {
    const before = readFileSync(join(root, 'priv', 'plan.md'), 'utf8')
    expect(call({}).status).toBe(200)
    expect(readFileSync(join(root, 'priv', 'plan.md'), 'utf8')).toMatch(/^visibility: public$/m)
    expect(call({ body: JSON.stringify({ id: 'priv', visibility: 'private' }) }).status).toBe(200)
    expect(readFileSync(join(root, 'priv', 'plan.md'), 'utf8')).toBe(before)
  })
  it('方法、同源、内容类型、id、值、存在性各自的错误码', () => {
    expect(call({ method: 'GET' }).status).toBe(405)
    expect(call({ origin: 'http://evil.example' }).status).toBe(403)
    expect(call({ origin: undefined }).status).toBe(200) // curl 这类没有 Origin 的调用照旧（本机脚本）
    call({ body: JSON.stringify({ id: 'priv', visibility: 'private' }) })
    expect(call({ contentType: 'text/plain' }).status).toBe(415)
    expect(call({ body: '{nope' }).status).toBe(400)
    expect(call({ body: JSON.stringify({ id: '../x', visibility: 'public' }) }).status).toBe(400)
    expect(call({ body: JSON.stringify({ id: 'priv', visibility: 'pubilc' }) }).status).toBe(400)
    expect(call({ body: JSON.stringify({ id: 'nope', visibility: 'public' }) }).status).toBe(404)
    expect(call({ body: JSON.stringify({ id: 'linked', visibility: 'private' }) }).status).toBe(404) // 链接出去的 plan.md 写不到
    expect(readFileSync(join(outside, 'plan.md'), 'utf8')).toBe(asPublic)
    expect(readFileSync(join(root, 'priv', 'plan.md'), 'utf8')).toBe(example)
  })
})

describe('shipsToDist', () => {
  it('构建期拷贝跳过数据目录内的 dotfiles 及其子树；数据目录自己的路径里有 `.` 段不算', () => {
    expect(shipsToDist('/x/trips', '/x/trips/.git/config')).toBe(false)
    expect(shipsToDist('/x/trips', '/x/trips/.env')).toBe(false)
    expect(shipsToDist('/x/trips', '/x/trips/pub/plan.md')).toBe(true)
    expect(shipsToDist('/home/u/.data/trips', '/home/u/.data/trips/pub/plan.md')).toBe(true)
  })
})
