/**
 * 「天」的配色环。
 *
 * 与类别色是两套独立体系，因为它们服务于不同的视图：
 *   地图  颜色 = 天（路径必须按天区分），图标 = 类别
 *   列表/日历  颜色 = 类别（天已由分组表达）
 * 不这么分工，两套色系会在同一屏里互相打架。
 *
 * 这一环是为「浅色底图上的路径线」调的：饱和度更高、明度更低，
 * 压得住地图底噪。超过 12 天循环复用。
 */
export const DAY_COLORS = [
  '#D6402F', // 朱
  '#1170A8', // 钴蓝
  '#1F7A4C', // 松绿
  '#B5610C', // 琥珀
  '#7A3E9D', // 紫罗兰
  '#00767A', // 孔雀
  '#A31B57', // 覆盆子
  '#4A5EAE', // 群青
  '#6B7B12', // 橄榄
  '#B03A6B', // 玫红
  '#3F6B8C', // 钢蓝
  '#8A4B22', // 赭石
] as const

export function dayColor(index: number): string {
  return DAY_COLORS[(index - 1) % DAY_COLORS.length] ?? DAY_COLORS[0]
}

/**
 * 界面强调色 —— 分组色之外的可自定义色槽。
 * 住=中性（保持现状）、行=蓝、收藏=金。与分组色走同一套
 * CSS 变量注入 + localStorage 覆盖机制，将来设置面板统一管。
 */
export const ACCENT_KEYS = ['stay', 'move', 'faved', 'tight'] as const
export type AccentKey = (typeof ACCENT_KEYS)[number]

export const ACCENTS: Record<AccentKey, { color: string; colorDark: string }> = {
  stay: { color: '#6B7684', colorDark: '#9AA5B3' },
  move: { color: '#2963D6', colorDark: '#84ACF4' },
  faved: { color: '#B8860B', colorDark: '#E8C05C' },
  /** 注意/警示红 —— index.css 的 --tight 引用它，全站唯一的「会出事」信号色 */
  tight: { color: '#C0392B', colorDark: '#FF7A6B' },
}
