import type { Reference } from '@jjj/schema'

/**
 * 预算类附录归预算页 —— 作者写的点数策略、砍价顺序、风险变量
 * 和自动统计的数字放在一起才有用；资料页不再出现预算分区。
 */
export function isBudgetRef(ref: Reference): boolean {
  return ref.id === 'budget' || /预算|budget/i.test(ref.title)
}
