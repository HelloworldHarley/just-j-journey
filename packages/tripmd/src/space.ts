import { SpaceSchema, type Space } from '@jjj/schema'
import { SPACE_FILE } from './layout.ts'
import { DiagnosticBag, type Diagnostic } from './diagnostics.ts'
import { lex, proseOf } from './lexer.ts'
import {
  asRecord,
  display,
  eachRecord,
  isWritten,
  nested,
  readRecord,
  schemaGate,
  text,
  yamlOf,
  type Fields,
  type RecordSpec,
  type Values,
} from './read.ts'
import { flowMap, scalar } from './serialize.ts'

/**
 * space.md 的解析与序列化 —— 与 plan.md 同一套 lexer / 诊断 / YAML 零件，
 * 同一条规矩：拼错的键要报，残缺的项要报，解析器是唯一校验器。
 */

const SPACE = {
  block: SPACE_FILE,
  fields: {
    name: { read: text, required: '名片上的名字，如 `name: 小明`' },
    handle: display,
    avatar: display,
    bio: display,
    links: { read: nested },
    tips: { read: nested },
  },
} satisfies RecordSpec<Fields>

// 名片上的链接与打赏都只影响显示：残缺的那一项提醒并跳过，不拦整张名片
const LINK = {
  block: 'links',
  fields: {
    label: { read: text, level: 'warning', required: '写成 `{label: GitHub, url: https://…}`' },
    url: { read: text, level: 'warning', required: '写成 `{label: GitHub, url: https://…}`' },
  },
} satisfies RecordSpec<Fields>

const TIP = {
  block: 'tips',
  fields: {
    label: { read: text, level: 'warning', required: '写成 `{label: 微信, image: tips/wechat.png}`' },
    image: display,
    url: display,
  },
} satisfies RecordSpec<Fields>

export interface SpaceParseResult {
  space: Space | null
  diagnostics: Diagnostic[]
}

export function parseSpace(src: string): SpaceParseResult {
  const bag = new DiagnosticBag()
  const tokens = lex(src)
  const fm = tokens.find((t) => t.kind === 'frontmatter')
  if (!fm || fm.kind !== 'frontmatter') {
    bag.error(1, '缺少 frontmatter', 'space.md 必须以 --- 开头，至少声明 name')
    return { space: null, diagnostics: bag.sorted() }
  }
  // frontmatter 从第 2 行开始（第 1 行是 `---`），YAML 的行号要平移这么多
  const head = yamlOf(bag, fm.line - 1, fm.yaml, 'frontmatter')
  const meta = asRecord(head.value)
  if (head.value !== null && !meta) bag.error(fm.line, 'frontmatter 应为键值对', '每行写成 `键: 值`')
  const v: Values<typeof SPACE.fields> = head.broken ? {} : readRecord(bag, head.cursor, meta ?? {}, SPACE, SPACE_FILE)

  const links: Space['links'] = []
  eachRecord(bag, v.links, 'links ', (rec, at, i) => {
    const l = readRecord(bag, at, rec, LINK, `links 第 ${i + 1} 项`)
    if (l.label && l.url) links.push({ label: l.label, url: l.url })
  }, 'warning')

  // 打赏项：label 必填，image / url 二选一 —— 两者都没有就没东西可展示，两者都有就不知道该画哪个
  const tips: Space['tips'] = []
  eachRecord(bag, v.tips, 'tips ', (rec, at, i) => {
    const t = readRecord(bag, at, rec, TIP, `tips 第 ${i + 1} 项`)
    if (!t.label) return
    // image / url 写了却读不出来的已经报过，不再叠一条「二选一」
    const unreadable = (t.image === undefined && isWritten(rec['image'])) || (t.url === undefined && isWritten(rec['url']))
    if (unreadable) return
    if ((t.image === undefined) === (t.url === undefined)) {
      bag.warn(at.line, `tips「${t.label}」要么给 image（二维码图片）要么给 url（链接），二选一，已忽略`)
      return
    }
    if (t.url !== undefined) {
      tips.push({ label: t.label, url: t.url })
      return
    }
    const image = assetPath(bag, at.lineOf('image'), t.image!, `tips「${t.label}」的 image`)
    if (image !== null) tips.push({ label: t.label, image })
  }, 'warning')
  const avatar = v.avatar === undefined ? undefined : (assetPath(bag, head.cursor.lineOf('avatar'), v.avatar, 'avatar') ?? undefined)

  if (bag.hasErrors) return { space: null, diagnostics: bag.sorted() }

  const space = schemaGate(bag, fm.line, SpaceSchema, {
    name: v.name,
    handle: v.handle,
    avatar,
    bio: v.bio,
    links,
    tips,
    markdown: proseOf(tokens.filter((t) => t.kind !== 'frontmatter')),
  })
  return { space, diagnostics: bag.sorted() }
}

/**
 * 名片里的一个资源路径 → 规范形态。http(s) 地址原样；本地路径必须相对数据目录、不许越界：
 * `./avatar.png` 规范成 `avatar.png`（否则 dev 的白名单按字面比对不上，构建却照拷，两边不一致），
 * 绝对路径、`..` 段、反斜杠一律拒掉并警告 —— `../me.png` 曾经过了 data:check，
 * 暂存时被拷到数据目录外面，线上是一张裂图。返回 null 表示拒绝
 */
function assetPath(bag: DiagnosticBag, line: number, raw: string, what: string): string | null {
  if (isAbsoluteUrl(raw)) return raw
  const segs = raw.split('/').filter((s) => s !== '' && s !== '.')
  if (raw.startsWith('/') || raw.includes('\\') || segs.includes('..') || segs.length === 0) {
    bag.warn(line, `${what}「${raw}」必须是数据目录里的相对路径（不能以 / 开头、不能有 ..），已忽略`, '写成 `avatar.png` 或 `tips/wechat.png`')
    return null
  }
  return segs.join('/')
}

/** http(s) 绝对地址：头像 / 二维码可以直接指向远程图片 —— 不在数据目录里，也不归工具检查 */
export function isAbsoluteUrl(s: string): boolean {
  return /^https?:\/\//i.test(s)
}

/**
 * 名片引用的**本地**文件（头像、打赏二维码），路径相对数据目录。
 * data:check 查它们在不在，build:public 把它们一起拷走 —— 两边同一份名单。
 */
export function spaceAssets(space: Space): string[] {
  return [space.avatar, ...space.tips.map((t) => t.image)]
    .filter((f): f is string => Boolean(f))
    .filter((f) => !isAbsoluteUrl(f))
}

/** Space → 规范 space.md。与 serialize(trip) 同一条性质：语义幂等、二次往返字节稳定 */
export function serializeSpace(space: Space): string {
  const L = ['---', `name: ${scalar(space.name)}`]
  if (space.handle) L.push(`handle: ${scalar(space.handle)}`)
  if (space.avatar) L.push(`avatar: ${scalar(space.avatar)}`)
  if (space.bio) L.push(`bio: ${scalar(space.bio)}`)
  if (space.links.length > 0) {
    L.push('links:')
    for (const l of space.links) L.push(`  - ${flowMap([['label', l.label], ['url', l.url]])}`)
  }
  if (space.tips.length > 0) {
    L.push('tips:')
    for (const t of space.tips) L.push(`  - ${flowMap([['label', t.label], ['image', t.image], ['url', t.url]])}`)
  }
  L.push('---')
  return L.join('\n') + '\n' + (space.markdown ? `\n${space.markdown}\n` : '')
}
