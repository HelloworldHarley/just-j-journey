/**
 * 首页「行程指纹」竖条的排布公式 —— 纯函数，组件只画。
 *
 * 条宽随天数收缩，长途行程也不会撑破卡片；上限 20px 防止两三天的
 * 短行程画成三根粗柱子，下限 3px 保证一个月的长行程每天仍可辨认。
 */
export function dayBarLayout(
  count: number,
  /** 窄屏让出更多空间给标题 */
  narrow: boolean,
): { blockW: number; gap: number; barW: number } {
  const blockW = narrow ? 80 : 104
  const gap = count > 12 ? 1 : 3
  const barW = Math.max(3, Math.min(20, (blockW - gap * (count - 1)) / count))
  return { blockW, gap, barW }
}
