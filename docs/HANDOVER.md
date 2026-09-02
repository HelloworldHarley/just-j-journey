# 交接文档 · 给下一个 Agent

2026-08-10 由上一台 EC2 的会话写就，2026-08-11 架构收敛轮更新，2026-09-02 随过程文档一起入库。读完这份 + `docs/TRIPMD_SPEC.md` + 设计文档，你就有了全部上下文。

---

## 一、这是什么项目

**Just J Journey**（就是 J 人的旅行工具）—— 把 TripMD（一种可确定性解析的旅行计划 Markdown）渲染成多视图网页。线上：<https://helloworldharley.github.io/just-j-journey/>（推 main 自动部署 GitHub Pages）。

架构一句话：**hub-and-spoke**。`Trip` 对象（zod）是 hub，TripMD 文本经 `parse()`/`serialize()` 双向往返，语义幂等 `parse(serialize(parse(md))) === parse(md)` 被测试钉死。浏览器直接 fetch 并解析 `plan.md`，没有 JSON 中间层；所有写操作走 `applyPatch` → serialize → 重新 parse，解析器是唯一校验器。

五视图承诺已收官：列表 ✓ 日历 ✓ 资料 ✓ 预算 ✓ 地图 ✓（2026-08-12 落地，08-20 修好线上 worker 缺失）。

## 二、和 Harley 的工作约定（最重要，先读这节）

1. **绝不自己执行 git 写操作**（add/commit/push/checkout 都不行）。把可粘贴的命令给 Harley，他自己跑。只读 git（status/log/diff/show）随便用。
2. **Commit 格式**：英文、单行 `type: 简述`（feature/fix/refactor/docs）。**大改动**要拆成几个逻辑块，此时可以加简短 bullet 正文；拆块前必须在临时副本里验证**每块独立编译 + 测试通过**（cp -a 整个仓库到 scratch，逐块 add/commit/stash 验证，验完删副本）。
3. 对话、UI 文案、代码注释用中文；commit 用英文。
4. **每轮改动完整验证**：`pnpm typecheck && pnpm test && pnpm data:check && pnpm build`，再用 Playwright 截图肉眼核对（含 390px 手机宽、深浅两套主题）。看测试结果要同时看 `Test Files` 行 —— 套件收集失败时 `Tests N passed` 照样是绿的，这个坑真踩过。
5. **深浅主题规矩**：新组件只消费切换令牌（`.tint-*`、`--t-*`、`--grp-cur`、`kindVars` 成对注入），永远不写组件级的 `@media (prefers-color-scheme)` 深色块、不用 Tailwind 的 `dark:` 变体、不内联单套色值 —— 三者都会让强制主题（`data-theme`）不跟随。`index.css` 里深浅色值用 `light-dark()` 就地成对，非色值从 `--dark` 0/1 标志位 calc —— **不存在需要逐行同步的第二份深色块**。
6. **CSS 注释里不要出现 `*/` 字样**（比如想写 `--g-*/--a-*`）—— 会提前终止注释，dev 管道直接 500 而 build 静默吞掉。写成 `--g-* 与 --a-*`。
7. 设计上的口头禅：**不要只打补丁，要深度整合**。加功能前先看有没有该收敛的重复（这个仓库为此做过两轮大收敛）；宁可净删代码也不叠第四层补丁。
8. 有意见分歧时摆事实给方案，Harley 拍板后照办。他常给多条编号反馈，逐条做完逐条汇报。

## 三、环境

- pnpm workspace：`@jjj/schema`（枚举 + zod）、`@jjj/tripmd`（parse/serialize/patch/summary/ics/values）、`@jjj/web`（Vite + React + Tailwind v4 + HashRouter）。
- `pnpm dev` → localhost:5173（配置了 `host: true`，远程可访问）。路由带 `#`：`/#/trip/seattle-2026-10/list`。
- Playwright 截图脚本模式：`chromium.launch({ executablePath: <chrome 路径> })`。**新机器要先 `npx playwright install chromium`** 并找到对应路径（旧机器在 `~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`）。
- `pnpm typecheck` = 根 tsconfig（管 `tools/`）+ 各包 `tsc --noEmit`。别用 `tsc -b`（与全仓 noEmit 相悖）。
- Fixtures：`apps/web/public/data/` 下 `seattle-2026-10`（真实行程，压力测试）、`_example`（最小示例）、`_demo`（全要素演示，**仅本地 dev 可见**，github.io 上没有）、`_broken`（必须恰好报 6 个错，`data:check` 拿它当负向对照）。

## 四、TripMD 当前形态（v1 + 前置块改造后）

细节以 `docs/TRIPMD_SPEC.md` 为准（章节顺序 = 文件规范顺序），这里只记设计要点：

- **三个前置块**：` ```trip-transports `（长途）/ ` ```trip-stays `（住宿）/ ` ```trip-rentals `（长租）。大段事务的全部细节（时刻、平台、票价 `cost`、条款）前置声明；`what` 三块间全文唯一。
- **`detail:` 引用**：事件只写 `detail: 名字` 一根指针。**首次引用**（按日期序，不是书写序 —— 往返幂等靠这个）的卡片长出信息模块/票面时间轴；之后的引用是简单提及，住/行筛选视图自动去重。事件上写 `transport:`/`stay:`/`lodging:` 都会报迁移错误。
- **钱的口径**：前置记录的 `cost` 进预算（长途记首次引用日、住宿记入住日、租车记取车日）；事件 `cost` 只写当场散项。统计在 `apps/web/src/lib/budget.ts`（预算页和月视图共用一份）。
- **诊断哲学：吵闹**。拼错的字段名 warning + suggest 建议、引用不存在 error + 建议、没人引用的前置记录 warning、静默丢数据 = bug。`_broken` fixture 钉住这个行为。
- **时刻是输入、日期是派生**：跨时区不能从时长反推天数（LAX→HND 的经典例子写在 SPEC 里），显式日期只在三种场景必写。
- 日期算术一律走 `@jjj/tripmd` 的 UTC 锚定实现（`addDays`/`daysBetween`/`mondayIndex`），**禁止裸 `new Date(iso)`**。

## 五、前端结构

```
apps/web/src/
  lib/          纯函数层：layout / calendar-grid / week-axis / lanes / budget / format /
                derive / segment-durations / day-bars / map-scene（以上全部有单测）
                + settings / palette / time / maplink / useScrollSpy / useMediaQuery（依赖 DOM，无单测）
  features/     视图专属：trip-list(首页+设置面板) / itinerary(列表) / calendar(周月) /
                map(地图) / budget / reference
  components/   只放 ≥2 个视图共用的：CategoryChip / CompositionBar / Segmented /
                Markdown / MapLinkButton / RailLayout / States
```

- 「时刻是输入、日期是派生」的实现（`timelineDates`）与「首次引用」扫描（`detailIndex`）
  都住在 `@jjj/tripmd` —— 它们是规范规则，不是前端布局。

- **布局数学进纯函数 + 单测，组件只画** —— 这是仓库铁律。写测试时准备「负向对照」（故意改错公式确认测试真的会红）。
- 设置存取统一走 `lib/settings.ts`（localStorage `jjj:settings`：theme 三态 / palette 覆盖 / rentalBand）。应用（注入 CSS 变量、贴 `data-theme`）由 `main.tsx` 的订阅统一做，组件只改设置。
- 浅色 = 亮米黄信笺纸（`--paper: #f9f2df`），玩吃住行卡是主色变淡的粉彩底（`--grp-mix` 10%），事务卡走 `--fog` 兜底中间色；深色档基本没动过。「注意红」也是可自定义令牌（`--tight` → `--a-tight`）。
- 设置面板（首页齿轮）：外观三态 + 7 个色令牌（固定 3×7 标准色板，先选行再点色，默认色内嵌网格）。租车底色开关**在周视图工具栏**，不在设置里。

## 六、当前状态（2026-08-20，四条 commit + worker 修复已推上线；.ics 接线本地完成）

- 测试基线：**19 个套件 / 272 个测试全绿**，`data:check` 4 fixtures 全过（`_broken` 恰好 6 错），typecheck/build 绿。
- **`.ics` 接线完成**（backlog 原第 1 条）：
  - **订阅是「计划变动日历跟着变」的那条路**：`data:check` 每次运行都把 `toIcs()` 的产物写到
    `data/<id>/calendar.ics`（与 geometry.json 同款「派生文件躺在 plan.md 旁边」，但**被
    gitignore** —— 重新生成零成本，不值得进版本库吃 DTSTAMP 抖动的 diff）。CI 在 build 前跑
    data:check，文件随 dist 发布 → 推 main 后订阅方数小时内自动跟上。
  - 资料页顶部三枚 chip：**订阅日历**（webcal 链接，Apple 点开即订）、**复制订阅链接**
    （https 地址，Google 日历要粘进「通过网址添加」）、**下载 .ics**（浏览器现场 `toIcs(trip)`
    生成快照，不会跟着更新，文案说清了）。链接拼装是纯函数 `lib/calendar-link.ts`（有单测）。
  - `toIcs` 补上了单测（此前零覆盖）：BEGIN/END 配对、75 字节折行不劈 UTF-8、UID 唯一、
    注入 now 后字节级确定。已知限制：**事件 UID 带位置序号**，某天开头插事件会让后面 UID
    全体漂移 —— 订阅场景无碍（整份 feed 替换），重复手动导入会出现重复事件。
- **数据是完整的**：seattle 30 个地点 **0 缺坐标**，32 段 legs 全部可算 —— 28 段拿到真实路网
  （`geometry.json` 29KB），剩 4 段是 rail / monorail，没有公开线路几何，照设计画虚线。
  规则收敛在 `@jjj/tripmd/geometry.ts` 一份，浏览器合并 / enrich / data:check 三处共用。
  `ORS_API_KEY` 在仓库根的 `.env`（已被 gitignore）。设计与补完记录见
  `docs/superpowers/specs/2026-08-13-enrich-pipeline-design.md`。
- **每天从住处出发**：`trip-day` 新增 `from_stay`（形状与 `to_next` 一模一样，读写共用
  `readMode` / `flowValues` / `legFlow`），起点由 `stayOfMorning(stays, date)` 从住宿区间认领
  —— 判据 `from.date < date ≤ to.date`，**只比日期不比时刻**，落地日天然排除、退房日照算。
  它落成 `Leg.afterEventId === null`，于是复用整条既有链路：列表在首卡之前多一行通勤条
  （**不多事件卡**），地图把住处顶成当天第 1 站，enrich 照样算成真路网。该有却没写 →
  warning（`lintDayOpening`）。西雅图命中两天（Day 2 / Day 5）。设计与偏差见
  `docs/superpowers/specs/2026-08-19-day-start-from-stay-design.md`。
- **地图这轮加的三件**（都在真浏览器里逐条验过）：
  - **真路 / 直连开关**（右下角两态 chip，档位记在 `jjj:maproutes`）：直连档把动线压成站点
    两点直连（`straightSegments()`，全段 `real: false` —— 这一档没有真假之分）。切换只对每天
    的 source 调 `setData`：**不重建图层**（会闪）、**不重新 fitBounds**（镜头每次都跳很晕）。
  - **起点旗**：当天 1 号 pin 上插一面黑白格子旗（赛车发车旗）。**有意不用 pin 的形状与配色**，
    尺寸是 pin 的 1.5 倍（`FLAG_SIZE 33` / `PIN_SIZE 22`，CSS 与 `map-scene.ts` 两处要同步），
    `startFlagOffset()` 以 1 号 pin 自己的错位量为基准再插进去 7px，中间不留缝。
    **只在看单独某一天时立** —— 全程图上五面旗全是噪声。
  - **方向箭头**：每天一层 `symbol`、`symbol-placement: 'line'`、每 105px 一个，压在同一份
    source 上，所以两档自动都有。图标必须画成**朝右**（maplibre 的 0° 是朝右），
    且是 canvas 画的图片而非 Unicode 三角（字符要字形包，降级纸底没有）。
  - 重合的 pin 用 `pinOffsets()` 散成一圈（全程 37 枚 pin 落在 28 个坐标上，最挤的 Astra 6 枚），
    **跨天一起聚**所以切天时 pin 不动；折线仍连真实坐标。
- **修掉一个从地图上线就存在的线上故障**：产物里没有 maplibre 的 worker，线上只显示 pin、
  没有底图。详情见第八节那条 —— 连带教训是**截图核对必须对着构建产物跑，不能只跑 dev**。
- **`pnpm check:built` —— 构建产物的地图关口**（worker 事故的固化）：带 CI base 构建到
  `dist-check/`，结构层离线断言（worker 产物在、它的相对 import 全落在包里、主 chunk
  持有它的地址 —— 恰好对应那两层历史坑，均重放验证过会红），浏览器层可选
  （`JJJ_CHROMIUM` / `JJJ_PLAYWRIGHT` 指定，找不到明确报跳过）。**不靠 ORS_API_KEY** ——
  那把 key 只有 enrich 用；此关口结构层完全离线，浏览器层只需要能访问 OpenFreeMap。
- **390px 上打开地点小卡不再盖住底部 chip**：小卡在窄屏横跨整个底部，样式切换与
  真路/直连两枚 chip 曾被它压住（看得见却点不到 —— `elementFromPoint` 抓出来的，
  截图看不出）。现在小卡的实测高度写进 `--card-h` 变量，两列 chip 在 `max-sm` 下
  `bottom: calc(0.5rem + var(--card-h))` 抬到卡上沿之上，关卡归 0 回原位；
  sm 以上卡片居中不占角，不让位。
- 过程文档（本文件 + `docs/superpowers/`）2026-08-20 曾转为本地不进版本库，**2026-09-02
  Harley 改了主意，随本轮 commit 一起入库** —— CLAUDE.md 结尾的说法已同步更新。

### 上一轮（2026-08-12 地图视图落地）

- **五视图收官**：地图视图已落地（MapLibre GL + OpenFreeMap 瓦片，运行时零 API 调用）。
  五个视图路由统一懒加载 —— maplibre 独立 chunk（gzip 254KB，只有进地图页才下载），
  react-markdown 落共享 chunk，主包不含二者。设计与实现记录见
  `docs/superpowers/specs/2026-08-11-map-view-design.md`。
- 地图这轮修的真问题（都是 390px 上跑出来的，见 spec 的实现记录）：dev 下 maplibre worker
  404 导致画布全白（`optimizeDeps.exclude`）、底部 chip 压住 OSM 版权行、透明浮层容器吃掉
  相邻按钮点击、降级警告条压住页签。**第五个页签还挤爆了头部标题**——390px 上只剩 10px，
  经 Harley 定夺改为 640px 以下隐藏标题。
- 第二轮（08-12，Harley 试用后）：左下角改成抽屉式样式切换器（收起只占一枚 chip）；
  OSM 版权收成 ⓘ，底部整行还给地图，两组 chip 落回 `bottom-2`；点选地点后镜头居中
  （偏移量走 `cardFocusOffset` 纯函数 + 单测）。**顺带修掉一个一直没生效的淡化**：
  maplibre 的 `Marker` 每次重绘都会重写 `element.style.opacity`，必须走 `setOpacity()`。
- 第三轮（08-12）：小卡加序号徽章（复用 `.map-pin` 外观 + 当天动线色），并支持换站 ——
  桌面端卡片左右两侧按钮、手机端直接滑动卡片；邻站查找走 `stopNeighbors` 纯函数 + 单测，
  只在当天之内走、到头不循环。

### 上一轮（2026-08-11 架构收敛）
- 这一轮做了什么（细节见 git log 的三个收敛 commit）：
  - 「首次引用」三处合一（`tripmd/resolve.ts` 的 `detailIndex`）；`timelineDates` 等日期派生上移 `@jjj/tripmd`；schema 回到纯形状。
  - 未知字段警告覆盖**所有**块与子记录（曾只有前置三块）。
  - `parse.ts` 1151 行拆成 `read / sections / blocks / days / lint` + 138 行编排层。
  - 主题系统改 `light-dark()`，修复了强制深色下 `--band-tint-mix` 的漂移；CI 补上 typecheck。
  - 构成条 / 分段控件 / 票面日期行收敛成单份；布局数学全部进 lib 并有单测。
- 修过的真 bug：待订图标的 `dark:` 变体（强制主题不跟随）、首页倒计时用 UTC 而非行程时区、两处裸 `localStorage`（隐私模式白屏）。

## 七、Backlog（按 Harley 的优先级感觉排序）

1. **硬约束露出** —— `trip-constraints` 解析着但没有视图渲染（SPEC 已如实说明）。周视图画约束线是最自然的归宿。**Harley 已拍板暂缓（2026-08-21），编辑模式先行。**
2. **编辑模式（下一站，计划已写好待过目）** —— 完整五里程碑实施计划在
   `docs/superpowers/specs/2026-08-21-edit-mode-design.md`（含已拍板决定：PAT 直 commit、
   Anthropic 浏览器直调、导入时刻显式规范化）。`applyPatch` 阀门就绪（含 `set_transports`
   写进被引用 journey 的逻辑）；行程改名已做，事件编辑/日历拖拽都等它。
   Harley 设想的完整形态是**两条路并存**：把信息交给 agent 让它帮忙优化，以及传统的手工修改。
   - **补坐标算这里的一个用例**：地图右下角那枚「N 个地点缺坐标」的 chip 今天纯只读
     （`missingCoords(trip)` 出名单，点开列名字，没有输入口）。用户想现场提供地址时该往哪写，
     等编辑模式一并处理 —— 别单独给它开一条写路径。
   - 写回这条路今天在仓库里不存在：`TripRepository` 只有 `listTrips` / `getTrip`，
     `saveTrip?` 标着「Phase 6 才有」且无实现。这是第一条「浏览器 → plan.md」的写路径，
     动它就是动数据源那个唯一切换点。
3. **Agent 管道** —— 让 agent 填「待填」槽位；`AUTHORING_PROMPT.md` 是给 LLM 的写作规范（骨架示例经真解析器验证零警告，改它时要保持这一点）。`parse.ts` 的拆分已在 2026-08-11 完成。
4. Phase 6 后端（远期）：`TripRepository` 换 HTTP 实现、收藏/改名上云。

其余行程若要跑 enrich：`--geocode` 出清单 → 逐条过目 → `--apply` 写回 → 重跑一次
`pnpm enrich <dir>` 把新出现的段补上。工具会自己拒掉落在行程包络框外的地理编码结果。

## 八、易踩的坑（都真实发生过）

- `pnpm add -w` 会修剪子包 node_modules 链接 → 装完东西跑一次 `pnpm install`。
- Playwright 的 `has-text` 是子串匹配（"住"会命中"入住"），断言用 `getByRole` + `exact: true`。
- 测试脚本直接写 localStorage 不会刷新 `settings.ts` 的内存缓存 —— 要么 `page.reload()`，要么走真实 UI 点击。
- vitest 全仓扫描：`apps/web/src/**/*.test.ts` 自动收录，新纯函数记得配测试。
- 月视图格子按 `aspect-ratio: 1/2` 自适应，别写死像素高；周视图「首次引用」的事件才有 transports，别假设每个引用事件都有票面。
- serialize 输出顺序 = 规范顺序（硬约束→长途→住宿→租车→地点表→天），改块结构时 roundtrip 测试会替你把关。
- **maplibre 在 dev 下的两个坑**：worker 文件不在 vite 预打包里（404 → 画布全白，靠 `optimizeDeps.exclude` 解），
  它的 CSS 随懒加载 chunk 在 Tailwind 之后注入（同特异性后来者赢 → 容器定位得写内联 style）。
  两者都只在 dev / 真浏览器里现形，单测和 build 全绿。
- **maplibre 的 worker 在生产构建里还有一个更深的坑，线上瘫了 8 天才发现**（08-12 上线，
  08-20 Harley 报告「只显示 pin 不显示地图」）。maplibre **运行时**从 `import.meta.url` 拼
  worker 地址，打包器看不见这个字符串 → worker 从没进过 `dist` → 线上 404 → 瓦片全不解析，
  底图和动线都不画，pin 是 DOM 所以照常显示。修法：模块顶层
  `setWorkerUrl(workerUrl)`，其中 `import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'`。
  - **必须 `?worker&url`，不能只 `?url`**：那个 worker 自己 `import "./maplibre-gl-shared.mjs"`，
    单拷文件的话 worker 起来了却死在 import 上 —— 症状与 404 一模一样，更难查。
    `?worker&url` 让 vite 把它连依赖整个打成 worker（~470KB 产物，正常）。
  - **dev 和 `vite preview` 都照不出来**：dev 直接从 node_modules 加载（worker 就在旁边）；
    preview 的 SPA 回退把缺失文件回成 200 + index.html，只有真静态托管（Pages）才 404。
    所以**动地图必须对构建产物验**：普通静态服务器挂 `dist`、带 CI 的 base 路径，
    断言「起了 web worker」+「有瓦片请求」。别读 WebGL 画布像素 —— 没开
    `preserveDrawingBuffer` 时读回来一片空白，是假红。
- **maplibre 的 `Marker` 会重写你写进 `element.style.opacity` 的值**（每次重绘都用内部
  `_opacity` 覆盖，地形遮挡用的），必须走 `marker.setOpacity()`。硬写 style 在静止时看着
  是对的，一到 `fitBounds` 动画就被抹掉 —— 「切天了但没淡化」就是这么来的。`filter` 它不碰。
- **OSM 版权行默认是展开的**（compact 形态 ≠ 收起），390px 上占满一整行。要收成 ⓘ 得等
  归属信息落定之后再摘 `maplibregl-compact-show`，建图那一刻摘无效，会被加回来。
- **手势的判定值不能放 state**：`touchend` 读到的是本次渲染闭包里的值，一串 touch 事件挤在
  同一个任务里时 React 还没重渲染，永远读到初始值。真值放 ref，state 只用来画。
- **绝对定位的浮层容器会吃掉相邻按钮的点击**：`items-end` 之类让容器盒子有最宽子元素那么宽，
  透明区域照样吞事件，截图完全看不出来。地图上用 `pointer-events-none` + 子元素 `auto` 解。
  这类问题要靠 `elementFromPoint` hit-test，不能只靠肉眼看图。

祝顺利。有不确定的先看 `docs/superpowers/specs/2026-08-04-calendar-view-design.md` 的「实现记录」—— 设计和实现的每次偏差都记了原因。
