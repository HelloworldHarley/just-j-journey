import { ACCENTS, ACCENT_KEYS, GROUPS, GROUP_KEYS, type AccentKey, type GroupKey } from '@jjj/schema'

/**
 * 配色的运行时来源。
 *
 * 组件一律引用 CSS 变量（--g-play / --a-move …），不直接读色值。
 * 于是「设置面板让用户自定义配色」将来只需要调 setPaletteColor()
 * 写 localStorage，**不用碰任何组件**。
 *
 * token 两类：分组色（玩/吃/其他，卡片与竖条用）+ 强调色（住/行/收藏，
 * 筛选栏图标与收藏星用）。同一套机制，同一个覆盖入口。
 */

const STORAGE_KEY = 'jjj:palette'

export type PaletteToken = GroupKey | AccentKey

export interface TokenColor {
  light: string
  dark: string
}

export type Palette = Record<PaletteToken, TokenColor>

const TOKEN_KEYS: PaletteToken[] = [...GROUP_KEYS, ...ACCENT_KEYS]

export const DEFAULT_PALETTE: Palette = {
  ...(Object.fromEntries(
    GROUP_KEYS.map((g) => [g, { light: GROUPS[g].color, dark: GROUPS[g].colorDark }]),
  ) as Record<GroupKey, TokenColor>),
  ...(Object.fromEntries(
    ACCENT_KEYS.map((a) => [a, { light: ACCENTS[a].color, dark: ACCENTS[a].colorDark }]),
  ) as Record<AccentKey, TokenColor>),
}

function readOverrides(): Partial<Palette> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Partial<Palette>) : {}
  } catch {
    return {}
  }
}

export function currentPalette(): Palette {
  const overrides = readOverrides()
  return Object.fromEntries(
    TOKEN_KEYS.map((t) => [t, overrides[t] ?? DEFAULT_PALETTE[t]]),
  ) as Palette
}

/** 分组用 --g-*，强调用 --a-*。深浅两套都写，由媒体查询挑。 */
function varName(token: PaletteToken): string {
  return (GROUP_KEYS as readonly string[]).includes(token) ? `--g-${token}` : `--a-${token}`
}

export function applyPalette(palette: Palette = currentPalette()): void {
  const root = document.documentElement
  for (const t of TOKEN_KEYS) {
    root.style.setProperty(varName(t), palette[t].light)
    root.style.setProperty(`${varName(t)}-dark`, palette[t].dark)
  }
}

/** 预留给将来的设置面板 */
export function setPaletteColor(token: PaletteToken, color: TokenColor): void {
  const next = { ...currentPalette(), [token]: color }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  applyPalette(next)
}

export function resetPalette(): void {
  localStorage.removeItem(STORAGE_KEY)
  applyPalette(DEFAULT_PALETTE)
}
