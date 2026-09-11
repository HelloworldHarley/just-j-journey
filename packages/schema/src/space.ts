import { z } from 'zod'

/**
 * 个人空间 —— 数据目录根下一份 `space.md`：frontmatter 是名片，正文是自由 Markdown。
 * 首页从「行程列表」变成「个人主页」：名片在上，行程卡片在下。
 * 完整版与公开版共用这一份，区别只在列出的行程。
 */
export const SpaceLinkSchema = z.object({
  label: z.string().min(1),
  url: z.string().min(1),
})

/**
 * 打赏入口 —— 二维码图片（微信 / 支付宝，相对 space.md 的路径）或一个链接（Buy Me a Coffee / 爱发电）。
 * 二选一：两者都有或都没有的项在解析时被拒。工具不预设任何平台，全由数据说话。
 */
export const SpaceTipSchema = z
  .object({
    label: z.string().min(1),
    image: z.string().min(1).optional(),
    url: z.string().min(1).optional(),
  })
  .refine((t) => (t.image === undefined) !== (t.url === undefined), 'image 与 url 二选一')

export const SpaceSchema = z.object({
  name: z.string().min(1),
  /** 可选，站点标题 / 页签用，显示成 @handle */
  handle: z.string().optional(),
  /** 相对 space.md 的路径；浏览器拼在数据目录 URL 后面 */
  avatar: z.string().optional(),
  bio: z.string().optional(),
  links: z.array(SpaceLinkSchema).default([]),
  /** 有一项就在名片上长出「打赏」按钮；公开版和完整版都显示 —— 二维码本来就是给别人扫的 */
  tips: z.array(SpaceTipSchema).default([]),
  /** frontmatter 之后的自由 Markdown */
  markdown: z.string().default(''),
})

export type Space = z.infer<typeof SpaceSchema>
export type SpaceLink = z.infer<typeof SpaceLinkSchema>
export type SpaceTip = z.infer<typeof SpaceTipSchema>
