import { SpaceSchema, type Space } from '@jjj/schema'
import { DiagnosticBag, type Diagnostic } from './diagnostics.ts'
import { lex, proseOf } from './lexer.ts'
import { asRecord, checkKeys, str, yamlOf } from './read.ts'
import { flowMap, scalar } from './serialize.ts'

/**
 * space.md 的解析与序列化 —— 与 plan.md 同一套 lexer / 诊断 / YAML 零件，
 * 同一条规矩：拼错的键要报，残缺的项要报，解析器是唯一校验器。
 */

export const SPACE_KEYS = ['name', 'handle', 'avatar', 'bio', 'links', 'tips'] as const

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
  const meta = asRecord(yamlOf(bag, 0, fm.yaml, 'frontmatter')) ?? {}
  checkKeys(bag, meta, SPACE_KEYS, fm.line, 'space.md')

  const name = str(meta['name'])
  if (!name) bag.error(fm.line, 'space.md 缺少必需字段 `name`')

  const links: Space['links'] = []
  const linksRaw = meta['links']
  for (const item of Array.isArray(linksRaw) ? linksRaw : linksRaw ? [linksRaw] : []) {
    const rec = asRecord(item)
    const label = rec ? str(rec['label']) : undefined
    const url = rec ? str(rec['url']) : undefined
    if (!label || !url) {
      bag.warn(fm.line, 'links 里有一项缺少 label 或 url，已忽略', '写成 `{label: GitHub, url: https://…}`')
      continue
    }
    links.push({ label, url })
  }

  // 打赏项：label 必填，image / url 二选一 —— 两者都没有就没东西可展示，两者都有就不知道该画哪个
  const tips: Space['tips'] = []
  const tipsRaw = meta['tips']
  for (const item of Array.isArray(tipsRaw) ? tipsRaw : tipsRaw ? [tipsRaw] : []) {
    const rec = asRecord(item)
    const label = rec ? str(rec['label']) : undefined
    const image = rec ? str(rec['image']) : undefined
    const url = rec ? str(rec['url']) : undefined
    if (!label) {
      bag.warn(fm.line, 'tips 里有一项缺少 label，已忽略', '写成 `{label: 微信, image: tips/wechat.png}`')
      continue
    }
    if ((image === undefined) === (url === undefined)) {
      bag.warn(fm.line, `tips「${label}」要么给 image（二维码图片）要么给 url（链接），二选一，已忽略`)
      continue
    }
    const localImage = image === undefined ? undefined : assetPath(bag, fm.line, image, `tips「${label}」的 image`)
    if (image !== undefined && localImage === null) continue
    tips.push(localImage ? { label, image: localImage } : { label, url })
  }
  const avatarRaw = str(meta['avatar'])
  const avatar = avatarRaw === undefined ? undefined : (assetPath(bag, fm.line, avatarRaw, 'avatar') ?? undefined)

  if (bag.hasErrors) return { space: null, diagnostics: bag.sorted() }

  const checked = SpaceSchema.safeParse({
    name,
    handle: str(meta['handle']),
    avatar,
    bio: str(meta['bio']),
    links,
    tips,
    markdown: proseOf(tokens.filter((t) => t.kind !== 'frontmatter')),
  })
  if (!checked.success) {
    for (const issue of checked.error.issues) {
      bag.error(fm.line, `schema 校验失败 @ ${issue.path.join('.')}：${issue.message}`)
    }
    return { space: null, diagnostics: bag.sorted() }
  }
  return { space: checked.data, diagnostics: bag.sorted() }
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
