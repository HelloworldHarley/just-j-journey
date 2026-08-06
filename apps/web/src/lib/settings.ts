import { useSyncExternalStore } from 'react'
import type { AccentKey, GroupKey } from '@jjj/schema'

/**
 * 用户偏好的唯一存取门面。
 *
 * 「视图状态」和「用户设置」是两回事，这里只管后者：
 * 简/详、周/月这类跟着视图走的开关就地读写各自的键；配色、租车底色
 * 这类跨视图的长期偏好全部住在这一个对象、这一个 localStorage 键下。
 * 将来首页的设置面板只跟这个模块说话，不用从好几处拼数据。
 *
 * 配色的**注入**不在这里 —— 那是 palette.ts 的事。这里只存值。
 */

const STORAGE_KEY = 'jjj:settings'

export type PaletteToken = GroupKey | AccentKey

export interface TokenColor {
  light: string
  dark: string
}

export interface Settings {
  /** 配色覆盖，只存改过的 token，其余落回 DEFAULT_PALETTE */
  palette: Partial<Record<PaletteToken, TokenColor>>
  /** 周视图里租车期间铺一层底色。默认关 —— 一天的信息密度已经不低。 */
  rentalBand: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  palette: {},
  rentalBand: false,
}

/**
 * 缓存不只是为了少读几次 localStorage：useSyncExternalStore 要求
 * getSnapshot 在没变化时返回**同一个引用**，每次现 parse 会让它判定成
 * 无限更新。所以读一次记住，写的时候整体换新。
 */
let cache: Settings | null = null
const listeners = new Set<() => void>()

export function readSettings(): Settings {
  if (cache) return cache
  let stored: Partial<Settings> = {}
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Settings>
  } catch {
    stored = {}
  }
  cache = { ...DEFAULT_SETTINGS, ...stored }
  return cache
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next = { ...readSettings(), ...patch }
  cache = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 隐私模式 / 配额满：写不进磁盘不影响本次会话，内存里照样生效
  }
  for (const fn of listeners) fn()
  return next
}

export function resetSettings(): void {
  cache = DEFAULT_SETTINGS
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 同上
  }
  for (const fn of listeners) fn()
}

export function subscribeSettings(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** 组件里读设置。设置一变，所有读它的组件自己重渲染。 */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, readSettings)
}
