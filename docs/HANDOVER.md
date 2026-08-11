# 交接文档 · 给下一个 Agent

2026-08-10 由上一台 EC2 的会话写就，2026-08-11 架构收敛轮更新。读完这份 + `docs/TRIPMD_SPEC.md` + 设计文档，你就有了全部上下文。

---

## 一、这是什么项目

**Just J Journey**（就是 J 人的旅行工具）—— 把 TripMD（一种可确定性解析的旅行计划 Markdown）渲染成多视图网页。线上：<https://helloworldharley.github.io/just-j-journey/>（推 main 自动部署 GitHub Pages）。

架构一句话：**hub-and-spoke**。`Trip` 对象（zod）是 hub，TripMD 文本经 `parse()`/`serialize()` 双向往返，语义幂等 `parse(serialize(parse(md))) === parse(md)` 被测试钉死。浏览器直接 fetch 并解析 `plan.md`，没有 JSON 中间层；所有写操作走 `applyPatch` → serialize → 重新 parse，解析器是唯一校验器。

五视图承诺：列表 ✓ 日历 ✓ 资料 ✓ 预算 ✓ **地图 ✗（最后一块，未开工）**。

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
                derive / segment-durations / day-bars（以上全部有单测）
                + settings / palette / time / maplink / useScrollSpy / useMediaQuery（依赖 DOM，无单测）
  features/     视图专属：trip-list(首页+设置面板) / itinerary(列表) / calendar(周月) /
                budget / reference
  components/   只放 ≥2 个视图共用的：CategoryChip / CompositionBar / Segmented /
                Markdown / RailLayout / States
```

- 「时刻是输入、日期是派生」的实现（`timelineDates`）与「首次引用」扫描（`detailIndex`）
  都住在 `@jjj/tripmd` —— 它们是规范规则，不是前端布局。

- **布局数学进纯函数 + 单测，组件只画** —— 这是仓库铁律。写测试时准备「负向对照」（故意改错公式确认测试真的会红）。
- 设置存取统一走 `lib/settings.ts`（localStorage `jjj:settings`：theme 三态 / palette 覆盖 / rentalBand）。应用（注入 CSS 变量、贴 `data-theme`）由 `main.tsx` 的订阅统一做，组件只改设置。
- 浅色 = 亮米黄信笺纸（`--paper: #f9f2df`），玩吃住行卡是主色变淡的粉彩底（`--grp-mix` 10%），事务卡走 `--fog` 兜底中间色；深色档基本没动过。「注意红」也是可自定义令牌（`--tight` → `--a-tight`）。
- 设置面板（首页齿轮）：外观三态 + 7 个色令牌（固定 3×7 标准色板，先选行再点色，默认色内嵌网格）。租车底色开关**在周视图工具栏**，不在设置里。

## 六、当前状态（2026-08-11 架构收敛轮之后）

- 测试基线：**15 个套件 / 177 个测试全绿**，`data:check` 4 fixtures 全过（`_broken` 恰好 6 错），typecheck/build 绿。
- 这一轮做了什么（细节见 git log 的三个收敛 commit）：
  - 「首次引用」三处合一（`tripmd/resolve.ts` 的 `detailIndex`）；`timelineDates` 等日期派生上移 `@jjj/tripmd`；schema 回到纯形状。
  - 未知字段警告覆盖**所有**块与子记录（曾只有前置三块）。
  - `parse.ts` 1151 行拆成 `read / sections / blocks / days / lint` + 138 行编排层。
  - 主题系统改 `light-dark()`，修复了强制深色下 `--band-tint-mix` 的漂移；CI 补上 typecheck。
  - 构成条 / 分段控件 / 票面日期行收敛成单份；布局数学全部进 lib 并有单测。
- 修过的真 bug：待订图标的 `dark:` 变体（强制主题不跟随）、首页倒计时用 UTC 而非行程时区、两处裸 `localStorage`（隐私模式白屏）。

## 七、Backlog（按 Harley 的优先级感觉排序）

1. **地图视图** —— 五视图收官。地基全埋好了：地点表坐标 + 离群检测、`day.color` 路径色环（`DAY_COLORS`）、`legs.geometry` 留了 polyline 字段（null 画虚线弧）、`gmaps_place_id`。照日历的套路来：纯函数层 + 单测先行。
2. **`.ics` 接线** —— `toIcs()` 在 `packages/tripmd/src/ics.ts` 早写完（LOCATION 喂「该出发了」、待订提醒），差页面入口。
3. **硬约束露出** —— `trip-constraints` 解析着但没有视图渲染（SPEC 已如实说明）。周视图画约束线是最自然的归宿。
4. **编辑模式** —— `applyPatch` 阀门就绪（含 `set_transports` 写进被引用 journey 的逻辑）；行程改名已做，事件编辑/日历拖拽都等它。
5. **Agent 管道** —— 让 agent 填「待填」槽位；`AUTHORING_PROMPT.md` 是给 LLM 的写作规范（骨架示例经真解析器验证零警告，改它时要保持这一点）。`parse.ts` 的拆分已在 2026-08-11 完成。
6. Phase 6 后端（远期）：`TripRepository` 换 HTTP 实现、收藏/改名上云。

## 八、易踩的坑（都真实发生过）

- `pnpm add -w` 会修剪子包 node_modules 链接 → 装完东西跑一次 `pnpm install`。
- Playwright 的 `has-text` 是子串匹配（"住"会命中"入住"），断言用 `getByRole` + `exact: true`。
- 测试脚本直接写 localStorage 不会刷新 `settings.ts` 的内存缓存 —— 要么 `page.reload()`，要么走真实 UI 点击。
- vitest 全仓扫描：`apps/web/src/**/*.test.ts` 自动收录，新纯函数记得配测试。
- 月视图格子按 `aspect-ratio: 1/2` 自适应，别写死像素高；周视图「首次引用」的事件才有 transports，别假设每个引用事件都有票面。
- serialize 输出顺序 = 规范顺序（硬约束→长途→住宿→租车→地点表→天），改块结构时 roundtrip 测试会替你把关。

祝顺利。有不确定的先看 `docs/superpowers/specs/2026-08-04-calendar-view-design.md` 的「实现记录」—— 设计和实现的每次偏差都记了原因。
