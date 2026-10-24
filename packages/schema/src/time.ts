/**
 * 时间模型
 *
 * 全部时间以「距当天 00:00 的分钟数」表示。跨午夜的事件 end 允许 > 1440。
 * 这样时间脊柱可以直接按 (end - start) 算高度，不需要在渲染层反复解析字符串。
 */

export const TIME_KINDS = ['exact', 'point', 'period', 'allday'] as const
export type TimeKind = (typeof TIME_KINDS)[number]

export const PERIOD_KEYS = ['morning', 'afternoon', 'evening', 'night'] as const
export type PeriodKey = (typeof PERIOD_KEYS)[number]

/**
 * 时段关键字映射到的默认时间窗。
 *
 * 这些是「未定」而非「排定」—— UI 必须用斜纹块区分，
 * 否则一个 afternoon 会被误读成真的从 13:00 排到 18:00。
 */
export const PERIOD_WINDOWS: Record<PeriodKey, [number, number]> = {
  morning: [8 * 60, 12 * 60],
  afternoon: [13 * 60, 18 * 60],
  evening: [18 * 60, 22 * 60],
  night: [22 * 60, 24 * 60],
}

export const PERIOD_ZH: Record<PeriodKey, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '傍晚',
  night: '夜间',
}


// 怎么认（时段别名、resolvePeriod）住在 @jjj/tripmd 的 vocab.ts，时刻的解析与格式化在 values.ts ——
// schema 只描述形状、不做决定。
