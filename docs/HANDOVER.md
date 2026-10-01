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

- pnpm workspace：`@jjj/schema`（枚举 + zod）、`@jjj/tripmd`（parse/serialize/patch/summary/ics/values/sanitize/publicPlan）、`@jjj/datadir`（数据目录的文件层，唯一带 node:fs 的包）、`@jjj/web`（Vite + React + Tailwind v4 + HashRouter；`vite/data-routes.ts` + `data-plugin.ts` 是数据目录接进 dev 的那层）。**Node ≥ 24**（`.nvmrc`）—— vite.config 间接 import 的 workspace 包入口是 `.ts`，Node 20 跑不了，两份工作流已钉 24。
- `pnpm dev` → localhost:5173（配置了 `host: true`，远程可访问）。路由带 `#`：`/#/trip/seattle-2026-10/list`。
- Playwright 截图脚本模式：`chromium.launch({ executablePath: <chrome 路径> })`。**新机器要先 `npx playwright install chromium`** 并找到对应路径（Linux 在 `~/.cache/ms-playwright/chromium-<rev>/chrome-linux64/chrome`，macOS 在 `~/Library/Caches/ms-playwright/chromium-<rev>/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`；`check:built` 两处都会自己找）。`playwright-core` 临时 `npm i` 在会话 scratchpad 里，不进仓库。
- **改完代码看一眼用 `pnpm look`**（2026-09-14 起）：起 dev 服务器并在 Chrome 里开首页，`--public` 开公开版、`--both` 两个一起；Chrome profile 自动选仓库 `git user.email` 登录的那个，在它当前窗口里加标签页；端口被占自动往上找。Harley 自己跑，agent 只给命令。
- `pnpm typecheck` = 根 tsconfig（管 `tools/`）+ 各包 `tsc --noEmit`。别用 `tsc -b`（与全仓 noEmit 相悖）。
- Fixtures：`apps/web/public/data/` 下 `seattle-2026-10`（真实行程，压力测试）、`_example`（最小示例）、`_demo`（全要素演示，**仅本地 dev 可见**，github.io 上没有）、`_broken`（必须恰好报 6 个错，`data:check` 拿它当负向对照）、`_showcase`（seattle 抹除后的公开版副本，`pnpm showcase:refresh seattle-2026-10` 重生成，roundtrip / patch 测试吃它，同样仅 dev 可见；别对它跑 `enrich`）。同目录下还有 `space.md`（个人空间名片，`data:check` 一并校验）；`JJJ_DATA_DIR` 可把数据目录指到别处（2026-09-11 起）。**合成 fixture 与测试里不能出现真行程（seattle）的任何值** —— 仓库是公开的；`_showcase` 是唯一例外，它本身就是抹过的公开版。

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

## 六、当前状态

### 本轮（2026-09-09 → 09-30 · 个人空间与分享，迁移第 1 步**代码完成 + 审查轮**，待 Harley 检查后提交）

- **目标**：把「工具 / 私人数据 / 公开数据」三个面切开 —— 工具仓库开源可 fork，Harley 的 `space.md` + 真行程住私有数据仓库，两份产物各发一个 Cloudflare Pages 项目：公开版（抹过敏感信息）不挂 Access，完整版挂 Access（09-30 裁决：Harley 的个人 GitHub 是 Free，Pages 发不了私有仓库，原定的「数据仓库自己的 GitHub Pages」作废）。设计：`docs/superpowers/specs/2026-09-09-personal-space-sharing-design.md`（含「已拍板」表与「实现记录」）；实施计划：`docs/superpowers/plans/2026-09-09-personal-space-sharing.md`（**顶部「进度」表是接手入口**）。
- **做到哪**：11 个 Task 全部在树里。1–6（`visibility` 字段、manifest 带 visibility + `PUBLIC_BUILD`、`space.md` 个人空间 + 首页名片 + 打赏抽屉、`JJJ_DATA_DIR` + `tools/lib`、`sanitize` 白名单、`findLeaks`）09-11 以 `wip:` 提交；7–11 在 09-15 → 09-18 完成，**未提交**：Task 7 复审补了 5 处作者专用面（住宿 / 租车模块的悬空标签与字面「待填」、事件「待订」角标、航班空骨架、月视图待订数、地图缺坐标 chip）；Task 8 `pnpm build:public`（`tools/publish.ts` + `tools/lib/stage-public.ts`）与 `check:built --public`；Task 9 `_showcase` + `pnpm showcase:refresh`，roundtrip / patch 测试改吃它；Task 10 CI 加两道关口（本仓库仍只发完整版）、`templates/publish.yml`、`docs/PUBLISHING.md`；Task 11 文档。Harley 的要求是**先改完测完，他检查过再统一提交**。
- **打赏**（Harley 2026-09-09 追加）：`space.md` 的 `tips` 列表（`label` + `image` 二维码 / `url` 链接二选一）→ 名片「☕ 打赏」chip → 底部抽屉。工具仓库的示范 `space.md` 不带 tips。
- 测试基线 **32 套件 / 370 测试**（09-30 四条裁决落地后，spec 实现记录 32）；关口链 `pnpm typecheck && pnpm test && pnpm data:check && pnpm build && pnpm build:public && pnpm check:built && pnpm check:built --public` 全绿（浏览器层在 Mac 上真跑）。`pnpm data:check` 现在也校验 `space.md`（含头像 / 二维码文件存在性）；`manifest.json` 形状变了：`{trips:[{id, visibility}]}`；seattle 标了 `visibility: public`（仓库本来公开，不改变暴露面，`build:public` 才有东西可抹）。
- 执行方式是子代理驱动（每 Task 一个实现者 + 独立审核 + 修复轮）；审核抓出的三个真 bug 已修：打赏遮罩 `bg-ink/30` 深色下发亮、dev 数据中间件路径穿越、sanitize 合成 fixture 里混进真行程的值。**新规矩**：合成 fixture 与测试里不能出现真行程（seattle）的任何值 —— 仓库是公开的。
- **环境变化**：EC2 是公用机器，dev / preview 服务器的端口别人看得见 —— 本轮结束时 :5173 / :5174 已全部关掉，**后续开发在 Harley 本地进行**（`git clone` 后 `pnpm install`、`npx playwright install chromium`，其余照 CLAUDE.md）。在公用机器上验证完必须关端口。Mac 上 pnpm 是 `corepack enable` 装的（package.json 钉 10.28.2）。
- **09-15 → 18 这轮的发现与裁决**（细节在 spec 实现记录 13–19）：
  1. **抹净断言第一次实跑就拦下 `trip-constraints`**：label 里有航班号、note 里有 Global Entry / 倒推链 / 合同截止。这块全站不渲染却会随 plan.md 发出去 → `sanitize` 整块不带它（超出 spec v1「只抹前置块」范围，**09-30 Harley 确认维持**）。fixture 补了带真值形态的 constraints，3 条测试负向对照会红。
  2. **两个只有抹除后数据才暴露的票面 bug**：抵达票的 `SEA` 滑到出发端（`justify-between` 只剩一个子元素）、被抹那端挂着派生的孤日期。`TimeStack` 公开版无时刻就整栈空、两端各包一层占位空盒。
  3. **正文残余面实证**：seattle 附录「预算」里有一条只在正文出现的确认号，扫描器黑名单从结构化字段现算，**看不到它**，也不会抹。09-30 Harley 让删，已删（Global Entry 四处一并删掉，她没有）；8 处金额命中都在附录预算表，按设计只警告。今天什么都还没发出去。
  4. 预订角标：09-30 Harley 裁决**三种都不进公开版**，`sanitize` 在数据层去掉 `booking` 块与 `needs-booking` 标记（spec 实现记录 32）。
  5. `_showcase` 标题带「公开示范 ·」前缀，但**不上 dev 首页**（Harley 09-29：完整版首页不要两个西雅图；09-30 审查轮曾把它误放回首页，已改回，spec 实现记录 33）。dev 首页 = 真行程 + `_demo`，由 `data-routes.ts` 的 `DEV_HOME_FIXTURES` 决定。
  6. 两种产物都对 `/favicon.ico` 404，index.html 本来就没引用图标，线上今天也这样，没动。
- **09-29 Harley 看过本地效果后追加三条**（spec 实现记录 20–22）：首页头像换成他的 GitHub 头像（`avatar.png` 进数据目录，`dataUrl` / `data:check` 顺带放行绝对 URL）；公开版里抵达 / 离开事件的正文全清（票面抹了的信息正文在复述）；**首页卡片右下角「公开 / 私有」开关** —— 第一条浏览器写回 plan.md 的路径，只改 frontmatter 一行、dev-only、再解析验收，真浏览器往返后文件与 HEAD 字节一致。`_showcase` 不再上 dev 首页。测试基线 **26 套件 / 325 测试**。随后 Harley 发现 `pnpm look --public` 仍显示详细信息 —— dev 喂的是原始 plan.md，sanitize 只在 build:public 跑；补了 vite 插件 `jjj:public-data`，公开版 dev 逐请求现抹、manifest 扫目录现算、非 public 与 ics 404（spec 实现记录 23）。**规矩：任何标着「公开版」的入口，数据都必须是抹过的，UI 层的隐藏只是第二道**。
- **行程本身**（09-29，Harley 口述）：玻璃球订到 10/3 13:30、水上飞机 16:00–16:30、AC Hotel 三晚已订。Day 3 连锁：派克市场延到 13:10、Seattle Center 推到 16:40 缩到 25 分钟，单轨 / 凯里公园 / 晚餐不动；附录待办 1–3 打勾。待订剩 2 项（HTCAW、Asadero）。玻璃球出来到起飞中间空一个多小时，Harley 未决定怎么填。
- **迁移第 2 步的本地部分已做**（spec 实现记录 24）：数据仓库脚手架在 `projects/journeys/`（`trips/` 含 space.md、头像、seattle、manifest；工作流模板；README；.gitignore 忽略 ics），以它为数据源整条链全绿；`JJJ_DATA_DIR` 在仓库外时 dev 也会监听并整页刷新。`space.md` 里还是工具的示范文案，Harley 要改成自己的。编辑模式 spec 里程碑 ③ 的写回目标已改成数据仓库（迁移第 5 步的文档部分）。
- **09-30 审查轮**（Harley 要求下一步前做一轮整体审查；spec 实现记录 25）：三处「同一件事写了三遍」收敛 —— 新包 `@jjj/datadir` 独占数据目录的文件层（工具、暂存、vite 插件共用；唯一带 `node:fs` 的包）；三个 vite 插件合成 `jjj:data` 一个，搬到 `apps/web/vite/data-plugin.ts`，`vite.config.ts` 回到纯配置，开关端点契约在 `src/data/visibility-api.ts`；公开版「空槽不画」收成 `lib/public.ts` 的 `showsField` / `shownTerms` + `ticket-parts.tsx` 的 `Field`，六个组件里的散判全删。`tools/look.ts` 的 Chrome 那半拆到 `tools/lib/chrome.ts`。行为零变化（四个 dev 服务器逐条断言 + 双主题截图核对）。**同日第二轮**（spec 实现记录 27–30）：五个子代理对抗式审查，坐实并修掉 —— geometry.json 原样拷带走民宿门牌与精确坐标（`filterGeometry`）、role 按行程首末日判会把居家日行程的两班全留（改按引用日期跨度）、黑名单不收硬约束、抵达卡后面的 `to_next` label 没清；公开版 dev 非规范路径（`//`、`%2e`）绕过抹除直出原文、坏转义打死进程、开关端点无 CSRF、写回非原子（插件拆成可单测的 `vite/data-routes.ts`，公开版改白名单、规则链与构建同一个 `publicPlan`）；**工作流钉的 Node 20 跑不了新的 vite.config**（改 Node 24 + `.nvmrc`）；两处 UI 回归（网约车 baggage 静默丢、长站名不省略）。**同日第三轮**：Harley 装上 Anthropic 官方 code-review 插件后再审一遍，抓到第二轮修复自己的两道缝 —— role 跨度混进了住宿租车的引用、`/%64ata/…` 的前缀在解码前比较导致公开版 dev 直出原文 —— 以及离开卡前那段路没清、公开版 dev 仍有写端点、符号链接能被写出数据目录、名片资源路径不校验（spec 实现记录 31）。
- **09-30 裁决：公开站改发 Cloudflare Pages**（spec 实现记录 26）—— Harley 的个人 GitHub 是 Free。`templates/publish.yml` 两步 wrangler 直传、去掉 Pages 权限，Variables `CF_PROJECT_PUBLIC` / `CF_PROJECT_FULL`；`PUBLISHING.md` 第五节改成五步；脚手架里的工作流与 README 已同步。
- **Harley 待办**：检查整份 diff 后提交并打 tag `v0.2.0` 推上去；改 `journeys/trips/space.md` 成自己的名片；按 `docs/PUBLISHING.md` 第四节推数据仓库、第五节 Cloudflare 五步、然后删真行程、`_showcase` 改名；**第 4 步之前别对外分享**。

### 上一轮（2026-09-05 · seattle 行程照真实出行重写）

- **seattle-2026-10 从示范行程变成真实行程 v1**：5 天 4 晚（10/1–10/5），机票已出票（她 KE/CX 经仁川/香港，我 DL 直飞 SNA），Ashford 木屋已订（Mt. Rainier Getaway，$339.42，坐标经 Nominatim 按门牌精确定位），租车已订（Turo Tesla Model Y LR，Tukwila 轻轨站交接，10/1 10:30–10/5 09:00，$343.60）。结构：Day 1 落地坐 Link 提车、接她、南下 Ashford → Day 2 雷尼尔（Glacier Vista 中等线 + Narada Falls）夜宿回城 → Day 3 市区（派克市场/玻璃球/水上飞机/Kerry Park）→ Day 4 渡轮过海去奥林匹克半岛（Sequim 超充 → Game Farm → Lake Crescent Lodge 午餐 → Marymere → 飓风岭 → PA 晚餐 → Sequim 超充 → 夜航回）→ Day 5 Southcenter 补电、Tukwila 交车、Link 一站到机场。Day 3/4 可按半岛天气互换（代价：玻璃球周六限定）。充电策略成表写进「租车 · 充电 · 停车」附录。待定：AC Hotel 三晚（门店已定为 AC Hotel Seattle Downtown，117 Yale Ave N，坐标按门牌精确定位；房还没订）。新地点坐标全部走 Nominatim/Overpass 定位，不再手猜 —— 手猜的两次（飓风岭、AC 占位）都被抓出来了。
- **工作流**：Harley 分段给修改意见 → 改草稿过目 → 通过后才跑验证轮（enrich + 全关口 + 事实核查 + 截图）。事实核查修掉的坑：2120 周六无午市（免费停车口子中午不成立，午餐换 Serious Pie）、跨日界线西向航班必须写 `arr_date` 否则钟点回卷误标 +1（transport-dates.ts 规则 4，spec 就是这么设计的）。
- 测试基线仍 **19 套件 / 272 测试**；`patch.test.ts` 的事件锚点从「晚餐」改成「午餐」（fixture 重写后 Day 1 正餐变了）。路网 30/30 全真实几何。
- **分段票面（transport.legs）**：中转前后班次号/客舱/座位逐段记录（`legs` 数量必须 = stops + 1，错配响亮警告），联程属性（价格/全程/托运/直挂/共同退改）留顶层；顶层新增 `seat` 字段（此前 seat 只是 cabin 的兜底别名，cabin 存在时座位号被静默丢弃 —— 已修）。票面时间轴下加分段信息条，标题行班次号由各段自动拼出。同类修复：`_demo` 的 UA34 东行同日到达其实一直误标 +1（必须显式 `arr_date`），已补。测试基线 **20 套件 / 276 测试**（新增 legs.test.ts）。
- **票面条款行定型（2026-09-08）**：标题行只放承运方 + 全程 + 票价；轴下方**一行**三格带图标 —— 舱位（班次 · 客舱 · 座位，中转每段一行叠在格里，legs 只剩这三样）· 托运（件数 + 直挂，如 `1 件 · 直挂`）· 退改；放不下整行横滑、藏滚动条（与时间轴同一套容器）。`through_check` 字段退役（写了会警告）；航站楼写进地点名（`PVG T1` / `SNA A`），note 只留真提醒。金额显示统一取整：`fmtMoney` + 新的 `roundMoneyText`（票面 price、cost 原文、预算明细原文这些自由文本里的金额一起抹小数）。
- **预订状态并进标题角标**（Harley 拍板）：`需预订`（琥珀）/`已预订`（灰）挂在标题行「待定」旁，独立的 BookingModule 行删除；booking 的 deadline/note 由 DayTimeline 下沉进注意条目盒渲染（不静默丢数据），seattle 的 booking note 已全部迁到 notes 或删重。纯 `needs-booking` flag（无 booking 块）仍显示「待订」。机票信息改用票面结构化字段（carrier/number/duration/cabin/price/stops），不再塞 note。

### 上一轮（2026-08-20，四条 commit + worker 修复已推上线；.ics 接线本地完成）

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
   - 整份写回这条路今天在仓库里不存在：`TripRepository` 只有 `listTrips` / `getTrip` / `getSpace`
     和窄到只改一行的 `setVisibility?`（那个 `saveTrip?` 空桩 09-30 审查轮删了，零引用）。
     `saveTrip(id, markdown)` 落地时就是动数据源那个唯一切换点。
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
