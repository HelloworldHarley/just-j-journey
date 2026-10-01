import { Suspense, lazy, useState } from 'react'
import { Coffee, ExternalLink, Settings2 } from 'lucide-react'
import type { Space } from '@jjj/schema'
import { useRepository } from '../../data/hooks.ts'
import { TipsSheet } from './TipsSheet.tsx'

// 正文用与行程相同的 Markdown 渲染，但 react-markdown 不该进首页壳 —— 按需加载
const Markdown = lazy(() => import('../../components/Markdown.tsx').then((m) => ({ default: m.Markdown })))

/**
 * 首页头部 —— 个人空间的名片：头像 · 名字 · @handle · 简介 · 链接（+ 打赏）· 正文。
 * 没有 space.md（space 为 null）时退回工具自己的名字，首页仍是一张行程列表。
 * 头像缺省画首字母圆牌，不塞占位图。写了 tips 才有「打赏」按钮，点开是底部抽屉。
 */
export function SpaceHeader({ space, onSettings }: { space: Space | null; onSettings: () => void }) {
  const [tipsOpen, setTipsOpen] = useState(false)
  const repo = useRepository()
  const name = space?.name ?? 'Just J Journey'
  const bio = space?.bio ?? '把 Markdown 行程读成时间的形状。It\'s just a J thing.'
  const avatarUrl = space?.avatar ? repo.assetUrl(space.avatar) : null

  return (
    <header>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          {space && (
            avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="display flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sunken text-[22px] text-ink" aria-hidden>
                {name.slice(0, 1)}
              </span>
            )
          )}
          <div className="min-w-0">
            <h1 className="display truncate text-[34px] leading-none tracking-[-0.03em] text-ink sm:text-[40px]">
              {name}
            </h1>
            {space?.handle && <p className="tnum mt-1.5 text-[13px] text-soft">@{space.handle}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={onSettings}
          aria-label="设置"
          title="设置"
          className="mt-1 shrink-0 rounded-full bg-sunken p-2 text-graphite transition-colors hover:text-ink"
        >
          <Settings2 size={16} aria-hidden />
        </button>
      </div>
      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-graphite">{bio}</p>
      {space && (space.links.length > 0 || space.tips.length > 0) && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {space.links.map((l) => (
            <li key={l.url}>
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className={CHIP}
              >
                {l.label}
                <ExternalLink size={11} aria-hidden />
              </a>
            </li>
          ))}
          {space.tips.length > 0 && (
            <li>
              <button type="button" onClick={() => setTipsOpen(true)} className={CHIP}>
                <Coffee size={11} aria-hidden />
                打赏
              </button>
            </li>
          )}
        </ul>
      )}
      {space?.markdown && (
        <Suspense fallback={null}>
          <Markdown className="mt-5 text-[14px]">{space.markdown}</Markdown>
        </Suspense>
      )}
      {tipsOpen && space && <TipsSheet tips={space.tips} onClose={() => setTipsOpen(false)} />}
    </header>
  )
}

/** 链接与打赏共用的 chip 样式 —— 同一行里两种控件读起来必须是同一种东西 */
const CHIP =
  'inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] px-2.5 py-1 text-[12px] text-graphite transition-colors hover:border-ink/20 hover:text-ink'
