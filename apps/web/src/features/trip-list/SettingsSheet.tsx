import { useEffect, useRef, useState } from 'react'
import { Check, Moon, Pipette, RotateCcw, Sun, SunMoon, X } from 'lucide-react'
import { CATEGORIES, CATEGORIES_BY_KIND, type KindKey } from '@jjj/schema'
import {
  DEFAULT_PALETTE,
  currentPalette,
  resetPalette,
  resetPaletteColor,
  setPaletteColor,
} from '../../lib/palette.ts'
import {
  updateSettings,
  useSettings,
  type PaletteToken,
  type ThemeMode,
} from '../../lib/settings.ts'

/**
 * 设置面板 —— iOS 设置页的分组列表语言：圆角分组、行内控件、组间留白。
 *
 * 只跟 lib/settings.ts 一个门面说话；外观与配色的**应用**由 main.tsx
 * 的订阅统一负责（改设置 → 重新应用），这里不碰 DOM。
 */

const THEME_OPTIONS: { key: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { key: 'system', label: '跟随系统', Icon: SunMoon },
  { key: 'light', label: '浅色', Icon: Sun },
  { key: 'dark', label: '深色', Icon: Moon },
]

/** 每行的说明直接列它管的那些类别（十八类各归其主） */
const kindCats = (kind: KindKey): string =>
  CATEGORIES_BY_KIND[kind].map((k) => CATEGORIES[k].zh).join(' · ')

interface ColorRow {
  token: PaletteToken
  label: string
  hint: string
}

/** 五个行程色 —— 与列表筛选同序 */
const KIND_ROWS: ColorRow[] = [
  { token: 'play', label: '玩', hint: kindCats('play') },
  { token: 'food', label: '吃', hint: kindCats('food') },
  { token: 'stay', label: '住', hint: kindCats('stay') },
  { token: 'move', label: '行', hint: kindCats('move') },
  { token: 'other', label: '其他', hint: kindCats('misc') },
]

/** 两个界面语义色 —— 单独一组，和行程色留出呼吸缝 */
const SEMANTIC_ROWS: ColorRow[] = [
  { token: 'tight', label: '注意', hint: '警示角标 · 时间冲突 · 跨天 +n' },
  { token: 'faved', label: '收藏', hint: '收藏星与预算数字' },
]

const ALL_ROWS = [...KIND_ROWS, ...SEMANTIC_ROWS]

/**
 * 标准色板，顺序固定三行（7 列）：
 *   ① 彩虹七色 —— 红橙黄绿青蓝紫
 *   ② 从黑到白七档
 *   ③ 六个扩展色 + 调色板开关（无级调节的唯一入口）
 *
 * 六个默认色（玩绿 / 吃桃红 / 住行灰蓝 / 行蓝 / 收藏金=黄 / 注意红）
 * 都是网格里的正式成员 —— 选中态直接落在它所在的格子上，没有特殊的「默认」格；
 * 点中恰好等于默认值的色 = 恢复默认（覆盖表里不留冗余项）。
 * 每格都带调校过的深色档：深色模式要更亮一档才有对比度。
 */
const SWATCHES: { light: string; dark: string; name: string }[] = [
  // ── ① 彩虹 ──
  { light: '#c0392b', dark: '#ff7a6b', name: '红' }, // 注意默认
  { light: '#e8710a', dark: '#ffa257', name: '橙' },
  { light: '#b8860b', dark: '#e8c05c', name: '黄' }, // 收藏默认
  { light: '#0e9160', dark: '#4fc58c', name: '绿' }, // 玩默认
  { light: '#0f9d8f', dark: '#4cc9b0', name: '青' },
  { light: '#2963d6', dark: '#84acf4', name: '蓝' }, // 行默认
  { light: '#9d4edd', dark: '#c49af0', name: '紫' },
  // ── ② 黑 → 白 ──
  { light: '#1c1917', dark: '#e7e2da', name: '黑' },
  { light: '#44403c', dark: '#c4beb4', name: '深灰' },
  { light: '#6b7684', dark: '#9aa5b3', name: '灰蓝' }, // 住/其他默认
  { light: '#78716c', dark: '#8f8b84', name: '中灰' },
  { light: '#a09a90', dark: '#6f6a62', name: '浅灰' },
  { light: '#cfc8bb', dark: '#57534e', name: '米灰' },
  { light: '#ffffff', dark: '#f0ede8', name: '白' },
  // ── ③ 扩展 ──
  { light: '#d6407c', dark: '#f58cb4', name: '桃红' }, // 吃默认
  { light: '#a31b57', dark: '#ef7fae', name: '玫红' },
  { light: '#5856d6', dark: '#9a99f2', name: '靛' },
  { light: '#00767a', dark: '#5fc7cb', name: '孔雀' },
  { light: '#6b7b12', dark: '#b9c46a', name: '橄榄' },
  { light: '#8a5a2b', dark: '#c99e6e', name: '棕' },
]

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const settings = useSettings()
  const palette = currentPalette()
  const closeRef = useRef<HTMLButtonElement>(null)
  const nativeRef = useRef<HTMLInputElement>(null)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 正在改哪一行；色板常驻底部，先点行、再点色 */
  const [target, setTarget] = useState<PaletteToken | null>(null)
  /** 滚动进行中 —— 控制滚动条滑块的显隐 */
  const [scrolling, setScrolling] = useState(false)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
    }
  }, [onClose])

  const onSheetScroll = (): void => {
    setScrolling(true)
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
    scrollTimer.current = setTimeout(() => setScrolling(false), 600)
  }

  const customized = Object.keys(settings.palette).length > 0
  const targetRow = ALL_ROWS.find((r) => r.token === target)
  const currentLight = target ? palette[target].light.toLowerCase() : null
  const currentInGrid = SWATCHES.some((s) => s.light === currentLight)

  const pick = (light: string, dark: string): void => {
    if (!target) return
    // 点中恰好是默认值的格子 = 回默认，不往覆盖表里塞冗余项
    if (light.toLowerCase() === DEFAULT_PALETTE[target].light.toLowerCase()) {
      resetPaletteColor(target)
    } else {
      setPaletteColor(target, { light, dark })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 backdrop-blur-[2px]
                 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        onClick={(e) => e.stopPropagation()}
        onScroll={onSheetScroll}
        className={`sheet-scroll max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-paper
                    px-4 pb-8 pt-3 shadow-[var(--shadow)] sm:rounded-2xl ${
                      scrolling ? 'scrolling' : ''
                    }`}
      >
        {/* 头部：标题 + 关闭 */}
        <div className="flex items-center justify-between py-2">
          <h2 className="display text-[17px] tracking-[-0.01em] text-ink">设置</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="关闭设置"
            className="rounded-full bg-sunken p-1.5 text-graphite transition-colors hover:text-ink"
          >
            <X size={15} aria-hidden />
          </button>
        </div>

        {/* 外观 */}
        <Section title="外观">
          <div role="radiogroup" aria-label="外观" className="flex gap-1 rounded-xl bg-sunken p-1">
            {THEME_OPTIONS.map(({ key, label, Icon }) => {
              const active = settings.theme === key
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => updateSettings({ theme: key })}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-[10px] py-2 text-[12px]
                              transition-colors ${
                                active
                                  ? 'bg-raised font-medium text-ink shadow-sm'
                                  : 'text-graphite hover:text-ink'
                              }`}
                >
                  <Icon size={16} aria-hidden />
                  {label}
                </button>
              )
            })}
          </div>
        </Section>

        {/* 配色：先点一行选中（描边提示），再在底部色板点色，点完即生效 */}
        <Section
          title="配色"
          action={
            /* 位置常驻、只切换可见性 —— 出现/消失时页面不抖 */
            <button
              type="button"
              onClick={resetPalette}
              tabIndex={customized ? 0 : -1}
              aria-hidden={!customized}
              className={`inline-flex items-center gap-1 text-[11.5px] text-graphite
                          transition-opacity hover:text-ink ${
                            customized ? 'opacity-100' : 'pointer-events-none opacity-0'
                          }`}
            >
              <RotateCcw size={11} aria-hidden />
              全部恢复默认
            </button>
          }
        >
          <RowGroup
            rows={KIND_ROWS}
            palette={palette}
            overrides={settings.palette}
            target={target}
            onToggle={(t) => setTarget(target === t ? null : t)}
          />
          {/* 语义色与行程色之间的呼吸缝 */}
          <div className="mt-2.5">
            <RowGroup
              rows={SEMANTIC_ROWS}
              palette={palette}
              overrides={settings.palette}
              target={target}
              onToggle={(t) => setTarget(target === t ? null : t)}
            />
          </div>

          {/* 常驻色板：三行七列 */}
          <div
            className={`mt-2.5 rounded-xl bg-raised px-3.5 py-3 transition-opacity ${
              target ? '' : 'pointer-events-none opacity-45'
            }`}
          >
            <p className="mb-2 text-[11.5px] text-graphite">
              {targetRow ? (
                <>
                  正在更换<span className="mx-1 font-medium text-ink">{targetRow.label}</span>
                  的颜色，点色即生效
                </>
              ) : (
                '先点上面一行，再点这里的颜色'
              )}
            </p>
            <div className="grid grid-cols-7 gap-2">
              {SWATCHES.map((s) => {
                const selected = currentLight === s.light
                const isDefaultOfTarget =
                  target !== null && DEFAULT_PALETTE[target].light.toLowerCase() === s.light
                return (
                  <button
                    key={s.light}
                    type="button"
                    title={isDefaultOfTarget ? `${s.name}（默认）` : s.name}
                    aria-label={isDefaultOfTarget ? `${s.name}（默认）` : s.name}
                    aria-pressed={selected}
                    onClick={() => pick(s.light, s.dark)}
                    className={`relative flex h-7 w-7 items-center justify-center rounded-full
                                border border-black/10 transition-transform hover:scale-110 ${
                                  selected
                                    ? 'ring-2 ring-[var(--ink)] ring-offset-1 ring-offset-[var(--paper-raised)]'
                                    : ''
                                }`}
                    style={{ background: s.light }}
                  >
                    {selected && (
                      <Check
                        size={12}
                        className={s.name === '白' || s.name === '米灰' ? 'text-black/60' : 'text-white drop-shadow'}
                        aria-hidden
                      />
                    )}
                    {/* 默认色的小白角标 —— 一眼找到「出厂值」在哪格 */}
                    {isDefaultOfTarget && !selected && (
                      <span
                        aria-hidden
                        className="absolute bottom-[3px] h-1 w-1 rounded-full bg-white/80"
                      />
                    )}
                  </button>
                )
              })}
              <button
                type="button"
                title="其他…"
                aria-label="自定义颜色"
                onClick={() => nativeRef.current?.click()}
                className={`flex h-7 w-7 items-center justify-center rounded-full border
                            border-[var(--hairline)] bg-sunken text-graphite transition-colors
                            hover:text-ink ${
                              target && !currentInGrid
                                ? 'ring-2 ring-[var(--ink)] ring-offset-1 ring-offset-[var(--paper-raised)]'
                                : ''
                            }`}
              >
                <Pipette size={12} aria-hidden />
              </button>
            </div>
            <input
              ref={nativeRef}
              type="color"
              value={target ? palette[target].light : '#888888'}
              onChange={(e) => pick(e.target.value, e.target.value)}
              aria-hidden
              tabIndex={-1}
              className="pointer-events-none absolute h-0 w-0 opacity-0"
            />
          </div>
        </Section>

      </div>
    </div>
  )
}

function RowGroup({
  rows,
  palette,
  overrides,
  target,
  onToggle,
}: {
  rows: ColorRow[]
  palette: Record<PaletteToken, { light: string }>
  overrides: Partial<Record<PaletteToken, unknown>>
  target: PaletteToken | null
  onToggle: (t: PaletteToken) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-raised">
      {rows.map(({ token, label, hint }, i) => {
        const selected = target === token
        return (
          <button
            key={token}
            type="button"
            onClick={() => onToggle(token)}
            aria-pressed={selected}
            /*
              选中态贴着行自己的边界走（ring-inset）。首/尾行带上与分组容器
              一致的圆角 —— 底色块和描边在组的四个角上跟着外形拐弯，
              不然第一行的高亮是方的、容器却是圆的。
            */
            className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors
                        first:rounded-t-xl last:rounded-b-xl ${
                          i > 0 ? 'border-t border-[var(--hairline)]' : ''
                        } ${selected ? 'bg-sunken ring-2 ring-inset ring-[var(--ink)]' : ''}`}
          >
            <span className="w-8 shrink-0 text-[13.5px] font-medium text-ink">{label}</span>
            <span className="min-w-0 flex-1 truncate text-[11.5px] text-graphite">
              {hint}
              {token in overrides && <span className="ml-1.5 text-soft">已自定义</span>}
            </span>
            <span
              aria-hidden
              className="h-5 w-5 shrink-0 rounded-full border border-black/10"
              style={{ background: palette[token].light }}
            />
          </button>
        )
      })}
    </div>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h3 className="signage text-[11px] text-graphite">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}
