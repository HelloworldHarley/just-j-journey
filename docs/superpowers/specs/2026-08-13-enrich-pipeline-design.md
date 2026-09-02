# enrich 管道设计 · 2026-08-13

backlog 第一项。地图收官时留下两个缺口：30 段路一条真路都没有（全是两点直连虚线），
7 个被行程引用的地点没有坐标（右下角那枚「7 个地点缺坐标」chip 就是这份清单）。
本文记录方案 B 的拍板结果与实现偏差。

## 背景：算好的数据没地方住

卡点不在调不调 API，而在派生数据无处安放：`legs` 由事件的 `to_next` 派生
（`tripmd/days.ts`），`geometry` 在那里被硬写成 `null`，而 `serialize` 明确把它
归为「派生量不序列化」——polyline 今天没有任何途径活过一次 round-trip。

## 决策与理由

| 维度 | 决策 | 理由 |
|---|---|---|
| polyline 存哪 | **旁路文件 `geometry.json`**，plan.md 保持干净（方案 B，Harley 拍板） | 方案 A（写进 plan.md）会让 32KB 的手写文件涨到 50~70KB，涨的全是机器生成的乱码 |
| 脱节风险 | 每条记录带上**算它时用的起终点坐标**，对不上就整条丢弃 | 这是方案 B 唯一的真风险，用「对不上就回退」+ `data:check` 体检对冲 |
| 降级 | **一等公民**：文件没有 / 坏 JSON / 版本不认 / 端点漂了 / poly 解不开 → 全部回到直连虚线 | Harley 明确要求。**宁可不画，也不画错** |
| 键 | 内容派生 `{mode}\|{fromPlaceId}\|{toPlaceId}`，**不用 leg id** | 事件 id 含位置序号，某天开头插一个事件就让后面所有 id 漂移；placeId 是名字 slug，不漂 |
| 路由源 | OpenRouteService（免费 key，驾车 + 步行两套 profile） | 轨道/公交/轮渡/飞行没有公开线路几何，继续画虚线——这是诚实表示，不是缺陷 |
| 坐标写回 | **先出清单过目**，确认后才写 | 「Bonney Lake 补货点」这类名字很可能被编码到完全错的地方，偏 20 公里的点比没有点更糟 |
| 写回方式 | 定点文本编辑，**不走 `applyPatch`** | `serialize` 不逐字节忠实：对 seattle 跑一遍有 95 行 YAML 引号变动，7 处真实改动会被淹没 |
| 时长距离 | **不**用路由返回值覆盖手写的 `minutes`/`km` | 那是作者的判断，不是 API 的 |

## 形状

```json
{
  "version": 1,
  "routes": {
    "drive|p-astra-hotel|p-pike-place-market": {
      "poly": "_p~iF~ps|U_ulLnnqC",
      "from": [-122.3400, 47.6205],
      "to": [-122.3405, 47.6097]
    }
  }
}
```

`from`/`to` 是算这条路线时用的 `[lng, lat]`。加载时与当前 plan.md 解析出的坐标比，
差超过 `1e-5`（约 1 米）就丢弃 → 那段回到直线。**地点坐标一改，旧路线自动失效**，
不会出现「线还连着旧位置」。

## 架构：规则一份，三处消费

`packages/tripmd/src/geometry.ts` 是全仓唯一的一份：

| 导出 | 答什么 |
|---|---|
| `routeKey()` | 键怎么算 |
| `routableLegs()` | 哪些 leg 值得算真路（enrich 的工作清单 = 体检的分母） |
| `mergeGeometry()` | 一份文档并进 trip，返回 `{needed, used, stale, broken, orphan}` |
| `decodePolyline()` | polyline5 → `[lng, lat][]`，**全解开或者什么都不给** |

三处消费：`MarkdownTripRepository`（浏览器加载时合并，唯一的数据接缝）、
`tools/enrich.ts`（该请求哪些段、哪些还能复用）、`tools/check.ts`（体检行）。

放置理由依旧是那条：形状 → schema，能从 `Trip` 独立回答的规则 → tripmd，
认屏幕的数学 → web lib。`decodePolyline` 也归 tripmd——它是数据格式的解码，
不是布局数学。

## 渲染：真路实线，兜底虚线

`DayPath.line`（贯穿全天的一条折线）改成 `segments: DaySegment[]`，每段带 `real`
标记。每天一个 source，四层 layer 按 `real` 过滤：实线 + 实描边、虚线 + **虚描边**。

这个区别留在图上是有意的：哪几段是真路、哪几段还是估计，一眼可见，不用查文档。

`sceneBounds` 改为同时遍历站点与路线顶点——真实路网会鼓出站点包络框之外
（跨湖绕桥能鼓出好几公里），只框站点会把路线切掉一截；只框路线又会漏掉单站日。

## CLI

```bash
pnpm enrich <dir>                    # 算路线，写 geometry.json（需 ORS_API_KEY）
pnpm enrich <dir> --geocode          # 查缺坐标，打印清单，不写任何东西
pnpm enrich <dir> --geocode --apply  # 过目之后写回 plan.md
```

- key 走环境变量，**不进仓库**。限速：ORS 段间 1.5s，Nominatim 1.2s（硬性 1 次/秒 + 真实 User-Agent）。
- 复用 geometry.json 里仍然有效的记录，只请求缺的——重跑不白烧配额。
- 写回后立刻重新 `parse` 验证；不通过就一个字节都不落盘（解析器是唯一的验证器）。

## 验证

单测 26 条新增（`tripmd/test/geometry.test.ts` 18 + `map-scene.test.ts` 分段与 `dashCasing` 8），
每条都先用故意写坏的公式确认会红：端点校验恒真 → 6 红、忽略 `routable` → 2 红、
poly 解不开也照填 → 1 红、描边 dash 不缩 → 2 红。

降级三连在真浏览器里逐个跑过（用合成 geometry.json，验完即删）：删文件 → 全虚线无报错；
非法 JSON → 全虚线无报错；改一个地点坐标 → 那一段回退（13/14），dev 控制台一条警告。
`data:check` 对应报出「路线 13/14 有效（1 条坐标对不上）」。

完整门：typecheck / 17 套件 227 测试 / 4 fixtures / build 全绿。截图核过 1280px 浅色与 390px 深色。

## 实现记录（与设计的偏差）

### 1. 描边也必须分实虚（设计里没预见）

原本只打算按 `real` 分成实线与虚线两层，白色描边（casing）沿用一条不带过滤的层。
截图上立刻看出问题：**一条连续的白描边压在虚线底下**，让兜底直连看起来跟真路一样结实——
正好抹掉这个功能要区分的东西。之前全是虚线时它是均匀的，没人看得出来；有了实线做对照才现形。

修法是描边也按 `real` 分两层。坑在于 **maplibre 的 `line-dasharray` 以线宽为单位、不是像素**：
描边比正线宽 2px，照抄 dash 值画出来的节奏就长了一截，白头会露在彩线两端。
dash 值要按宽度反比缩回去，让 `宽 × dash` 这个像素量守恒——`dashCasing()` 纯函数 + 单测。

### 2. 可算的段数比预估少一半

设计时数出「30 段里 26 段可算」，实际 `routableLegs` 只给 14 段。差在**端点缺坐标**：
7 个地点没坐标，牵连的段全都算不了。**补坐标是补路线的前置**，不是并列的两件事。
补完之后这个数会涨。

### 3. Nominatim 吃不下作者写的 `en:`

作者的 `en:` 往往是「主名 + 地标 + 城市」（`Elliott's Oyster House Pier 56 Seattle`），
自由文本搜索整串一个字都匹配不上——7 个地点第一轮只查到 3 个。加了逐词回退
（先去掉逗号后缀，再一个个丢末尾的词，到两个词为止）之后 6 个有结果，
但越退越松：`Asadero Sinaloa` 退到两个词后匹配到了**墨西哥**，
`Elliott's Oyster` 匹配到了**澳大利亚**。

于是加了一道闸：`--apply` **拒绝写入落在行程包络框（外扩 0.5°）之外的结果**，
并说明理由。工具既然已经知道它不对，就不该把它写进 plan.md。
其余的 ⚠（按中文名查的、只匹配到行政区中心、查询词砍得多）是判断题，照写但标出来，
由人过目。

### 4. 顶层 await 与常量初始化顺序

`enrich.ts` 的派活块必须写在文件末尾：顶层 `await` 会在下方那些 `const`
（`COARSE`、`ORS_PROFILE`）初始化之前就跑完，写在上面必然撞 TDZ。
第一次跑出的是 `ReferenceError: Cannot access 'COARSE' before initialization`。

### 5. key 从 `.env` 读

Harley 把 `ORS_API_KEY` 放进仓库根的 `.env`（`.gitignore` 第 5 行早已覆盖）。
`secret()` 用 Node 内建的 `process.loadEnvFile` 读，不加依赖；显式 export 的
环境变量优先，临时换 key 不用改文件。

## 真跑记录（2026-08-14）

`pnpm enrich seattle-2026-10` → **14/14 全部成功**，`geometry.json` 13KB
（plan.md 32KB，方案 A 会把这 13KB 的乱码塞进那份手写文件里）。重跑 0.8 秒、
零请求——复用逻辑生效。`data:check` 报「路线 14/14 有效」。

图上核过：D2 市区那天整天走真街道（跨运河走对了桥、绕过植物园），
D4 雷尼尔那天 Stevens Canyon 的发卡弯都出来了。390px 深色下站点没被路线挤出画面。

## 补完记录（2026-08-19）

坐标已全部写回，管道跑完一整轮：

- Harley 逐条过目后 `--geocode --apply`，包络框那道闸如期拦下了澳大利亚的
  `Elliott's Oyster` 与墨西哥的 `Asadero Sinaloa`；两家连同查不到的
  `Altitude Sky Lounge` 手工核实后手填 —— 顺带发现 `Asadero Sinaloa` 现名
  **Asadero Prime**，`en:` 与 `note:` 一并改正。
- **30 个地点 0 缺坐标**，地图右下角那枚「N 个地点缺坐标」的 chip 自此在这份行程里不出现。
- 重跑 `pnpm enrich seattle-2026-10`：可算的段从 14 涨到 **28**（当天开场通勤那两段也在内，
  见 `2026-08-19-day-start-from-stay-design.md`）。32 段 legs 里剩下 4 段是 rail / monorail，
  没有公开线路几何，照设计画虚线。`geometry.json` 29KB，`data:check` 报「路线 28/28 有效」。
