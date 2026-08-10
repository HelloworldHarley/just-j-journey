# Trip Atlas · 旅行计划可视化工具 · 实施计划

## Context

起点：`ai-travel/西雅图5天4夜_20261001-05_最终版.md` —— 一份和 LLM 对话产出的高质量行程（5 天、约 40 个地点、航班硬约束、Day 5 倒推链、租车计费节点、条件分支、雨天预案、预算表、打包清单）。

问题：信息密度极高但是**线性文本**。要在脑中构建完整图景，必须自己去开 Google Maps 查每个地点在哪、彼此多远，再自己排一遍日历看时间冲不冲突。

目标：一个随时能打开的网页。进去是个人空间（放多个行程），点开后可在 **列表 / 日历 / 地图 / 资料** 四视图间切换 —— 同一份数据的三种投影：时间轴、日程表、空间图。将来能直接在工具里和 LLM 对话生成或修改行程。

**关键认识（本轮修正）：** 那份西雅图 MD 的阅读对象是人，不是这个项目。逐份做语义转换既不可扩展也不可靠。**输入格式必须是一份契约** —— LLM 照着写，解析器确定性地吃进去，出错精确报行号。所以本计划的第一交付物是 **TripMD v1 规范**，不是界面。

> 那份西雅图 MD 里其实已经藏着一套隐式规范（`> 时间 地点` 引用块、⭐锚点、⚠️警告、备选/砍站顺序、条件分支）。规范化不是推翻它，是把这些隐式约定变成显式的、机器能读的。它会被转写为 TripMD 作为压力测试 fixture。

### 调研结论：没有现成的可用

| 项目 | 三视图 | 静态托管 | 吃 MD |
|---|---|---|---|
| [AdventureLog](https://github.com/seanmorley15/AdventureLog) (GPL-3.0) | ✅ | ❌ Django+PostGIS+Docker | ❌ 表单手输 |
| [TREK](https://github.com/liketrek/TREK) (AGPL-3.0) | ✅ | ❌ NestJS+SQLite+Docker | ❌ |
| [trip](https://github.com/itskovacs/trip) | 仅地图 | ❌ | ❌ |
| [Anyplace](https://github.com/s01042/Anyplace) | 时间轴+地图 | ✅ | ❌ 足迹图，非行程编排 |

功能全的都是重后端 + 手工录入；纯静态的只是旅行足迹图。**"LLM 产出的 Markdown → 多视图站 + Agent 编辑"这条链路是空白。**

### 已核实的技术前提

- `tile.openstreetmap.org` [明确禁止](https://operations.osmfoundation.org/policies/tiles/)此类用途 → 用 **OpenFreeMap**（免 key、无限额、开源矢量瓦片）。
- OSRM 官方 demo 已废弃；[FOSSGIS 路由服务](https://routing.openstreetmap.de/about.html) 限 **1 req/s、禁批量** → **路线在导入阶段一次性算好存进数据，网页运行时零 API 调用**。
- Apple Maps `daddr=<纯经纬度>` 在新版 iOS 上[有回归报告](https://developer.apple.com/forums/thread/784030) → 链接用「地名 + `ll` 坐标」组合。

---

## 已确认的决策

| 维度 | 决策 |
|---|---|
| **输入格式** | **TripMD v1：Markdown 骨架 + 围栏 YAML 块（```trip-event 等）** |
| **真相归属** | **trip.json 是运行时真相；支持 `export` 导出回规范 TripMD（双向）** |
| **时间粒度** | **支持 `18:25–18:55` / `18:25` / `morning`\|`afternoon`\|`evening`\|`night`\|`allday`** |
| 托管 | **私有** GitHub 仓库 + Cloudflare Pages（+ Cloudflare Access） |
| 离线 | 不做 PWA |
| 技术栈 | pnpm monorepo · Vite + React + TS + Tailwind · [Phase 6] Hono on Cloudflare Workers |
| 视图 | 列表 / 日历 / 地图 / 资料 |
| 地图交互 | 天数 Tab（全程 / D1…Dn）+ 切换自动 `fitBounds` |
| 路线精度 | 步行/开车 = OSRM 真实路网；轨道/飞机 = 带图标虚线弧 |
| 日历 | 周视图 + 月视图 |
| 地图链接 | 每个地点/路段一键跳 Google Maps / Apple Maps（含导航） |
| LLM Agent | 架构预留，Phase 6 实现 |

---

# 一、输入契约：TripMD v1

**设计原则：机器字段进围栏 YAML 块，人读内容进普通 Markdown。** 两者互不污染 —— 删掉所有 ```trip-*``` 块，剩下的仍是一篇能读的行程文章；只读 ```trip-*``` 块，就得到完整的结构化数据。

## 文档骨架

```markdown
---
id: seattle-2026-10
title: 西雅图 5 天 4 夜
subtitle: 2026/10/01–10/05 · 最终版
destination: Seattle, WA, USA
timezone: America/Los_Angeles
start: 2026-10-01
end: 2026-10-05
travelers: 2
currency: USD
---

# 西雅图 5 天 4 夜

## 硬约束
```trip-constraints
- kind: flight-arrive
  at: 2026-10-01 13:11
  label: 抵达 SEA · 国际航班
  note: 过海关 + 走到轻轨 + 车程 → 到 Astra 约 16:00–16:30
- kind: deadline
  at: 2026-10-05 11:20
  label: 必须还车
  note: 12:40 前到航站楼倒推
```

## 地点表
```trip-places
- name: Astra Hotel
  en: Astra Hotel Seattle, Autograph Collection
  coord: 47.6205, -122.3400
  category: lodging
- name: Waterfront Park / Pier 62
  coord: 47.6076, -122.3437
  category: viewpoint
- name: Stormking Spa + Cabins
  category: lodging
  tentative: true          # 5 选 1 还没定
```

## Day 1 · 2026-10-01
```trip-day
theme: Seattle Center → 单轨穿 MoPOP → 海滨日落
sunset: "18:52"
lodging: Astra Hotel
fallback_order: [煤气厂公园, 日本花园, 苏扎罗图书馆]
```

今天的主线是把时差熬过去，靠日落收尾。

### 抵达 SEA
```trip-event
time: "13:11"
category: flight
place: Seattle-Tacoma International Airport
to_next: {mode: rail, minutes: 38, label: 1 Line 到 Westlake}
```

有 Global Entry 约 14:15 出关，否则 14:45–15:00。行李转盘走到轻轨站还要 12 分钟。

### 海滨日落
```trip-event
time: 18:25–18:55
category: viewpoint
place: Waterfront Park / Pier 62
flags: [starred]
cost: 摩天轮 $18/人
to_next: {mode: walk, minutes: 5}
```

太阳落进对岸的奥林匹克山脉。

#### 变体 · 下雨
海滨全露天，改去 Seattle Aquarium（Day 1 顺路）。

## 附录 · 预算
```trip-ref
id: budget
icon: 💰
```

| 支出类别 | 说明 | 预估（USD） |
| :-- | :-- | :-- |
| Astra 2 晚 | 50K 券 × 2 + 补 10,000 点 | $0（点数） |
```

## 块与字段

### Frontmatter（必需）

`id` `title` `destination` `timezone` `start` `end` 必需；`subtitle` `travelers` `currency` `lang` 可选。

> **`destination` 必需的理由：用来算 bounding box 做坐标合理性校验。** LLM 偶尔会编造经纬度，一个瞎编的坐标会静悄悄地把点画到太平洋里。有 bbox 就能当场拦下。

### ```trip-event```（每个 `###` 事件必需一个）

| 字段 | 必需 | 说明 |
|---|:--:|---|
| `time` | ✓ | `18:25–18:55` / `18:25` / `morning`·`afternoon`·`evening`·`night`·`allday` |
| `category` | ✓ | 9 个枚举值之一（见设计系统） |
| `place` | | 地点名，须与地点表一致。缺省则该事件不上地图 |
| `flags` | | `starred` `warning` `tentative` `optional` `needs-booking` |
| `cost` | | 自由文本，如 `摩天轮 $18/人` |
| `booking` | | `{status: required\|booked\|none, deadline: 2026-08-01, note: ...}` |
| `to_next` | | `{mode, minutes, km, label, note}` —— 到下一个事件怎么走 |

`mode` 枚举：`walk` `drive` `rideshare` `rail` `bus` `monorail` `streetcar` `ferry` `flight` `bike`

> **`to_next` 挂在事件上而不是单独的 legs 列表** —— 写的时候"下一段怎么走"就在脑子里，分开写 LLM 必漏。导入器负责转成 `legs`。

### ```trip-day```（可选）
`theme` `sunrise` `sunset` `lodging` `fallback_order`（赶不上时的砍站顺序）`weather_note`

### ```trip-places```（推荐）
`name`(✓) `en` `coord`(lat, lng) `category` `gmaps_place_id` `tentative` `url` `note`

坐标在此声明一次，事件按名引用。缺 `coord` 的由 `enrich` 脚本 geocode。

### ```trip-constraints```（可选）
`kind`: `flight-arrive` `flight-depart` `deadline` `checkin` `checkout` `reservation`；配 `at` `label` `note`。这些会常驻列表视图顶部和日历顶部全天条。

### ```trip-ref```（资料区）
`## 附录 · <标题>` 下放一个 `trip-ref` 块声明 `id` / `icon`，其后所有 Markdown 原样进「资料」页。

### 变体（`####` 四级标题）
`#### 变体 · <条件>` —— 标题里的条件即 `when`，正文即 body。这是这份行程最值钱的部分（「Panorama 以上有雪 → 改走往返」「海雾没散 → 顺延 12:30 场并砍 Chihuly」），多数行程工具会压扁丢掉，这里是一等公民。

## 容错清单（导入器必须宽容的地方）

- 时间分隔符接受 `–` `—` `-` `~` 及任意空格
- `category` 大小写不敏感 + 别名表：`hike`→`outdoor`、`hotel`→`lodging`、`tour`→`experience`、`restaurant`→`food`、`attraction`→`sight`
- `coord` 接受 `47.6205, -122.3400` 或 `[47.6205, -122.3400]`
- `## Day 1 · 2026-10-01` 也接受 `## Day 1`（日期从 `start` 推算）
- 地点名 normalize（去空格 / 大小写 / 全半角）后匹配；相似但不相同 → 警告而非报错

## 校验器输出（错误信息质量是这套东西能不能用的关键）

```
plan.md:142  错误  trip-event 缺少必需字段 `category`
plan.md:207  错误  category "sightseeing" 无效 —— 是否想写 `sight`？
plan.md:311  警告  地点 "Tehaleh Rainier View Point" 未在地点表声明，将尝试 geocode
plan.md:355  错误  坐标 47.60, 122.34 落在 destination "Seattle, WA" 的 bbox 外
                  西经应为负数，是否漏了负号？(-122.34)
```

最后那条拦的是经典错误 —— 西经漏负号会把西雅图画到中国境内。

## 双向：导出回 TripMD

`pnpm export <trip-id>` 从 trip.json 生成规范 TripMD，拿去继续和任意 LLM 聊，聊完再 import 回来。

**硬性质保证：语义幂等，而非字节一致。**

```
import(export(import(md)))  深等于  import(md)
```

这条写成测试。它是这个循环不会越转越烂的唯一保障。导出会丢失：注释、非规范排版、区块顺序（按规范顺序重排）。这一点必须在规范里写明，不能让人以为是无损往返。

## 配套交付物

| 文件 | 作用 |
|---|---|
| `docs/TRIPMD_SPEC.md` | 规范全文 |
| **`docs/AUTHORING_PROMPT.md`** | **可直接粘给 Claude / GPT / Gemini 的作者提示词**（完整字段表 + 精简范例）—— 你生成测试行程时用这个 |
| `data/_example/plan.md` | 一份两天的最小完整范例 |
| `data/seattle-2026-10/plan.md` | 西雅图 MD 转写版，作压力测试 fixture |

> 西雅图那份是绝佳的 torture test：6 种交通方式、5 个数量级的地理尺度、大量变体与待定住宿、精确到分钟的倒推链。规范扛得住它，基本就扛得住任何行程。

---

# 二、设计系统

## 设计论点

**这不是旅游手册，是一份处在时间压力下的作战计划。** 真正紧张的是 `11:20 必须还车` / `日落 18:48` / `11:30 提车才落进 3 天计费` / `上午被取消还有下午补飞`。"不够直观"的本质是**感受不到时间的形状** —— 哪里紧、哪里松、哪里一步错满盘皆输。

视觉母题：**时刻表（timetable）**。候车牌、潮汐表、步道指示牌的语言，不是旅行手册的语言。

## 签名元素：时间脊柱（Time Spine）

一根贯穿视图的竖线，事件挂在上面：

- **移动段把脊柱画成虚线** + 交通图标 + 时长 —— 移动是过程，不是事件
- **事件块高度 ∝ 真实时长** —— 3 小时的 Skyline 环线是高块，15 分钟换乘是细线
- **空档就是真实的空白** —— Day 5 倒推链视觉上挤成一坨，Day 2 下午的余裕一眼可见
- **时段关键字（`afternoon` 等）画成斜纹块** —— 一眼区分「排定」与「未定」

刻意冒的风险：**让留白承载信息**，而不是均匀堆叠行。同一根脊柱复用在 列表 / 日历 / 地图侧栏 三处。

> 兜底：「按比例 / 紧凑」切换；空档超阈值折叠为 `⋯ 2 小时空档`。

## 类别系统（正交两层）

**第一层 · 类别 → 决定颜色与图标：**

| key | 中文 | 图标 | 色值 | 行程中的例子 |
|---|---|---|---|---|
| `flight` | 航班 | ✈ | `#4F5BD5` 靛 | 抵达/离开 SEA |
| `transit` | 交通 | 🚊 | `#6B7684` 石墨 | 轻轨 1 Line、单轨、有轨电车 |
| `lodging` | 住宿 | 🛏 | `#7C5AC4` 李子 | Astra、Ashford 木屋 |
| `food` | 餐饮 | 🍽 | `#B8802A` 焦糖 | Elliott's、早茶 |
| `sight` | 景点 | 🏛 | `#0D8AA8` 潮青 | Chihuly、玻璃球、苏扎罗 |
| `experience` | 体验 | 🎟 | `#C2417F` 洋红 | 水上飞机、Crystal 缆车 |
| `outdoor` | 户外 | 🥾 | `#4A7C3F` 苔绿 | Skyline 环线、Tipsoo |
| `viewpoint` | 观景 | 🌇 | `#E0533C` 落日 | Kerry Park、Tehaleh |
| `logistics` | 事务 | 🔑 | `#8A8580` 铅灰 | 提车/还车/补货/退房 |

设计意图：`transit` 和 `logistics` **刻意做成中性灰** —— 通勤和杂务不该抢眼。9 个色相跨越色轮；**图标始终与颜色并存**，灰度下仍可区分（色盲兜底）。

**第二层 · 状态 → 决定边框与角标，不占用颜色：**

`starred` ★角标+加粗色条 · `warning` ⚠角标+虚线纹 · `tentative` 虚线边框 · `optional` 降透明度 · `needs-booking` 右上红点

> **两套配色的分工（关键）：** 地图里颜色 = **天**（路径必须按天区分），图标 = **类别**，marker 是「天色圆底 + 白色类别图标 + 序号」。列表/日历里颜色 = **类别**（天已由分组表达）。不这么分工两套色系必然打架。

## 色板与字体

```
--ink      #12161C   近黑，偏冷，非纯黑
--paper    #F7F8F7   微冷白，读作涂布纸而非奶油纸
--graphite #5A6472   次级文字、脊柱主线
--fog      #E3E7E6   分隔线、失效态
```

- **标题 / 界面拉丁**：`Archivo`（大字号 `Archivo Expanded`）—— 导视系统血统，契合时刻表
- **数字与数据**：`IBM Plex Mono` —— tabular figures 是时间脊柱对齐的前提
- **中文正文**：系统栈 `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei"` —— 零字体下载

深浅色双模；`prefers-reduced-motion` 尊重；键盘焦点可见。

## 布局草图

**个人空间** —— 卡片本身就是一条时间条，不是图片卡：

```
┌────────────────────────────────────────┐
│ ATLAS                        [+ 新行程] │
├────────────────────────────────────────┤
│  即将出发                                │
│  ┌──────────────────────────────────┐  │
│  │ 10.01 ──────────────────── 10.05 │  │
│  │  ●━━━━●━━━━●━━━━●━━━━●           │  │ ← 5 点 = 5 天，点色 = 当天主类别
│  │  西雅图 5 天 4 夜                  │  │
│  │  Seattle · WA          还有 65 天  │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

**列表视图 · 时间脊柱**：

```
┌──────────────────────────────────────────────────┐
│ 西雅图 5天4夜      [列表] 日历  地图  资料         │
├──────────────────────────────────────────────────┤
│ ✈ 10/01 13:11 抵达   ✈ 10/05 15:40 离开          │ ← 硬约束常驻置顶
│ 🔑 10/05 11:20 必须还车                           │
├──────────────────────────────────────────────────┤
│  DAY 1 · 10/01 周四                       ☀18:52 │
│  Seattle Center → 单轨穿 MoPOP → 海滨日落          │
│                                                  │
│  13:11 ┃▌✈ 抵达 SEA                              │
│        ┋   🚊 1 Line · 38 分钟                    │ ← 脊柱变虚线 = 移动中
│  16:30 ┃▌🏛 Seattle Center           ⌖ 地图 ↗    │
│        ┋   🚶 22 分钟                             │
│  18:25 ┃▌🌇 海滨日落                       ★      │
│  19:15 ┃▌🍽 Elliott's Oyster House    ⌖ 地图 ↗   │
│        ┋   🚗 Uber 10 分钟 · $15                  │
│  20:45 ┃▌🛏 Astra Hotel                          │
└──────────────────────────────────────────────────┘
      ↑      ↑
   时间脊柱  类别色条
```

---

# 三、系统架构

## Monorepo

```
trip-atlas/                       pnpm workspace
├── packages/
│   ├── schema/       ★ zod schema + 类型 + 类别常量表（前后端 CLI 三方共用）
│   ├── tripmd/       ★ TripMD 解析器 / 序列化器（import + export + validate）
│   └── tokens/         设计令牌 → 同时导出 CSS 变量与 TS 常量
├── apps/
│   ├── web/            Vite + React + TS + Tailwind
│   └── api/            [Phase 6] Hono on Cloudflare Workers
├── data/               行程数据
├── docs/               TRIPMD_SPEC.md · AUTHORING_PROMPT.md
└── tools/              import / export / enrich / validate CLI
```

`packages/schema` 与 `packages/tripmd` 被前端、后端、CLI 共用 —— 改一处 schema，三处编译期报错。这是"增量开发维护"的地基。

> `tripmd` 单独成包（不塞在 tools 里）的理由：Phase 6 的 Agent 需要在服务端做 MD 导入，以及把 patch 序列化回 MD 供你审阅。它必须能被后端 import。

## 前端分层（feature-based）

```
apps/web/src/
├── app/                路由、Providers、布局壳
├── features/
│   ├── trip-list/      个人空间
│   ├── itinerary/      列表视图
│   ├── calendar/       日历视图
│   ├── map/            地图视图
│   ├── reference/      资料视图
│   └── agent/          [Phase 6] LLM 对话面板
├── data/
│   ├── TripRepository.ts        ★ 接口 —— 唯一切换点
│   ├── StaticTripRepository.ts    现在：fetch /data/*.json
│   └── HttpTripRepository.ts      [Phase 6]：fetch /api/*
├── components/         纯展示组件，零业务逻辑
├── lib/                time / geo / maplink / category
└── styles/
```

```ts
interface TripRepository {
  listTrips(): Promise<TripSummary[]>
  getTrip(id: string): Promise<Trip>
  saveTrip?(trip: Trip): Promise<void>      // Phase 6
}
```

**在 root 注入一个实现，UI 全程不知道数据从哪来。** 静态 → API 的切换是改一行 provider，不动任何视图代码。

状态管理用 **TanStack Query** —— 不是为了现在，而是它让静态→HTTP 的切换连 loading/error/缓存语义都不用重写。路由用 React Router（现阶段 HashRouter，将来配 `_redirects` 可平滑切 BrowserRouter）。

## `trip.json` 运行时 schema

TripMD 是**作者格式**，trip.json 是**运行时格式**。导入器负责把前者规范化成后者：分配 id、去重地点、把 `to_next` 展开成 `legs`、把时段关键字解析成具体时间窗、把 `#### 变体` 收进 `variants`。

```ts
{
  id, title, subtitle, timezone, dates: { start, end },
  constraints: [{ kind, at, label, note }],
  places: [{
    id, name, nameEn, coord: [lng, lat] | null, category, tentative,
    gmapsPlaceId?, geo: { source: "authored"|"nominatim"|"manual", confidence }
  }],
  days: [{
    index, date, weekday, theme, color, sunrise, sunset,
    lodging: { placeId, note }, fallbackOrder: string[],
    events: [{
      id, start, end, timeKind: "exact"|"point"|"period"|"allday",
      title, placeId, category, flags[], warnings[], cost, booking,
      body: "<markdown>",
      variants: [{ when, body }]
    }],
    legs: [{ from, to, mode, durationMin, distanceKm, label,
             geometry: "<encoded polyline>" | null }]
  }],
  reference: [{ id, icon, title, markdown }]
}
```

## 地图深链（`lib/maplink.ts`）

```ts
googleMapsPlace(p)      → maps/search/?api=1&query={lat},{lng}[&query_place_id={id}]
googleMapsDir(a,b,mode) → maps/dir/?api=1&origin=..&destination=..&travelmode=walking|driving|transit
appleMapsPlace(p)       → maps.apple.com/?q={name}&ll={lat},{lng}
appleMapsDir(p,mode)    → maps.apple.com/?daddr={name}&ll={lat},{lng}&dirflg=w|d|r
```

平台侦测：iOS/macOS 默认 Apple Maps，其余默认 Google Maps；UI 上主按钮 + 溢出菜单给另一个，永不锁死。每个**地点**给「打开」，每个 **leg** 给「导航」（带 travelmode）。Apple 的 `daddr` 纯坐标回归 → 一律「地名 + `ll`」组合。

## `tools/enrich.mjs`

把"零运行时 API"落地：

1. `coord == null` 的地点调 **Nominatim**（1 req/s、合规 UA），写回坐标 + `confidence`
2. `mode ∈ {walk, drive, rideshare}` 且 `geometry == null` 的 leg 调 **FOSSGIS OSRM**（`routed-foot`/`routed-car`，1 req/s），存 encoded polyline
3. 幂等：已有值跳过；`overrides.json` 人工坐标最优先，脚本与重新导入均不覆盖
4. 产出 `enrich-report.md` 列出 `confidence: low` 待人工核对

> 预计需人工补：`Tehaleh Rainier View Point`、`Stormking Spa + Cabins`、`Asadero Sinaloa 发源老店` —— Nominatim 对小众 POI 命中率低。约 40 个地点跑一轮 ≈ 40 秒。

---

# 四、实施阶段

## ★ Slice 0（本轮唯一目标）：跑通最短链路，看到效果

**一条端到端的竖切片：TripMD → 解析 → 列表视图。** 不做地图、不做日历、不做 geocoding、不做部署、不做后端。目的是让规范和视觉方向尽早接受检验。

**关键发现让这个切片比预想的完整：地图深链不需要坐标。** `maps.apple.com/?q=<地名>` 与 `google.com/maps/search/?api=1&query=<地名>` 用名字就能跳，对有名号的商家甚至比坐标更准。所以这轮跳过整个 geocoding/routing 环节，仍然能交付「点地点 → 拉起地图 App」。坐标等 Slice 1 的 enrich 落地后再升级为精确定位。

### 做什么

| # | 交付 | 说明 |
|---|---|---|
| 1 | `pnpm-workspace.yaml` + 2 包 1 应用 | `packages/schema`、`packages/tripmd`、`apps/web`。仅 3 个额外配置文件，换掉将来的一次拆包重构 |
| 2 | `docs/TRIPMD_SPEC.md` | 规范全文（块定义完整，只是暂不实现 export） |
| 3 | **`docs/AUTHORING_PROMPT.md`** | **可直接粘给 LLM 的作者提示词 —— 本轮交付给你的东西** |
| 4 | `packages/schema` | zod schema + 类别常量表（9 类的 key/中文名/图标/色值/别名） |
| 5 | `packages/tripmd` | 只做 `parse()` + `validate()`，**错误带行号**。`serialize()` 留空导出 |
| 6 | `data/seattle-2026-10/plan.md` | 西雅图 MD 转写为 TripMD，作压力测试 fixture |
| 7 | `apps/web` | 个人空间 + **列表视图（时间脊柱）** + 资料页 |
| 8 | `lib/maplink.ts` | 基于地名的 Google / Apple Maps 深链 + 平台侦测 |

**资料页一并做**（`react-markdown` 约 40 行）—— 不做的话西雅图内容有三分之一不可见，demo 会显得是坏的。日历和地图 tab 本轮**不出现**，不放灰掉的占位。

### 不做什么（明确推迟）

geocoding / OSRM 路线 / `tools/enrich.mjs` · `serialize()` 与幂等测试 · 日历视图 · 地图视图 · `packages/tokens` 独立成包（先放 `apps/web` 的 CSS 变量里）· Cloudflare 部署 · 后端与 Agent

### 验收

```
pnpm dev  →  浏览器打开
```

1. 个人空间显示一张西雅图行程卡（时间条形态）
2. 点进去，列表视图完整渲染 5 天，**时间脊柱的挤压/宽松对比成立**
3. 9 个类别的颜色与图标正确，★/⚠/虚线/红点四种状态可见
4. Day 4「环线 / 往返」变体可展开
5. 点任一地点 → 正确拉起 Google / Apple Maps
6. 资料页 6 个附录分区正常渲染
7. 故意写坏 5 处 → 每处都报出行号和修复建议

**这一步做完先交给你看，方向确认后再往下。** 同时交付作者提示词，你用它生成一份新行程作真实测试目标 —— 规范扛不住的地方在这里暴露，比界面做完之后暴露便宜得多。

---

## 后续（方向确认后再排）

### Slice 1 · 工具链补全
`tools/enrich.mjs`（Nominatim 补坐标 + OSRM 算路线 + `overrides.json` 人工兜底 + 待核对报告）；`serialize()` 与**幂等测试** `import(export(import(md))) === import(md)`；`packages/tokens` 独立成包；Cloudflare Pages 部署管线打通。

### Slice 2 · 日历视图
周视图自研（N 列天 × 纵轴时间，事件块按真实时长画高度，等宽数字对齐）。不用 FullCalendar：体积大、样式难精细控制，这里只需约 300 行网格。月视图（每格显示当日 `theme`）。硬约束画成顶部全天条；时段关键字画斜纹块。移动端降级为单日列 + 左右翻页。

### Slice 3 · 地图视图
MapLibre GL JS + OpenFreeMap `liberty`（style URL 抽成配置，服务不稳一行可换 Protomaps/MapTiler）。天数 Tab + `fitBounds` 解决「市中心 1km ↔ 雷尼尔 200km」尺度冲突。Marker = 天色圆底 + 白色类别图标 + 序号，非当前天变淡。真实路网 polyline vs 带图标虚线弧。右侧（手机为底部上拉面板）同步时间脊柱，与 marker 双向高亮。`tentative` 地点画虚线圈。地图深链从地名升级为坐标精确定位。

### Slice 4 · 打磨
移动端底部 tab bar；深浅色；空状态与错误态文案；Cloudflare Access。

### Slice 5 · LLM Agent（架构已预留）
- `apps/api`：Hono on Cloudflare Workers，与 Pages 同一部署（`/api/*`）
- 密钥存 Cloudflare Secrets —— **这正是必须有后端的原因，前端放 key 不可行**
- `interface LLMProvider { stream(req): AsyncIterable<Chunk> }`，三实现 Anthropic / Google / OpenAI，统一 SSE
- 存储从 git JSON 迁到 **Cloudflare D1**；前端换 `HttpTripRepository`，视图零改动

```
GET  /api/trips          POST /api/trips        从 TripMD 导入
GET  /api/trips/:id      PUT  /api/trips/:id    GET /api/trips/:id/export.md
POST /api/agent/chat     SSE 流式 { tripId, messages, provider }
```

**Agent 不是"生成文本让你复制"，而是 tool use 直接改结构化行程。** 工具 `propose_patch(ops)`，op 为 `add_event` / `move_event` / `set_variant` / `replace_day` / `add_place`；后端 zod 校验 → 前端 diff 预览 → 你确认才落库。

> 这个设计的前提正是 Phase 1 就在做的事：结构化 schema + zod 校验 + Repository 抽象 + TripMD 双向序列化。届时不需要重写。

---

# 五、验证

## Slice 0（本轮）

| 项 | 怎么验 |
|---|---|
| **签名元素** | 列表视图 Day 5 倒推链应**视觉上明显挤压**（10:00→11:20→11:45→12:40 无空隙），Day 2 下午明显宽松 —— 这是整个设计成立与否的判据 |
| **错误信息** | 故意写坏 5 处（缺 category、拼错枚举、时间格式错、地点未声明、日期越界），每处都报出行号和修复建议 |
| 解析 | 西雅图 fixture 完整 import 通过，zod 校验绿 |
| 类别系统 | 9 类颜色图标正确；灰度截图下仍能靠图标区分全部 9 类 |
| 状态层 | ★锚点 / ⚠警告 / 虚线待定 / 红点待预订 四种状态可见且不与类别色冲突 |
| 变体 | Day 4「环线 / 往返」可展开对比 |
| 地图链接 | iPhone Safari 点地点 → 拉起 Apple Maps；桌面 Chrome → Google Maps |
| 资料页 | 6 个附录分区（预算/打包/住宿/雨天/清单/租车）正常渲染，表格不溢出 |
| 移动端 | DevTools iPhone 尺寸过一遍两个视图 |
| **规范鲁棒性** | 交付 `AUTHORING_PROMPT.md` 后，你生成一份新行程能 import 通过 |

## 后续切片

| 项 | 怎么验 |
|---|---|
| 跨模型规范鲁棒性 | 同一提示词让 Claude / GPT / Gemini **各生成一份**，三份都能 import —— 跨模型才说明规范够明确，而非恰好迎合某个模型的习惯 |
| 幂等 | `import(export(import(md)))` 深等于 `import(md)`，写成单测 |
| enrich | 报告无遗留 `confidence: low`；所有 walk/drive leg 有 geometry |
| 地图 **D4** | 自动缩到 Ashford–Paradise–Tipsoo–Crystal–Kent，盘山公路是真实路网非直线 |
| 地图 **D1** | 缩到市中心步行尺度，轻轨段为虚线弧标「38 分钟」 |
| 部署 | Cloudflare Pages preview URL 手机真机打开 |

---

# 六、已知风险

1. **LLM 对规范的合规率是最大未知数。** 缓解：字段集刻意做小（只有 `time` 和 `category` 必填）；容错清单覆盖常见漂移；错误信息带行号和修复建议；跨三个模型验证。**如果 Phase 1 验证发现合规率低，规范要收窄而不是让解析器更聪明。**
2. **LLM 幻觉坐标** → `destination` bbox 校验当场拦截，尤其是西经漏负号。
3. **导出非无损** → 规范中明确写「语义幂等，非字节一致」，避免误以为可以无损往返。注释和自定义排版会丢。
4. **OpenFreeMap 无 SLA** → style URL 单一配置项，挂了一行切换。
5. **Nominatim 对小众 POI 命中率低** → `overrides.json` 人工兜底，脚本与重新导入均不覆盖。
6. **按比例时长可能让某些天过长** → 「按比例 / 紧凑」切换 + 空档折叠。
7. **中英混排的等宽数字对齐** → 时间与数字强制走 IBM Plex Mono tabular figures，中文走系统栈；**非等宽数字会毁掉时间脊柱**，Phase 2 第一个组件就要验证。
