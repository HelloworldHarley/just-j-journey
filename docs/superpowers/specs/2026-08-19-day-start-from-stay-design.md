# 每天从住处出发 · 2026-08-19

Harley 试用地图后提的两条：

1. 除了落地日这类例外，**每天都该从住处出发**。西雅图 Day 2 早上从 Astra 出门，
   列表和地图上都没有这一段 —— 一天凭空从派克市场开始。
   列表里**不要为此多开一张事件卡**，但通勤必须看得见。
2. 两个地点坐标重合时，pin 精确叠在一起，下面那枚等于不存在。**要错位**。

## 背景：这段路今天没有归宿

`legs` 全部由事件的 `to_next` 派生（`tripmd/days.ts`），一条 leg 必须挂在
**某个事件之后**（`afterEventId`）。当天第一段路没有「上一个事件」可挂 ——
于是它在数据模型里根本无处安放，列表和地图都不是「忘了画」，而是压根没有。

住宿信息倒是齐的：`trip-stays` 是带 from/to 的区间记录，谁都能算出
「这一天你在哪儿醒来」。缺的只是把它接进当天动线的那根钩子。

## 决策与理由

| 维度 | 决策 | 理由 |
|---|---|---|
| 起点从哪来 | **从 `trip-stays` 区间推**，不让作者每天重写一遍酒店名 | 名字重复书写就会漂；区间记录本来就是唯一真相 |
| 「这天住哪」的判据 | `stay.from.date < day.date ≤ stay.to.date` | **只比日期不比时刻**，没有时区与分钟的边界问题。落地日天然被排除（Astra 从 10-01 起，10-01 不满足 `from.date < date`） |
| 通勤方式/时长 | 作者写 `trip-day` 的新键 **`from_stay:`**，形状与 `to_next` 完全一致 | 纯派生给不出「走 20 分钟还是开 12 分钟」，而这正是通勤条上唯一有用的信息。ORS 也需要 mode 才知道按哪套路网算 |
| 落成什么 | `day.legs` 的第一条 `Leg`，`afterEventId: null` | 复用整条既有链路：enrich 按 `routeKey(mode, from, to)` 认路线，**一行不用改**就能把这段算成真路网实线 |
| 该有没写 | lint **warning** | 仓库的诊断哲学是吵闹；静默漏掉一段路正是这次要修的病 |
| 挂在 day 而非首个事件 | `from_stay` 写进 ```trip-day | 删掉当天第一个事件时，挂在事件上的 `to_next` 会一起烂掉（patch.ts 为此专门处理过），挂在天上的则自动重新指向新的第一个事件 |
| 对称的 `to_stay` | **不做** | 现有数据里每天要么已有「回酒店/入住」事件，要么末站本身就在住处（Day 2 的顶楼酒吧就是 Astra）。加了没人用 |
| pin 错位范围 | **整个场景一起聚类**，与选中天无关 | 只在当天内散，切天时 pin 会挪位置；跨天一起散则位置恒定，只有淡化在变 |

## 形状

```yaml
```trip-day
theme: 提车自驾，市区一路玩到 Kerry Park 日落
sunrise: "07:08"
sunset: "18:50"
from_stay: {mode: walk, minutes: 20, label: 顺 Denny Way 下坡}
```
```

键与 `to_next` 同一套：`mode` / `minutes`(`min`) / `km` / `label` / `note`。
**起点不写** —— 解析器从当晚住宿认领。

## 规则住哪

放置原则不变：形状 → schema，能从 `Trip` 独立回答的规则 → tripmd，认屏幕的数学 → web lib。

| 位置 | 承担 |
|---|---|
| `schema/trip.ts` | `Leg.afterEventId: string \| null`，null = 当天开场那一段 |
| `tripmd/resolve.ts` | `stayOfMorning(stays, date)` —— 「这一天你在哪儿醒来」的唯一一份判据 |
| `tripmd/days.ts` | 建 leg（与 `to_next` 的 leg 同一段代码路径）+ 构造期错误 |
| `tripmd/lint.ts` | `lintDayOpening` —— 「该有却没写」的 warning |
| `tripmd/serialize.ts` | `from_stay` 回写 trip-day 块，往返幂等 |
| `web/lib/layout.ts` | 当天首卡之前多一行 `LegRow`，**不多事件卡** |
| `web/lib/map-scene.ts` | 住处成为当天第 1 站；`pinOffsets` 算重合错位 |

### 诊断

| 情形 | 级别 | 出处 |
|---|---|---|
| 有住处、首个事件不在住处、没写 `from_stay` | warning | lint.ts（没东西可建，是语义检查） |
| 写了 `from_stay` 但首个事件就在住处 | error | days.ts（构造期就知道这段路不存在） |
| 写了 `from_stay` 但当天没有住宿区间覆盖 | error | days.ts（同上，如落地日） |
| `from_stay` 的 mode 无效 / 未知子键 | error / warning | days.ts，与 `to_next` 同一套 |

## 渲染

**列表**：当天第一张卡之前一行通勤条，复用 `LegConnector`，开头多一句「Astra Hotel 出发」。
余量检查跳过 —— 没有上一个事件的结束时刻可减，`slackMin: null`。

**地图**：住处成为当天第 1 站，其余序号顺延。开场段与其他段同规矩：
有几何画实线，没有画虚线。小卡上这一站没有事件，显示「今天从这里出发」。

`dayPaths` 内部随之改成「站 + 从该站出发的那条 leg」配对，
不再用 `afterEventId` 在循环里回查 —— 开场站没有事件 id 可查。

**错位**：`pinOffsets(paths)` 纯函数，返回每枚 pin 的像素偏移，喂 `marker.setOffset()`。

- 按坐标聚类，容差沿用 geometry 那个 `1e-5`（约 1 米）
- 单枚 → `[0,0]`；n 枚均匀排在半径 `12 / sin(π/n)` 的圆上（pin 直径 22px + 2px 间隙时相邻恰不重叠），正上方起顺时针
- 排序 `(dayIndex, seq)`，与选中天无关 —— 切天时 pin 不动
- **折线仍连真实坐标**，只有 pin 挪；像素偏移，缩放不变形

## 数据

西雅图这份命中两天（其余三天：Day 1 落地日无住宿区间；Day 3/4 首个事件就在住处）：

| 天 | 起点 → 首站 | from_stay |
|---|---|---|
| Day 2 | Astra Hotel → 派克市场 | `{mode: walk, minutes: 20}` |
| Day 5 | Renaissance Seattle → Jade Garden | `{mode: walk, minutes: 12}` |

补完后重跑 `pnpm enrich seattle-2026-10`，这两段进真路网。

## 验证

`pnpm typecheck && pnpm test && pnpm data:check && pnpm build`，
`_broken` 的错误数会变（它现在恰好 6 错，新规则可能加一条），
再 Playwright 截图核对 Day 2 / Day 5 的列表与地图，含 390px 与深浅两套主题。

## 实现记录（与设计的偏差）

设计全部落地，两条渲染与两天数据都按上面的样子出来了。偏差如下。

### 1. `to_next` 与 `from_stay` 合并成一份读写

设计只说「形状与 `to_next` 完全一致」，实现时把这句话当真了：`days.ts` 抽出
`readMode()`（mode 校验 + 拼写建议，只有报错文案里的字段名不同）与 `flowValues()`
（minutes/min/km/label/note），`serialize.ts` 抽出 `legFlow()`。两个键从此不可能各自漂移 ——
形状「一致」如果靠两份代码各写一遍去维持，迟早会不一致。

### 2. `buildDays` 的参数收敛成具名 `DayContext`

`stays` 是它的第六个位置参数，排到那儿已经没人读得懂调用点了。顺手把
`dates` / `resolvePlaceRef` / `detailNames` 一起收进一个具名对象。

### 3. 多一条诊断：写了 `from_stay` 但当天没有事件

设计的诊断表列了三种错，漏了这一种。它不是错误而是 **warning** —— 当天空着可能只是
还没写完，不该拦住解析；但 `from_stay` 确实没有去处，得说一声。

### 4. 余量检查的另一半在 lint 侧

设计说列表里开场段 `slackMin: null`。对应地 `lintDayFlow` 也要跳过它 ——
`afterEventId` 为 null 时压根找不到「上一个事件」，不跳过就会拿 `undefined` 去算余量。
渲染与诊断是同一条规则的两头，两边都得写。

### 5. pin 聚类用「量化到容差格」而不是逐对比容差

设计说「按坐标聚类，容差 `1e-5`」。实现是把坐标除以容差取整当 key 分桶：一趟 O(n)，
且分组结果与遍历顺序无关。代价是格边界上的抖动（差一格的两枚会分到不同组），
但差一格的两枚 pin 本来就画在同一个像素上，谁跟谁一组都对。

半径写成 `PIN_GAP / 2 / sin(π/n)`，`PIN_GAP = 24`（pin 直径 22 + 2px 缝）——
和设计里的 `12 / sin(π/n)` 是同一个数，只是把 22 和 2 这两个由外观定的量摆到了明处。

### 6. 合并站的出发段以最后一个事件为准

`dayPaths` 改成「站 + 从该站出发的 leg」配对之后暴露的一个新问题：同一地点连续出现
（酒店放行李 → 酒店晚餐）合并成一站时，离开这一站走的是**最后**那个事件的 `to_next`，
不是第一个的。旧实现按 `afterEventId` 回查所以不涉及，新实现必须显式覆盖。

### 真跑记录（2026-08-20）

- 命中两天，与设计预判一致：Day 2 `Astra Hotel → 派克市场`（步行 22 分 1.7km）、
  Day 5 `Renaissance Seattle → Jade Garden`（步行 15 分 1.4km）。
  其余三天照判据自然排除，一条误报警告都没有。
- 坐标补齐后重跑 `pnpm enrich seattle-2026-10`：**32 段 legs 全部可算**，
  28 段拿到真路网（含这两段开场通勤），剩 4 段是 rail / monorail —— 无公开线路几何，
  照设计画虚线。`geometry.json` 29KB。
- `_broken` 的错误数**没变**，仍是 6：设计里担心的「新规则可能加一条」没有发生，
  那份 fixture 里没有被住宿区间覆盖的天。
- 测试基线 17 套件 / 254 测试；typecheck / data:check / build 全绿。
- 截图核过 Day 2 / Day 5 的列表与地图，含 390px 与深浅两套主题：开场通勤条在首卡之前
  单独一行、没有多出事件卡；地图上住处是当天第 1 站，序号顺延。
  另拍了一张 Astra 那一簇的放大图确认 pin 错位 —— 全程 37 枚 pin 落在 28 个坐标上，
  最挤的 Astra 一簇 6 枚（D1 两次 + D2 开场 + D2 顶楼酒吧 + D3 两次）排成一圈，都点得到。
