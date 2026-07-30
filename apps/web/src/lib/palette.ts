import { GROUPS, GROUP_KEYS, type GroupKey } from '@trip-atlas/schema'

/**
 * 分组配色的运行时来源。
 *
 * 组件一律引用 `var(--g-play)` 这类变量，不直接读 GROUPS 的色值。
 * 于是「首页加一个设置按钮让用户自定义配色」这件事，将来只需要
 * 调 setGroupColor() 写 localStorage，**不用碰任何组件**。
 */

const STORAGE_KEY = 'trip-atlas:palette'

export interface GroupColor {
  light: string
  dark: string
}

export type Palette = Record<GroupKey, GroupColor>

export const DEFAULT_PALETTE: Palette = Object.fromEntries(
  GROUP_KEYS.map((g) => [g, { light: GROUPS[g].color, dark: GROUPS[g].colorDark }]),
) as Palette

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
    GROUP_KEYS.map((g) => [g, overrides[g] ?? DEFAULT_PALETTE[g]]),
  ) as Palette
}

/** 把配色写成 :root 上的 CSS 变量。深浅色两套都写，由媒体查询挑。 */
export function applyPalette(palette: Palette = currentPalette()): void {
  const root = document.documentElement
  for (const g of GROUP_KEYS) {
    root.style.setProperty(`--g-${g}`, palette[g].light)
    root.style.setProperty(`--g-${g}-dark`, palette[g].dark)
  }
}

/** 预留给将来的设置面板 */
export function setGroupColor(group: GroupKey, color: GroupColor): void {
  const next = { ...currentPalette(), [group]: color }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  applyPalette(next)
}

export function resetPalette(): void {
  localStorage.removeItem(STORAGE_KEY)
  applyPalette(DEFAULT_PALETTE)
}
