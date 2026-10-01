import { useEffect, useRef } from 'react'
import { ExternalLink, X } from 'lucide-react'
import type { SpaceTip } from '@jjj/schema'
import { useRepository } from '../../data/hooks.ts'

/**
 * 打赏抽屉 —— 二维码横排（手机上一屏一张、可左右滑，不显示滚动条），链接项渲染成按钮。
 * 二维码是给人扫的：图要大（手机宽度下约 220px 见方），标签在图下方。
 * 公开版和完整版都显示；工具不预设平台，微信 / 支付宝 / Buy Me a Coffee 都只是数据。
 *
 * 遮罩 / 容器与 SettingsSheet 同款 —— 同一站里两种底部抽屉不该长得不一样：
 * `bg-black/35` 而不是 `bg-ink/30`（`--ink` 深色模式下接近白，会把遮罩点亮而不是压暗）；
 * `sm:items-center` + `sm:rounded-2xl` 让宽屏上居中弹窗，而不是永远贴底。
 */
export function TipsSheet({ tips, onClose }: { tips: SpaceTip[]; onClose: () => void }) {
  const repo = useRepository()
  const images = tips.filter((t) => t.image)
  const links = tips.filter((t) => t.url)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 backdrop-blur-[2px] sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="打赏"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl border border-[var(--hairline)] bg-raised px-5 pb-8 pt-4 shadow-[var(--shadow)] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="display text-[17px] text-ink">打赏</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-full p-1 text-graphite hover:text-ink"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <p className="mt-1 text-[12.5px] text-graphite">攻略有用的话，请我喝杯咖啡。</p>
        {images.length > 0 && (
          <div className="-mx-5 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {images.map((t) => (
              <figure key={t.image} className="w-[220px] shrink-0 snap-center">
                <img src={repo.assetUrl(t.image!)} alt={`${t.label}打赏二维码`} className="h-[220px] w-[220px] rounded-xl bg-paper object-contain" />
                <figcaption className="mt-2 text-center text-[12.5px] text-graphite">{t.label}</figcaption>
              </figure>
            ))}
          </div>
        )}
        {links.length > 0 && (
          <div className="mt-4 grid gap-2">
            {links.map((t) => (
              <a
                key={t.url}
                href={t.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl border border-[var(--hairline)] px-4 py-2.5 text-[14px] text-ink transition-colors hover:border-ink/20"
              >
                {t.label}
                <ExternalLink size={13} className="text-graphite" aria-hidden />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
