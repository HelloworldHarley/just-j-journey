/**
 * 重叠区间分道 —— 日历里唯一的一份泳道算法。
 *
 * 月视图拿它排住宿/租车的横向区间带，周视图拿它把同一时段撞在一起的事件
 * 并排摊开。两处的坐标不同（一个是天，一个是分钟），但「谁和谁撞了、
 * 该摊成几栏」是同一个问题，公式只写一遍。
 */

export interface Interval {
  from: number
  to: number
}

export interface Lane {
  /** 第几道，0 起 */
  lane: number
  /**
   * 这一簇总共摊了几道。
   *
   * 按**簇**而不是全局算：上午撞了两件事，不该让下午孤零零的一件也缩成半栏。
   */
  lanes: number
}

/**
 * 返回值与入参同序。
 *
 * 贪心：按开始时刻扫，落进第一条空出来的道；一簇结束（下一个的开始
 * 晚于簇内所有的结束）就结算这一簇的道数。
 */
export function packLanes(items: Interval[]): Lane[] {
  const order = items
    .map((it, i) => ({ i, from: it.from, to: it.to }))
    .sort((a, b) => a.from - b.from || a.to - b.to)

  const out: Lane[] = items.map(() => ({ lane: 0, lanes: 1 }))
  let cluster: number[] = []
  let clusterEnd = -Infinity
  let laneEnds: number[] = []

  const closeCluster = (): void => {
    for (const i of cluster) out[i]!.lanes = laneEnds.length || 1
    cluster = []
    laneEnds = []
  }

  for (const item of order) {
    if (item.from >= clusterEnd) {
      closeCluster()
      clusterEnd = -Infinity
    }
    let lane = laneEnds.findIndex((end) => end <= item.from)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = item.to
    out[item.i] = { lane, lanes: 1 }
    cluster.push(item.i)
    clusterEnd = Math.max(clusterEnd, item.to)
  }
  closeCluster()
  return out
}
