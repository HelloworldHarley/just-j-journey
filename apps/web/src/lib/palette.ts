import { ACCENTS, ACCENT_KEYS, GROUPS, GROUP_KEYS } from '@jjj/schema'
import {
  readSettings,
  updateSettings,
  type PaletteToken,
  type TokenColor,
} from './settings.ts'

/**
 * 把配色注入 CSS 变量 —— 这个模块只做这一件事。
 *
 * 组件一律引用变量（--g-play / --a-move …），不直接读色值；色值本身住在
 * settings.ts。于是「设置面板让用户自定义配色」只要写设置，
 * main.tsx 订阅到变化后重新注入，**任何组件都不用动**。
 *
 * token 两类：分组色（玩/吃/其他，卡片与竖条用）+ 强调色（住/行/收藏，
 * 筛选栏图标与收藏星用）。同一套机制，同一个覆盖入口。
 */

export type Palette = Record<PaletteToken, TokenColor>

const TOKEN_KEYS: PaletteToken[] = [...GROUP_KEYS, ...ACCENT_KEYS]

export const DEFAULT_PALETTE: Palette = Object.fromEntries([
  ...GROUP_KEYS.map((g) => [g, { light: GROUPS[g].color, dark: GROUPS[g].colorDark }]),
  ...ACCENT_KEYS.map((a) => [a, { light: ACCENTS[a].color, dark: ACCENTS[a].colorDark }]),
]) as Palette

export function currentPalette(): Palette {
  const overrides = readSettings().palette
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

/**
 * 预留给将来的设置面板。只写设置就够了 ——
 * main.tsx 订阅了设置变化，注入由那条订阅统一负责。
 */
export function setPaletteColor(token: PaletteToken, color: TokenColor): void {
  updateSettings({ palette: { ...readSettings().palette, [token]: color } })
}

export function resetPalette(): void {
  updateSettings({ palette: {} })
}

export type { PaletteToken, TokenColor }
