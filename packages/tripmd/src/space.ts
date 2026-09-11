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
    tips.push(image !== undefined ? { label, image } : { label, url })
  }

  if (bag.hasErrors) return { space: null, diagnostics: bag.sorted() }

  const checked = SpaceSchema.safeParse({
    name,
    handle: str(meta['handle']),
    avatar: str(meta['avatar']),
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
