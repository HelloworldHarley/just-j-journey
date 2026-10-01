import { describe, expect, it } from 'vitest'
import { isAbsoluteUrl, parseSpace, serializeSpace, spaceAssets } from '../src/space.ts'

const FULL = `---
name: 示例
handle: demo
avatar: avatar.jpg
bio: 一句话简介
links:
  - {label: GitHub, url: https://github.com/example}
  - {label: 小红书, url: https://xhslink.com/x}
tips:
  - {label: 微信, image: tips/wechat.png}
  - {label: Buy Me a Coffee, url: https://buymeacoffee.com/example}
---

自我介绍第一段。

第二段，**加粗**。
`

describe('parseSpace', () => {
  it('全字段', () => {
    const { space, diagnostics } = parseSpace(FULL)
    expect(diagnostics).toEqual([])
    expect(space).toEqual({
      name: '示例',
      handle: 'demo',
      avatar: 'avatar.jpg',
      bio: '一句话简介',
      links: [
        { label: 'GitHub', url: 'https://github.com/example' },
        { label: '小红书', url: 'https://xhslink.com/x' },
      ],
      tips: [
        { label: '微信', image: 'tips/wechat.png' },
        { label: 'Buy Me a Coffee', url: 'https://buymeacoffee.com/example' },
      ],
      markdown: '自我介绍第一段。\n\n第二段，**加粗**。',
    })
  })

  it('只有 name 也成立，其余缺省', () => {
    const { space } = parseSpace('---\nname: 只有名字\n---\n')
    expect(space).toEqual({ name: '只有名字', links: [], tips: [], markdown: '' })
  })

  it('打赏项：缺 label、image 与 url 都没有、两者都有 —— 各自警告并忽略', () => {
    const { space, diagnostics } = parseSpace(
      '---\nname: A\ntips: [{image: a.png}, {label: 空的}, {label: 双, image: a.png, url: https://x}]\n---\n',
    )
    expect(space?.tips).toEqual([])
    expect(diagnostics.filter((d) => d.message.includes('tips'))).toHaveLength(3)
    expect(diagnostics.every((d) => d.severity === 'warning')).toBe(true)
  })

  it('缺 name 是错误；缺 frontmatter 是错误', () => {
    expect(parseSpace('---\nbio: x\n---\n').space).toBeNull()
    expect(parseSpace('# 没有 frontmatter\n').space).toBeNull()
  })

  it('拼错的键与残缺的 link 都要警告，不静默', () => {
    const { space, diagnostics } = parseSpace('---\nname: A\nboi: x\nlinks: [{label: 没 url}]\n---\n')
    expect(space?.links).toEqual([])
    expect(diagnostics.map((d) => d.severity)).toEqual(['warning', 'warning'])
    expect(diagnostics[0]?.hint).toContain('bio')
  })

  it('资源路径：./ 规范掉；绝对路径、.. 段、反斜杠拒掉并警告；http(s) 原样', () => {
    const { space, diagnostics } = parseSpace(
      '---\nname: A\navatar: ./img/me.png\ntips:\n  - {label: 外, image: ../outside.png}\n  - {label: 根, image: /etc/x.png}\n  - {label: 反, image: "a\\\\b.png"}\n  - {label: 好, image: tips//wx.png}\n  - {label: 远, image: https://example.com/qr.png}\n---\n',
    )
    expect(space?.avatar).toBe('img/me.png')
    expect(space?.tips).toEqual([
      { label: '好', image: 'tips/wx.png' },
      { label: '远', image: 'https://example.com/qr.png' },
    ])
    expect(diagnostics.filter((d) => d.message.includes('相对路径'))).toHaveLength(3)
    expect(parseSpace('---\nname: A\navatar: ../me.png\n---\n').space?.avatar).toBeUndefined()
  })

  it('roundtrip：parse ∘ serialize ∘ parse = parse', () => {
    const once = parseSpace(FULL).space!
    const md2 = serializeSpace(once)
    expect(parseSpace(md2).space).toEqual(once)
    expect(serializeSpace(parseSpace(md2).space!)).toBe(md2)
  })
})

describe('spaceAssets', () => {
  it('头像 + 二维码图片，按出现顺序；链接型打赏不算；绝对 URL 不算', () => {
    const space = parseSpace(FULL).space!
    expect(spaceAssets(space)).toEqual(['avatar.jpg', 'tips/wechat.png'])
    expect(spaceAssets({ ...space, avatar: 'https://example.com/a.png' })).toEqual(['tips/wechat.png'])
    expect(spaceAssets({ ...space, avatar: undefined, tips: [] })).toEqual([])
  })
  it('isAbsoluteUrl：只认 http(s)，大小写不敏感；相对路径与协议相对地址都不算', () => {
    expect(isAbsoluteUrl('https://x/a.png')).toBe(true)
    expect(isAbsoluteUrl('HTTP://x/a.png')).toBe(true)
    expect(isAbsoluteUrl('avatar.png')).toBe(false)
    expect(isAbsoluteUrl('//x/a.png')).toBe(false)
  })
})
