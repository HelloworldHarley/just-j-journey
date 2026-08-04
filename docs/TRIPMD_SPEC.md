# TripMD v1 规范

TripMD 是 Just J Journey 的**作者格式** —— 一份既能给人读、又能被确定性解析的旅行计划 Markdown。

## 设计原则

**机器字段进围栏 YAML 块，人读内容进普通 Markdown。两者互不污染。**

- 删掉所有 ` ```trip-* ` 块 → 剩下的仍是一篇能读的行程文章
- 只读 ` ```trip-* ` 块 → 得到完整的结构化数据

必填字段刻意做到最少（每个事件只有 `time` 和 `category`）。字段越少，LLM 写错的机会越少。

---

## 文件结构

```
---
frontmatter（必需）
---

# 标题（可选，纯装饰）

## 硬约束            ← 任意标题；靠块类型识别，不靠标题文字
```trip-constraints```

## 地点表
```trip-places```

## Day 1 · 2026-10-01
```trip-day```
当天导语（自由 Markdown）

### 事件标题
```trip-event```
事件正文（自由 Markdown）

#### 变体 · 条件
变体正文

## 附录 · 预算
```trip-ref```
附录正文（自由 Markdown，原样进「资料」页）
```

> 解析器**靠块类型和标题模式识别分区，不靠标题文字**。`## 硬约束` 也可以叫 `## Hard constraints` 或 `## 不可移动的事`。只有 `## Day N` 和 `## 附录 · X` 这两种标题有语法含义。

---

## Frontmatter

```yaml
---
id: seattle-2026-10          # 必需 · slug，作 URL 和输出文件名
title: 西雅图 5 天 4 夜        # 必需
destination: Seattle, WA, USA # 必需 · 见下方说明
timezone: America/Los_Angeles # 必需 · IANA 时区，决定「今天」是哪天
start: 2026-10-01            # 必需 · YYYY-MM-DD
end: 2026-10-05              # 必需 · YYYY-MM-DD
subtitle: 2026/10/01–10/05 · 最终版
travelers: 2
currency: USD
---
```

---

## ` ```trip-event `

每个 `###` 事件**必须**紧跟一个 `trip-event` 块。

| 字段 | 必需 | 说明 |
|---|:--:|---|
| `time` | ✓ | 见下方「时间」 |
| `category` | ✓ | 18 个枚举值之一，见下方「类别」 |
| `place` | | 地点名。须与地点表一致。缺省则该事件不上地图 |
| `flags` | | `warning` `tentative` `optional` `needs-booking` |
| `cost` | | 自由文本，如 `约 $70/人`。解析器自动抽金额进预算统计：`/人` 乘人数、`× 2` 认乘法、`$250–400` 取中值、带「可选」不计入总额 |
| `booking` | | `{status: required\|booked\|none, deadline: YYYY-MM-DD, note: ...}` |
| `stay` | | **住宿信息块**，写在入住事件上：`{platform: 万豪/希尔顿/Airbnb…, stars: 4, room: 大床房, parking: 含/不含, breakfast: 含/不含, note}`。全部可空 —— 知道就填，不知道 UI 留「待填」空位 |
| `notes` | | **注意条目**，字符串列表。截止、防盗、必带装备、营业时间坑…… 一条一个坑，UI 渲染成与「如果」同款的红色「注意」条目行。有坑写这里，不要埋在正文散文里 |
| `transport` | | 长途换乘段（单个对象或**列表**，多人汇合一人一条）：`{traveler, mode: flight/rail/drive/ferry/bus…, carrier, number, from, to, dep_time, arr_time, arr_day_offset, duration, baggage, stops: [{airport, wait}], note}`。任何类别的事件都可挂；`category: flight` 没写块也会渲染待填骨架。|
| `to_next` | | `{mode, minutes, km, label, note}` —— 到**下一个事件**怎么走 |

```yaml
time: 18:25–18:55
category: viewpoint
place: Waterfront Park / Pier 62
cost: 摩天轮 $18/人
to_next: {mode: walk, minutes: 8, label: 沿栈桥南行到 Pier 56}
```

> **`to_next` 挂在事件上，不做单独的 legs 列表。** 写的时候「下一段怎么走」就在脑子里；拆成两个列表必漏。导入器负责展开成 `legs`。

### 时间

| 写法 | 含义 |
|---|---|
| `18:25–18:55` | 精确区间。分隔符接受 `–` `—` `-` `~` `至` `到` |
| `"13:11"` | 时间点，**时长为 0**（不编造时长）。YAML 里冒号开头的值要加引号 |
| `morning` / `afternoon` / `evening` / `night` | 时段，映射到 08–12 / 13–18 / 18–22 / 22–24，UI 标为「时间未定」 |
| `allday` | 全天 |

**时间是「到达该地点后开始活动」的时刻，不是出发时刻。** 路上耗时由**上一个事件的 `to_next`** 承担，因此上一个事件必须提前 travel 分钟结束。

```yaml
# ✅ 对：14:00 到植物园开始逛
### 苏扎罗图书馆
time: 15:15–16:03            # 16:03 结束，留 12 分钟车程
to_next: {mode: drive, minutes: 12}
### 煤气厂公园
time: 16:15–17:30            # 16:15 到达

# ❌ 错：会报「时间冲突：差 12 分钟」
### 苏扎罗图书馆
time: 15:15–16:15
to_next: {mode: drive, minutes: 12}
### 煤气厂公园
time: 16:15–17:30
```

终点早于起点视为跨午夜（`23:30–01:00` = 90 分钟），不报错。

### 长途换乘（`transport` 子块）

抵达、离开、多目的地之间的长途移动，UI 渲染成机票式时间轴：左出发、右到达、
实线行进、虚线中转/停留，段长按时长分配。**不限飞机** —— `mode` 决定图标与文案，
火车/自驾/轮渡/长途大巴同样适用。

```yaml
# 单人单段：写一个对象
transport: {mode: flight, carrier: 达美 Delta, number: DL281, from: PVG T1, to: SEA, dep_time: "10:15", arr_time: "13:11", duration: 11h55m, baggage: 2 件 23kg, stops: [{airport: ICN, wait: 2h10m}]}

# 多人从不同地方汇合：写成列表，一人一条，traveler 区分
transport:
  - {traveler: 她, mode: flight, from: PVG, to: SEA, arr_time: "13:11"}
  - {traveler: 我, mode: flight, from: SNA, to: SEA}

# 火车抵达（事件 category 可以是 transit）
transport: {mode: rail, carrier: Amtrak, number: Cascades 504, from: PDX, to: SEA King Street}
```

字段：`traveler`（谁的，多人时）· `mode`（flight/rail/hsr/drive/ferry/bus…，默认 flight）·
`carrier`（航司/铁路/船司/租车行）· `number`（航班号/车次/船班）· `from` / `to` ·
`dep_time` / `arr_time` · `duration`（全程含中转）·
`cabin`（客舱/座席，如 `经济舱` / `指定席`）· `baggage`（托运额度）·
`through_check`（中转行李是否直挂）· `refund`（退改签政策）·
`price`（票价，如 `$189`；没订留空，UI 渲染「预算 待填」槽位）·
`stops: [{airport, dep_airport, arr_time, dep_time, leg, wait}]` · `note`

中转 `stops` 每项：`airport` 到达点 · `dep_airport` 异地换乘的再出发点（同地不写）·
`arr_time` / `dep_time` 到发当地时间 · `wait` 停留时长 ·
`leg` **到达此中转点的前一段行进时长**（跨时区没法从两端当地时间算出，可显式提供；
不写则按「全程 − Σ停留 − Σ已填段」均分，各段与停留之和恒等于全程）。

### 时刻是输入，日期是派生

**你只写时刻**（照票面抄，或让 agent 填）。出发日、中转到发日、最终到达日全部由工具沿时间轴推出来，
跨天的节点自动补红色 `+n` 角标 —— 包括中转点。所有节点用同一条规则、同一个基准（出发日）算偏移。

推导规则：出发日默认取事件所在那天；后一个时刻比前一个小就进一天；
中转停留有 `wait` 时长的按时长推进（**这是唯一能正确跨过 24 小时以上停留的路径** ——
停 27 小时时钟点不会「变小」，光看时刻推不出来）。

只有推不出来时才需要显式写日期，共两种情况：

| 字段 | 什么时候必须写 |
|---|---|
| `arr_day_offset` | 跨日期变更线的航班。次日到达写 1 |
| `dep_date` / `arr_date` | 直接照票面抄日期时；抵达型事件的航班其实前一天起飞时写 `dep_date` |
| 中转的 `arr_date` / `dep_date` | 中转本身跨了日期变更线，且没写 `wait` |

> **为什么跨时区必须手写。** 跨时区时无法从时长反推天数：LAX 08:05 起飞、飞 14h25m、
> HND 15:30 落地（次日）—— 本地钟点只走了 7h25m，差出来的 17 小时是时区偏移不是飞行时间。
> 没有时区数据谁也解不出来。而中转停留发生在**同一个机场**、必然同时区，所以 `wait` 那条总是准的。

> **预算统计的唯一来源是事件的 `cost`。** `price` 只是票面展示（多人一人一张票）；
> 票订好后把合计金额写进事件 `cost`，预算页才会计入 —— 两处都写时以 `cost` 为准，不会重复计。

- **不知道的字段直接省略，不要编。** 票常常晚于行程定下来，UI 会画完整骨架并给缺的字段留「待填」空位，之后补进这里即可。`category: flight` 的事件没写块也画空骨架。
- 多目的地行程中间的长途移动（如西雅图 → 波特兰的火车）同样写成一个事件 + `transport` 块。
- `duration` / `wait` 接受 `11h55m`、`2h`、`45m`、`11 小时 55 分`、`"11:55"`、纯数字（分钟）。
- 事件本身的 `time` 仍按 TripMD 通用规则写（抵达事件写到达时刻、出发事件写出发时刻），`transport` 块里的时间是给票面时间轴用的。

### 正文的「首段约定」与注意条目

事件正文的**第一段**（第一个空行之前）是简要介绍；其余内容折叠在「全文」里。
第一段用一句话说清「这是什么、为什么值得」——**不写怎么去**（通勤是上一个事件 `to_next` 的事）。

**坑不写进散文，写进 `notes` 条目**，一条一个坑并说明理由：

```yaml
notes:
  - 必须自带午餐：Paradise 以外整条线没有任何吃饭的地方
  - "11:20 硬截止"          # 数字开头的字符串要加引号
```

UI 把它们渲染成红色「注意」条目行，和 `#### 变体` 的「如果」条目行同一族。

### 类别（五族十八类）

族决定颜色与筛选归属（玩=绿 / 吃=桃红 / 住=中性 / 行=蓝 / 事务=透明），类型决定图标和卡片上的两字标签。

| 族 | key | 类型 | 用于 |
|---|---|---|---|
| 玩 | `sight` | 景点 | 博物馆、地标、建筑 |
| 玩 | `outdoor` | 户外 | 徒步、公园、湖泊、步道 |
| 玩 | `viewpoint` | 观景 | 观景台、日落机位、**风景自驾路段** |
| 玩 | `experience` | 体验 | 需买票的活动：缆车、游船、观光飞行 |
| 吃 | `food` | 餐厅 | 正餐、市场 |
| 吃 | `cafe` | 咖啡 | 咖啡、茶室、brunch |
| 吃 | `snack` | 小吃 | 甜点、街头小吃、冰淇淋 |
| 吃 | `bar` | 酒吧 | 酒吧、屋顶酒廊、夜生活 |
| 住 | `hotel` | 酒店 | 品牌酒店、度假村 |
| 住 | `homestay` | 民宿 | Airbnb、木屋、町屋、旅馆 |
| 行 | `flight` | 航班 | 起降 |
| 行 | `rail` | 火车 | 城际铁路、Amtrak |
| 行 | `hsr` | 高铁 | 高铁、新干线 |
| 行 | `ferry` | 航运 | 轮渡、游轮 |
| 行 | `drive` | 自驾 | 长途自驾段、**提车还车** |
| 行 | `bus` | 巴士 | 长途大巴、机场巴士 |
| 行 | `transit` | 通勤 | 仅限值得单独成卡的长程通勤 |
| 事务 | `logistics` | 事务 | 补货、寄存、装车、进航站楼 |

> **「行」只收长途。** 市内的地铁/公交/打车这类短途通勤**不要写成事件**，
> 写进上一个事件的 `to_next` —— 它们是行程的黏合剂，不是行程本身。
> 如果一段乘车本身就是体验（观景列车、跨海渡轮看日落），按「玩」分类（`viewpoint`/`experience`）。

大小写不敏感。接受别名：`lodging`/`hotel` 旧写法→`hotel`、`cabin`/`airbnb`→`homestay`、`train`→`rail`、`shinkansen`/`bullet`→`hsr`、`boat`/`cruise`→`ferry`、`car`/`rental`→`drive`、`subway`/`metro`/`monorail`→`transit`、`restaurant`→`food`、`dessert`→`snack`、`attraction`/`museum`→`sight`、`tour`/`activity`→`experience`、`hike`/`trail`/`park`→`outdoor`、`scenic`/`sunset`→`viewpoint`、`shopping`→`logistics`。

> 住/行的颜色（中性/蓝）与玩/吃一样走可覆盖的 CSS 变量，将来用户可自定义；`logistics` 透明底 —— 杂务不该抢眼。

### 交通方式（`to_next.mode`）

`walk` `drive` `rideshare` `rail` `hsr` `bus` `monorail` `streetcar` `ferry` `flight` `bike`

别名：`taxi`/`uber`→`rideshare`、`subway`/`metro`/`lightrail`→`rail`、`shinkansen`/`bullet`→`hsr`、`tram`→`streetcar`、`car`→`drive`、`foot`→`walk`。

`walk` `drive` `rideshare` `bike` 可由 OSRM 算出真实路网轨迹；其余在地图上画虚线弧。

**`to_next` 里的 `minutes` 只写路上耗时。** 如果某个事件本身就是移动（比如「Stevens Canyon Road 跑山」），把时长写进事件的 `time`，`to_next` 就不要再给 `minutes`。

### 状态（`flags`）

| flag | 含义 | UI |
|---|---|---|
| `warning` | 有坑（具体的坑写进 `notes`） | 标题旁红色警示角 |
| `tentative` | 还没定下来 | 标题旁「待定」角标 |
| `optional` | 赶不上可砍 | 卡片左边条变虚线，**不写文字** |
| `needs-booking` | 出发前必办 | 琥珀「待订」/ 预订模块 |

> 没有 `starred`：「收藏」由用户在界面上点，不由作者预先指定 ——
> 否则 Agent 读回的"用户收藏"只是它自己上次的建议。

---

## ` ```trip-places `

推荐但非必需。坐标在此声明**一次**，事件按名引用。未声明的地点会自动建档并提示。

```yaml
- name: Astra Hotel                # 必需
  en: Astra Hotel Seattle          # 英文名 —— geocoding 和地图深链优先用它
  coord: 47.6205, -122.3400        # 纬度在前，经度在后（和地图 App 一致）
  category: lodging
  tentative: true                  # 还没定
  gmaps_place_id: ChIJ...          # 有则地图深链最精准
  url: https://...
  note: 5 选 1 未定，见附录
```

- **坐标不确定就别写。** `enrich` 脚本会补，人工核对后进 `overrides.json`。瞎写的坐标比没有坐标糟得多。
- 同一地点全文用**完全一致**的名称。相似但不同的名字会得到一条警告和「是否指 X？」的建议。
- 接受 `coord: [47.62, -122.34]` 和 `coord: {lat: 47.62, lng: -122.34}`。

---

## ` ```trip-day `

全部可选。

```yaml
theme: 落地西雅图 Citywalk 感受市区   # 直白的当天主题，别用箭头串景点名
sunrise: "07:05"
sunset: "18:52"
lodging: Astra Hotel                          # 引用地点表
lodging_note: 50K 券 + 补 5,000 点
```

> 没有 `weather_note`、`fallback_order` 这类杂项字段 —— 天气/季节风险写进**受影响事件**
> 的 `notes`（配上应对方案更好）；全天性质的背景、以及「赶不上时按 X → Y → Z 顺序砍」
> 这类整天的取舍，写进**当天导语**。每天以卡片收尾，末尾不留小提示块。

标题格式 `## Day 1 · 2026-10-01`。也接受 `## Day 1`（日期按 `start` 推算，但会警告）和 `## 第 1 天`。

---

## ` ```trip-constraints `

整趟行程里不可移动的时间点。

> **当前列表视图不渲染它们** —— 日头改成四行规格时约束条被移除了（那些坑现在写在
> 受影响事件的 `notes` 里）。这个块仍然有效且会被解析，供日历订阅（`.ics`）与将来的
> 日历视图使用；写了不会丢，只是暂时不出现在列表页。

```yaml
- kind: deadline
  at: 2026-10-05 11:20
  label: 必须还车
  note: 倒推链 12:40 到航站楼 ← 12:25 SEA 轻轨站 ← 11:45 上车 ← 11:20 还车
```

`kind`：`arrive` `depart` `deadline` `checkin` `checkout` `reservation`

---

## ` ```trip-rentals `（长租，可选）

有明确取还时刻、横跨多天的租赁：租车、随身 WiFi、滑雪装备。
它不是某一天的事件 —— 「行」视图渲染成订车 App 那种 从…到… 的区间卡。
取/还的**动作**（提车、还车）仍可以另写成当天的 logistics 事件；
费用写在提车事件的 cost 上，预算统计单一来源不变。

```yaml
- what: 保时捷 Macan            # 必需：租的是什么
  platform: Turo                # 租车平台/租车行
  from: "2026-10-02 11:30"      # 必需：取用时刻
  to: "2026-10-05 11:20"        # 必需：归还时刻
  pickup: 唐人街提车点            # 取用地点，按名引用地点表
  dropoff: 唐人街提车点           # 归还地点（与 pickup 不同即异地还车）
  mileage: 600 英里              # 里程**上限**，不是预估行驶里程
  insurance: 全险 + 免赔额 0      # 保险方案
  refund: 取车前 24 小时免费取消   # 退改政策
```

除 `what` / `from` / `to` 外都可空，缺的在票面上渲染「待填」空位。
渲染成与机票同一套票面：头行**平台 · 车型 · 共 N 天 · 预算**，中间**时刻在上、日期在下**的时间轴，
底部条款行**还车方式 · 里程上限 · 保险 · 退改**。

> **坑不写进凭证。** 「必须 11:20 后提车才落进 3 天计费」这类提醒写进提车事件的 `notes` ——
> 票面只放条款，注意事项归卡片。

---

## ` ```trip-ref `（附录）

`## 附录 · <标题>` 开头，紧跟一个 `trip-ref` 块，其后**所有内容**（含表格、列表、`###` 小标题、代码块）原样进「资料」页。

```markdown
## 附录 · 预算

```trip-ref
id: budget
icon: 💰
```

| 支出类别 | 说明 | 预估 |
| :-- | :-- | --: |
| 住宿 | … | $250 |
```

附录内部的小标题请用 `###` 或更深 —— `##` 会被当作新分区的开始。

> **预算类附录归预算页。** `id: budget`（或标题含「预算」）的附录渲染在预算视图底部、
> 自动统计的下面，不出现在资料页。所以别在里面重抄逐项金额表 —— 统计是算出来的；
> 附录只写数字之外的判断：点数策略、砍价顺序、风险变量、统计覆盖不到的隐性支出。

---

## 变体（`####`）

`#### 变体 · <条件>` —— 标题里的条件即触发条件，正文即应对方案。

```markdown
#### 变体 · Panorama 以上或 Golden Gate 有雪

改走**顺时针往返**：上 Deadhorse Creek 到 Panorama Point，原路下来。约 4 英里。
```

也接受 `#### 备选 · X` / `#### Variant · X`。

> **这是 TripMD 最重要的特性。** 「有雪就改走往返」「海雾没散就顺延到 12:30 场」——这类条件分支是一份好行程最值钱的部分，多数工具会压扁丢掉。这里是一等公民，UI 上折叠可展开。

---

## 校验

`pnpm data:check` 输出带行号的诊断。**错误**阻止生成，**警告**不阻止。

```
seattle/plan.md:44  错误  category "sightseing" 无效
                               是否想写 `sight`？
seattle/plan.md:64  警告  地点 "Kery Park" 未在 `trip-places` 中声明
                               是否指 "Kerry Park"？名称需完全一致
```

除了字段校验，解析器还会做三项语义检查：

**1. 坐标离群** —— 一趟旅行的坐标本该聚成一团。离群超过 10 度的会被拦下，并识别常见错因：

```
错误  地点 "Kerry Park" 的坐标 47.6295, 122.3599 离其余地点太远
      经度符号反了 —— 应为 -122.3599（西经是负数）
```

也能识别纬度符号反了、经纬度写反了。**不需要联网。**

**2. 时间冲突** —— 两个事件之间的空档装不下中间那段路：

```
警告  Day 2 时间冲突：「提车」结束到「Capitol Hill」开始只有 0 分钟，但这段路要 12 分钟
      差 12 分钟。把前一个事件提早结束，或把后一个推后
```

**3. 时间倒退** —— 事件没按时间先后书写。

---

## 双向导出

`pnpm data:export <trip-id>` 从 `trip.json` 生成规范 TripMD，可拿去继续和任意 LLM 聊，聊完再导回来。

**保证语义幂等，不保证字节一致：**

```
import(export(import(md)))  深等于  import(md)
```

导出会丢失：注释、非规范排版、区块顺序（按规范顺序重排）、`## 硬约束` 这类自定义分区标题的文字。**这不是无损往返。**

---

## 完整示例

见 [`apps/web/public/data/_example/plan.md`](../apps/web/public/data/_example/plan.md)（两天，覆盖每一种块）和 [`apps/web/public/data/seattle-2026-10/plan.md`](../apps/web/public/data/seattle-2026-10/plan.md)（5 天 38 事件，压力测试）。

生成新行程请用 [`AUTHORING_PROMPT.md`](./AUTHORING_PROMPT.md)。
