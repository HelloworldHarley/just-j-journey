# 个人空间与分享 · 设计

## Context

Harley 想在每次行程走完后把攻略分享到社媒，但点开链接的人只能看到他**主动公开**的行程，而且看到的是**抹去敏感信息**的版本。讨论中需求升级为：

- **工具开源、可 fork**：这个仓库只是工具，不含任何真实行程；想用的人 fork 之后接自己的数据
- **个人空间是数据**：Harley 的 profile + 行程攻略住在一个私有数据仓库里；「分享」分享的就是个人空间站的链接，里面列着所有 `visibility: public` 的行程，每份都是抹过的
- 他自己看的**完整版**（确认号、门牌、票价、私人备注）另有一个需要登录的站

一个决定方向的事实：当前仓库是**公开的**，主站首页列着全部行程 —— 所以「别人看不到我其他行程」今天不成立，不是分享功能的缺失，是私人面从未被切开。本设计就是把「工具 / 私人数据 / 公开数据」三个面切开。

### 已拍板的决定（勿再议）

| 决定 | 内容 |
|---|---|
| 托管形态 | **方案 A**：一份数据两条发布线。完整版 → Cloudflare Pages + Cloudflare Access（One-time PIN 邮箱登录，免费档）；公开版原定数据仓库自己的 GitHub Pages，**2026-09-30 改为第二个 Cloudflare Pages 项目（不挂 Access）**：Harley 的个人 GitHub 是 Free 账号，Pages 只能从公开仓库发，而数据仓库必须私有。GitHub Pages 只剩工具仓库自己的演示站（实现记录 26） |
| 代码 / 数据边界 | 工具仓库只带 `_example` / `_demo` / `_showcase` 示范数据；真实行程 + `space.md` 住私有数据仓库；数据仓库不含代码，只有 Markdown、geometry 缓存和一个工作流 |
| 抹除范围（v1） | 只抹**前置块**（长途 / 住宿 / 租车）里的敏感信息；事件卡、正文、附录、事件散项 cost 一字不动 |
| 长途抹法 | 按**天**判定：Day 1 首次引用 = 抵达（只留到达端）、末日 = 离开（只留出发端）、中间日 = 行程内部移动（两端全留）；其余字段全抹。**2026-09-30 修订**：「Day 1 / 末日」改为「各长途首次引用日期里最早 / 最晚的那天」—— 原规则的超集，补上首日、末日在家的行程（实现记录 27） |
| 住宿 / 租车抹法 | 只抹 `cost`；名字、平台、起止、房型、停车、早餐、退改、里程、保险照留 |
| 民宿地点 | `homestay` 类地点公开版坐标模糊到约 1 公里、去掉 `en` / `note`；`hotel` 是公开商业地址照留 |
| 待填槽 | 公开版**不画**「待填」—— 那是给作者的提醒，抹掉的字段直接不渲染 |
| visibility | 只有 `public` / `private` 两档，默认 `private`；不做 `unlisted` |
| 硬约束（2026-09-30 裁决） | `trip-constraints` **整块不进公开版**（实现记录 14 的做法转正） |
| 预订信息（2026-09-30 裁决） | 需预订 / 已预订 / 待订**都不进公开版**：`sanitize` 去掉每个事件的 `booking` 块与 `needs-booking` 标记（实现记录 32） |
| 长途判定（2026-09-30 裁决） | 采纳「各长途首次引用日期的最早 / 最晚那天」的新规则（实现记录 27、31），见上方长途抹法行的修订 |
| 打赏（2026-09-09 追加） | 打赏是**数据**，住 `space.md` 的 `tips` 列表（`label` + `image` 二维码 / `url` 链接二选一）；有一项就在名片上长出「☕ 打赏」按钮，点开底部抽屉；二维码是给人扫的，公开版和完整版都显示；工具不预设任何平台 |

### 仓库约定（执行时必守）

同编辑模式 spec：不代跑 git 写操作、中文文案注释 / 英文单行 commit、布局与逻辑进 lib 纯函数 + 单测（负向对照）、全套关口 + 截图、深度整合不打补丁、CSS 注释禁 `*/`。

---

## 第一节 · 抹除规则（公开版）

抹除发生在**构建期**，纯函数 `sanitize(trip): Trip`，链路 parse → sanitize → serialize → 再 parse 验收 —— 解析器照旧是唯一校验器，抹完的 plan.md 必须是合法 TripMD。

### 长途（`trip-transports`，每条 transport）

判定用的是它**首次引用**（`detailIndex`，按日期序）落在哪一天：

| 首次引用在 | 视为 | 保留的端点 |
|---|---|---|
| Day 1 | 抵达 | `to` + `arr_time`（+ `arr_date` / `arr_day_offset`，缺了日期会推错） |
| 最后一天 | 离开 | `from` + `dep_time` |
| 中间任何一天 | 行程内部移动（城际火车 / 新干线 / 内陆段） | `from` / `to` / `dep_time` / `arr_time` 全留 |

无论哪类，都保留 `traveler`（她/我，多人汇合的语义）和 `mode`（画图标）。**全部抹掉**：`carrier` `number` `price` `duration` `cabin` `seat` `baggage` `refund` `stops` `legs` `note`，以及未保留的那一端和 `dep_date`。记录级 `cost` 抹掉。

多人不同出发地汇合自然成立：两条 transport 公开版都只剩「→ SEA · 10:05 / 10:40」。

已知边界：Day 1 既抵达又有内部移动（落地直接转火车去另一城）会把内部段当抵达少一端。真遇到再给 journey 记录加 `share: keep-both` 覆盖字段，现在不预设。

### 住宿（`trip-stays`）与租车（`trip-rentals`）

抹 `cost`。其余字段照留 —— 名字、平台、起止时刻、星级、房型、停车、早餐、退改、里程、保险都是别人照着订的公开信息。

### 地点表（`trip-places`）

- `category: homestay`：`coord` 四舍五入到 2 位小数（约 1 公里），删 `en` 与 `note`（`en` 常常就是门牌地址）
- 其他类别原样

### 派生文件

- `geometry.json`：民宿坐标模糊后，以它为端点的路线记录坐标对不上会被整条丢弃（既有规则）→ 公开版那几段画虚线，**不重算**（重算会把模糊后的假端点算成真路）。**2026-09-30 修订**：丢弃发生在**发布时**（`filterGeometry`），不是只在浏览器加载时 —— 记录的键与坐标本身就是门牌和精确位置，原样拷出去等于从旁路再发一遍（实现记录 27）
- `calendar.ics`：公开版**不生成**（订阅是给自己用的）
- 预算：前置块的钱抹掉后，公开版预算页只剩事件散项 —— 这正是「不用写预算」的语义；预算页保留

### UI 连带

`SlotText` 在公开构建下遇缺**不画**（不渲染「待填」虚线框）。票面于是只剩一端的时刻 / 机场 + 乘客标签；住宿 / 租车卡的预算槽同样消失。

---

## 第二节 · 数据与构建

### 1. `visibility` 前置字段

```yaml
visibility: public      # public 进公开版（抹过）；private 只进完整版；缺省 private
```

schema 加枚举字段；`data:check` 读进 `manifest.json`（每条行程带 visibility）；公开构建只收 public。

### 2. `space.md` 个人空间

数据仓库根目录一份：

```yaml
---
name: Harley
handle: harley            # 可选，站点标题 / 页签用
avatar: avatar.jpg        # 相对 space.md 的路径
bio: 一句话简介
links: [{label: 小红书, url: https://…}, {label: GitHub, url: https://…}]
tips:                     # 可选 · 打赏入口；image（二维码，相对路径）/ url 二选一
  - {label: 微信, image: tips/wechat.png}
  - {label: Buy Me a Coffee, url: https://…}
---
自由 Markdown：自我介绍、怎么读这些攻略、免责声明……
```

新的小 schema `SpaceSchema`（zod，住 `@jjj/schema`），解析住 `@jjj/tripmd`（`parseSpace`，frontmatter + 正文）。首页从「行程列表」变成「个人主页」：头像 + 简介 + 链接，下面才是行程卡片。完整版与公开版共用首页，区别只在列出的行程。工具仓库放一份示范 `space.md`。

### 3. 数据目录可配置

环境变量 `JJJ_DATA_DIR`，默认 `apps/web/public/data`（行为不变）。`data:check` / `enrich` / `build` / `publish` 全读它。数据仓库的工作流把 `trips/` 与 `space.md` 指进去。**`TripRepository` 接缝不动** —— 浏览器仍 fetch 同一相对路径，只是构建时复制进去的是哪份数据变了。

### 4. 两种产物

```
pnpm build                # 完整版：全部行程、不抹        → dist/
pnpm build:public       # 公开版：public 行程、过 sanitize → dist-public/
```

`build:public` 先跑 `tools/publish.ts`：过滤 visibility → 每份 plan.md 过 `publicPlan`（sanitize → serialize → 再 parse → 抹净断言，一条链一个函数）→ 写到临时数据目录 → 重生成 manifest → geometry **过滤后**随行（09-30 修订，原定原样拷）→ 不生成 ics → 以该目录构建，并置 `VITE_PUBLIC=1`（控制待填槽不画）。产物与完整版是**同一个 SPA**；公开版 dev 走同一个 `publicPlan`、只答同一组文件。

### 5. 工具仓库自己的数据

- seattle 真行程搬去数据仓库
- 工具仓库留 `_example` / `_demo`，新增 **`_showcase`**：seattle 过完 sanitize 的公开版副本 —— 给 fork 的人看的「真实规模示范」，同时是 sanitize 的回归 fixture。`pnpm showcase:refresh` 从数据目录重生成它，diff 一眼看出抹没抹干净
- 工具仓库自己的 GitHub Pages 从「Harley 的行程站」变成「工具演示站」，发的就是 `_showcase`

### 6. 工作流模板

工具仓库放 `templates/publish.yml`（数据仓库用）：

1. checkout 数据仓库 + `actions/checkout` 拉工具仓库到子目录（钉 tag）
2. `pnpm install`；`JJJ_DATA_DIR` 指向数据仓库的 `trips/`（含 `space.md`）
3. `pnpm data:check`
4. `pnpm build` → `dist-full/`
5. `pnpm build:public` → `dist-public/`
6. `dist-public` → `wrangler pages deploy … --project-name <public>`；`dist` → `wrangler pages deploy … --project-name <full>`（原定公开版走数据仓库的 GitHub Pages，见已拍板表的修订与实现记录 26）

不想要完整站的人删掉第 6 步的后半句即可。

---

## 第三节 · Cloudflare 配置、迁移顺序、验证

### Cloudflare 侧（一次性，Harley 操作，逐条给命令）

1. Pages 项目两个：`wrangler pages project create <public>` 与 `<full>`（直传模式，不连仓库 —— CF 永远拿不到源文件，只拿产物）
2. Zero Trust → Access → 应用（**只给完整站**）：Self-hosted，域名 `<full>.pages.dev` + `*.<full>.pages.dev`；策略 Allow · Emails 含两人邮箱；登录方式只留 One-time PIN；会话 30 天
3. API Token：最小权限 `Account · Cloudflare Pages · Edit`
4. 数据仓库 Secrets：`CLOUDFLARE_API_TOKEN` `CLOUDFLARE_ACCOUNT_ID`；Variables：`CF_PROJECT_PUBLIC` `CF_PROJECT_FULL`

### 迁移顺序（每步之后现有站点都能用，随时可停在中间）

1. **工具仓库先长出能力，数据不动**：`JJJ_DATA_DIR`、`visibility`、`space.md` 解析 + 首页改版、`sanitize` + `tools/publish.ts`、`SlotText` 公开模式、`_showcase`、`templates/publish.yml`。seattle 仍在原位，`pnpm build` 产物与今天一致 → 现有站零变化。绝大部分代码量在这一步
2. **建数据仓库**（私有；站点地址由 Cloudflare 项目名决定，与仓库名无关）：搬 seattle 的 plan.md + geometry.json，写 `space.md`，放工作流。首次推送 → 校验与构建两步绿，部署步等第 3 步
3. **接 Cloudflare**：两个项目 + Access 只挂完整站 → 再推一次 → 公开站与完整站同时上线，手机给完整站验一次验证码
4. **工具仓库收尾**：删 seattle 真行程，Pages 切发 `_showcase`。老地址从此是工具演示站 —— **对外分享从这一步之后开始**，之前分享的老链接会变成演示站
5. **文档与旁路**：CLAUDE.md / HANDOVER / 记忆改指向；编辑模式 spec 里程碑 ③「GitHub 同步」的目标仓库改成数据仓库

### 验证

- `sanitize` 单测：字段全满的 fixture → 断言该抹的每个字段 `undefined`、该留的原样；三类判定（Day 1 / 末日 / 中间）各一条；**负向对照**：故意把 Day 1 判定改错，测试要红
- **抹净断言**：对 `_showcase` 全文扫描，以 seattle 真值为黑名单（票价数字、航班号、门牌、确认号、座位号），一个都不能出现
- `parseSpace` 单测 + roundtrip；`visibility` 进 manifest 的 data:check 断言
- `pnpm build:public` 进 CI；公开版也跑 `check:built`（base 路径变了，地图 worker 的历史坑要重放）
- 截图：公开版首页（个人主页）、抹过的票面（一端时刻 + 乘客标签、无待填）、模糊后的民宿地图针；390px × 双主题

---

## 风险与处置

| 风险 | 处置 |
|---|---|
| 抹漏（新字段加进 schema 却忘了进 sanitize） | sanitize 用**白名单**而非黑名单写：只显式保留的字段能过，新字段默认抹；`_showcase` 黑名单扫描兜底 |
| Day 1 同时有抵达和内部移动 | 已知边界，届时加 `share: keep-both` 覆盖 |
| 民宿模糊后路线丢失 | 设计内降级（虚线），不重算假端点 |
| 数据仓库工作流拉工具仓库的版本漂移 | 钉 tag；升级是数据仓库主动改一行 |
| Access 邮箱验证码在旅途中收不到 | 会话 30 天，出发前在手机上先登一次 |
| 老分享链接在迁移第 4 步后变成演示站 | 第 4 步完成前不对外分享 |

## 纯函数 + 单测清单（铁律）

`sanitize`（tripmd）· `parseSpace`（tripmd）· `publish` 的过滤 / manifest 生成 · 坐标模糊 · `_showcase` 黑名单扫描。每条配负向对照。

## 与编辑模式的关系

编辑模式（`2026-08-21-edit-mode-design.md`）暂缓；本设计先行。两者接缝只有一处：编辑模式里程碑 ③ 的 GitHub 直写目标是**数据仓库**，且写回的是完整版 plan.md —— 公开版永远由发布线派生，编辑器不直接碰它。

## 实现记录（2026-09-09 → 09-18，迁移第 1 步代码完成）

实施计划：`docs/superpowers/plans/2026-09-09-personal-space-sharing.md`（顶部「进度」表是接手入口）。子代理驱动执行，审核抓出的问题与对本 spec 的偏差如下，**以代码为准、以此为解释**：

1. **抹净断言的黑名单从完整版 Trip 现算**（`sensitiveValues`），不写死 seattle 真值 —— 工具仓库公开，真值不能进测试；结构块（```trip-*）里的命中致命，正文命中只警告（正文按设计不抹，附录预算表里出现票价是作者自己的决定）。
2. 没被任何事件引用的长途 → `unreferenced`，只剩 traveler / mode（解析器本来就对它报警告）。单日行程首日 = 末日，按抵达处理。
3. `arr_date` 在抹除时**落成显式值**（`timelineDates` 派生）：出发端抹掉后钟点回卷没了锚点。`dep_date` 按 spec 原文全抹。
4. **民宿地点除 `en` / `note` 外还抹 `url` 与 `gmaps_place_id`**（spec 原文只点了前两个）：房源页与 place id 任何一个都能反查到门口，坐标模糊就白做了。民宿 / 住宿 / 租车都改成逐字段白名单重拼，schema 新增字段默认不发。
5. **残余面（v1 范围外，Harley 需知）**：`trip-constraints` 的 `label` / `note`、事件 `notes` / 正文 / `booking.note`、住宿租车的 `note` / `refund`、`Journey.what`、附录正文都原样进公开版 —— 确认号、门牌写进这些地方就会公开。
6. 合成 fixture（`packages/tripmd/test/fixtures/sanitize-full.md`）一开始混进了真行程的坐标 / 门牌 / 价格，审核抓出后全部换成编造值；规则写在 fixture 上方。
7. `findLeaks` 吃 `lex()` 的 fence token 而不是自己数 ```（lexer 本来就分得清 trip-* 与普通代码块、`~~~`、围栏长度）；金额裸数字派生对千分位逗号友好（`¥11,220` → `11,220` 与 `11220`）。
8. manifest 形状改为 `{trips:[{id, visibility}]}`；浏览器侧兼容旧的字符串数组（缓存里可能还有）。
9. `serialize.ts` 导出 `scalar` / `flowMap` 供 `serializeSpace` 复用；`tools/lib/cli.ts` / `paths.ts` 收敛了三个 CLI 各抄一份的颜色常量与 ROOT。
10. 打赏抽屉的遮罩用 `bg-black/35`（与设置面板同款）而不是 `bg-ink/30` —— `--ink` 深浅翻转，深色模式下会把页面变亮；`aria-modal` + 初始焦点 + 宽屏居中与设置面板一致。
11. `JJJ_DATA_DIR` 的 dev 中间件对解出的路径做目录内校验（`resolve` + `root + sep`）：dev 服务器 `host: true`，端口转发出去就不是只有自己在访问。
12. 工具仓库的示范 `space.md` bio 与旧首页口号一字不差，线上首页只多一枚 GitHub 链接；`_showcase` 第 1 步保持 `_` 前缀（dev-only），第 4 步再改名成不带 `_` 的目录才变成演示站内容。

以下为 09-15 → 09-18（Task 7 复审至 Task 11）：

13. **Task 7 复审补了 5 处计划没点到的作者专用面**：住宿模块缺字段会留悬空标签（改为整格不画）、租车模块 `取 / 还 待填` 是绕过 `SlotText` 的字面字符串、事件标题的「待订」角标（`needs-booking` flag）、flight 事件没写 transport 块时的全待填空骨架、月视图格子里的「N 项待订」、地图右下角「N 个地点缺坐标」chip。判据统一为「给作者的提醒不画」。**「需预订 / 已预订」保留**：前者读者照着订用得上，后者说明这站要提前订、作者订过 —— 留不留待 Harley 拍板。
14. **`trip-constraints` 整块不进公开版**（spec 原文只说「只抹前置块」，没点到它）。`build:public` 第一次实跑就被抹净断言拦下：seattle 的 constraint label 写着两班航班号，note 里是 Global Entry、倒推链、合同截止。这块全站没有任何渲染（backlog 里「露出硬约束」未做），却会原样躺在公开版 plan.md 里被 fetch，白名单无法「部分清洗」自由文本，留着它抹别处就白抹。fixture 补了带班次号与确认号的 constraints 块，去掉修复后 3 条测试变红（负向对照）。将来渲染硬约束时，公开版给不给要重新决定。
15. **单端票面的两处布局 bug**（只有抹除后的数据才暴露，Step 6 截图抓到）：抵达票的目的地机场滑到了出发端位置 —— 被抹那端的 `SlotText` 返回 null 后 `justify-between` 只剩一个子元素；被抹那端还挂着从事件日期派生出来的孤零零日期。修法：`TimeStack` 公开版无时刻就整栈留空但**仍渲染空盒**占位，行 5 两端各包一层 `span`。完整版零变化。
16. **`publicMarkdown(clean, source, label)`** 收进 `tools/lib/stage-public.ts`：serialize → 再 parse 验收 → 抹净断言（结构块命中终止）→ 正文命中提醒，`build:public` 与 `showcase:refresh` 共用一份，不各抄一遍。
17. `_showcase` 标题带「· 公开示范」后缀（计划只改 subtitle）：首页卡片不显示 subtitle，dev 里它和来源的真行程两张卡一模一样。
18. `check:built` 改从产物 manifest 读第一份入册行程（公开版与完整版清单不同，不能写死 seattle）；`findChromium` 补 macOS 的缓存位置与 `.app` 内路径，浏览器层在 Mac 上不再假跳过。另有 Harley 09-14 追加的 `pnpm look`（`tools/look.ts`）：起 dev 并在 Chrome 里按仓库 `git user.email` 选 profile、在当前窗口加标签页、端口被占自动换。
19. **正文残余面的实证**（第 5 条的落地）：seattle 附录「预算」里有一条只出现在正文的机票确认号。黑名单从结构化字段现算，它**不在黑名单里、也不会被抹**，构建成功、没有任何提示。这是数据层面的决定（建议从 plan.md 正文删掉），不是工具能兜的；`PUBLISHING.md` 第三节写了这条和发布前 `grep` 的建议。8 处金额命中都在附录预算表，按设计只警告。

Harley 2026-09-29 看过本地效果后追加三条：

20. **首页头像换成 GitHub 头像**：示范 `space.md` 加 `avatar: avatar.png`（从 GitHub 拉下来存进数据目录，79KB）。顺带让 `dataUrl` 与 `data:check` 放行绝对 URL —— 数据仓库的人想直接指远程头像也行，但公开站上每个访客都会去请求那个地址，本地文件更稳。fork 的人要换掉这张图。
21. **抵达 / 离开事件的正文不进公开版**（第 14 条同一类：spec v1 没点到的面）。截图里「抵达 SEA」卡的票面抹得只剩到达端，卡片正文却原样写着谁几点落地、怎么汇合，「各自起飞」卡写着她经香港几点落浦东 —— 票面抹掉的字段正文全复述了一遍。`sanitize` 对引用了 arrival / departure 长途的事件清空 summary / detail / notes / variants / booking；行程内部移动的照留。fixture 给三张卡补了正文（抵达卡含注意条目与变体），去掉修复后 3 条测试变红。
22. **首页卡片右下角「公开 / 私有」开关** —— 浏览器到 plan.md 的第一条写路径，范围压到最小：`TripRepository.setVisibility?` → dev-only vite 插件 `jjj:visibility`（`POST {base}api/visibility`）→ `setFrontmatterScalar` **只改 frontmatter 一行**（不走 serialize 往返，作者手写的排版一个字节不动；private 是缺省值就删行）→ 再 parse 验收、核对 visibility 真的变了 → 写回。线上静态托管没有端点，方法不存在，卡片退回静态角标；公开版什么都不画。id 只认 slug、路径必须在数据目录里，与 data-dir 中间件同一条边界。真浏览器里点两下往返，`_demo/plan.md` 与 HEAD 字节一致。**它不刷 manifest.json**（data:check 生成，CI 必跑）也**不发布** —— 发布仍是 commit → 推数据仓库 → 工作流。编辑模式里程碑 ③ 的写回将来沿用这条通道的形态（先文本手术、再解析验收）。同时 `_showcase` 从 dev 首页拿掉（和 seattle 两张一样的卡），直链照开。
23. **公开版 dev 必须现抹**。Harley 用 `pnpm look --public` 看到公开版「还显示详细信息」—— 因为 dev 直接把原始 plan.md 喂给浏览器，sanitize 只在 build:public 里跑，所谓公开版 dev 只是「完整数据 + 公开 UI」。新 vite 插件 `jjj:public-data`（仅 `VITE_PUBLIC=1` 时挂）逐请求走同一条 parse → sanitize → serialize 链：manifest 扫目录现算只列 public（首页开关改的是 plan.md，不刷 manifest.json，读文件才不会过期）、非 public 的 plan.md 与 calendar.ics 一律 404、其余文件放行。仓库层公开版 dev 不再追加 `_demo`。验证：manifest 只有 seattle，抹后文本里票价 / 班次 / 座位 / 舱位 / 硬约束为 0，抵达卡正文 0 行。
24. **数据目录在仓库外时的自动刷新 + 数据仓库脚手架**（迁移第 2 步的本地部分）。`JJJ_DATA_DIR` 指到仓库外时 Vite 不监听那个目录，首页开关改了 plan.md 公开版页面不会自己刷；`jjj:data-dir` 插件把目录加进 `server.watcher`，任何文件一动就 `full-reload`，与数据在 `public/data` 时的行为一致。脚手架搭在 `projects/journeys/`（`trips/` + 工作流模板 + README + .gitignore），以它为数据源整条链全绿、开关往返文件字节一致。**建仓库、推送、Pages 设置是 Harley 用个人账号做的事**；另发现 GitHub Pages 从私有仓库发站要付费计划 —— Harley 次日确认是 Free 账号，裁决见第 26 条。

2026-09-30，Harley 要求在下一步之前做一轮整体代码审查（架构清晰、解耦、不留补丁式代码），结果如下：

25. **审查轮：三处「同一件事写了三遍」收敛，一处 200 行的配置文件拆开。**
    - **数据目录的文件层只剩一份**：新增 workspace 包 `@jjj/datadir`（`dataDir` / `tripDirs` / `planPath` / `readTrip` / `readManifestIds` / `insideDir` / `DATA_MIME`，带测试）。此前「哪些目录算行程、plan.md 在哪、边界怎么查、manifest 第一项、JJJ_DATA_DIR 怎么解」在 `tools/check.ts`、`tools/lib/stage-public.ts`、`apps/web/vite.config.ts`、`tools/look.ts`、`tools/check-built.ts` 里各有一份，且已经开始漂（stage-public 不查绝对 URL，check.ts 查）。它是唯一带 `node:fs` 的包，浏览器代码不 import；`@jjj/tripmd` 仍只管文本 ↔ Trip。`tools/lib/paths.ts` 只剩 `ROOT`。名片引用的本地文件名单 `spaceAssets` 与 `isAbsoluteUrl` 进 `@jjj/tripmd`（`data:check` / `stagePublic` / 浏览器 `dataUrl` 三边共用），`_` 前缀规则 `isFixtureId` 也只在 `manifest.ts` 写一次。
    - **vite 插件三合一**：`jjj:data-dir` / `jjj:public-data` / `jjj:visibility` 三个插件（各自一份 `configResolved` 样板、各自一份路径边界检查、靠注册顺序才正确）合成一个 `jjj:data`，搬进 `apps/web/vite/data-plugin.ts`，一个中间件按 URL 分派给三个明确命名的处理函数；`vite.config.ts` 回到 30 行纯配置。开关端点的路径与请求体形状抽成 `apps/web/src/data/visibility-api.ts`，浏览器仓库与插件两头 import 同一份契约，字面量不再各写一遍。
    - **公开版「空槽不画」只在一处判**：原先散在六个组件里、形态各异（`showEmpty`、`cols.filter`、`(x || !PUBLIC_BUILD)`、`terms.filter`、`PUBLIC_BUILD ? undefined : '待填'`）。现在 `lib/public.ts` 一个谓词 `showsField(value)` + 容器用的 `shownTerms(terms)`（纯函数，有测试），`ticket-parts.tsx` 新增 `Field`（标签 + 值一格，缺值时按谓词整格不画），条款行、住宿栏目、房型、票面的托运 / 退改 / 预算全走它。`PUBLIC_BUILD` 只剩「作者待办」那类判断（待订、骨架、缺坐标、日历、开关）。
    - `tools/look.ts` 拆出 `tools/lib/chrome.ts`（找 Chrome、按邮箱选 profile、开标签还是开窗口），look.ts 只管端口、服务器、地址。
    - 解析器返回 `trip === null` 与「有 error 级诊断」等价（`parse.ts` 末尾保证），各处 `!trip || errors.length > 0` 的双重判断收成 `!trip`。
    - 验证：typecheck 四包全过，**28 套件 / 337 测试**，data:check / build / build:public / 两轮 check:built（浏览器层真跑）全绿；四个 dev 服务器（完整 / 公开 × 仓库内 / 仓库外数据）上逐条断言公开 manifest、抹过的 plan.md、ics 与非 public 404、目录越界 404、开关往返字节一致、坏 id / 坏值 / GET 的错误码、公开版页面在开关后 500ms 内自刷；390px 双主题截图核对完整版待填槽照旧、公开版整格消失、单端票面占位不滑。
26. **公开站改发 Cloudflare Pages（方案 A 修订）**。Harley 的个人 GitHub 是 Free 账号：GitHub Pages 只能从公开仓库发，数据仓库里是完整版行程，不能为了 Pages 改公开。于是两份产物各发一个 Cloudflare Pages 直传项目，Access 只挂完整站；`templates/publish.yml` 去掉 Pages 三步与 `pages` / `id-token` 权限，`build:public` 不再传 `--base`（Pages 项目挂根路径），Variables 改为 `CF_PROJECT_PUBLIC` / `CF_PROJECT_FULL`；`PUBLISHING.md` 第一 / 四 / 五 / 六节、脚手架里的工作流与 README 同步。工具仓库自己的 GitHub Pages 继续发演示站。`check:built --public` 仍故意用子路径 base —— 那是 worker 历史坑的重放，不是部署形态。

同日第二轮：Harley 要求「进一步深度优化」，五个方向各起一个独立子代理对抗式审查（抹除关口、vite 插件、UI 等价、新包与 CLI、架构与重复），每条发现都要求给出复现。坐实的问题与处置：

27. **抹除关口的四个洞（隐私）。** ① **geometry.json 原样拷带走了门牌与精确坐标**：路线的键是地点 id，民宿 id 派生自 `en`（就是门牌），记录里还存着算路时的坐标 —— `_showcase/geometry.json` 里两条记录含完整地址，未入 git 但 `git add -A` 就会带进公开仓库。修：`filterGeometry(trip, raw)`（与 `mergeGeometry` 共用同一个 `matchRoutes` 判定），拿**再解析后**的公开版 trip 过滤，民宿那两条自然掉了（seattle 33 → 31）。② **role 按行程首末日判**：首日、末日在家的行程会把去程和返程都判成内部移动、两端全留，家门口机场直接发出去；`findLeaks` 又不收 from / to，拦不住。修：按各长途首次引用日期的**跨度**判（`referencedSpan`），原规则的超集；已拍板表加了修订。③ **黑名单不收硬约束**：值机码、门锁密码写在 constraints 里，整块抹掉了但黑名单里没有，`leaks.test` 那条「硬约束漏了会红」只是碰巧靠 transport 里重复的值才绿。修：`label` / `note` 进黑名单（seattle 上零新增正文噪音），测试改成用只出现在硬约束里的值。④ **抵达 / 离开卡后面那段路的 `to_next` label / note 没清**（「到达层走到 Link 站」「ORCA 刷闸机」在 trip-event 围栏里）。修：一并清，路本身（方式、时长）照留。
28. **公开版 dev 的四个洞（插件）。** ① **非规范路径绕过抹除**：`//`、`/./`、`%2e` 不匹配那条正则就落到原文件，`seattle-2026-10//plan.md` 拿到 43KB 全量、`//calendar.ics` 拿到订阅源 —— 正是实现记录 23 那个坑的第二次。② **坏的百分号转义打死 dev 进程**：`decodeURIComponent` 在 async 中间件里抛 URIError，Node 24 上是未处理的 rejection。③ **开关端点没有 CSRF 防护**：`text/plain` 的 POST 是简单请求不走预检，作者浏览任何网页时那页都能把私有行程翻成公开。④ 写回非原子、`closeBundle` 原样拷 `.git` / `.env` / 符号链接、绝对 `--outDir` 拼错。修法一并：插件拆成 `vite/data-routes.ts`（不碰 http 对象的路由函数，可直接单测）+ `data-plugin.ts`（适配）；所有路径**先 normalize 再 insideDir 再谈是什么**；公开版改**白名单**（manifest / plan.md / 过滤后的 geometry / space.md / 名片引用的文件，其余 404，与 `stagePublic` 落盘的集合逐项对应），规则链走同一个 `publicPlan`（构建会失败的在 dev 回 500）；同源 + `application/json` 校验；写临时文件再改名；拷贝跳过 dotfiles、解符号链接；`resolve(cfg.root, outDir)`；中间件整体兜底回 500。dev 的 manifest 两种模式都现算，浏览器里 `_demo` 的硬编码删了（数据仓库下每次开首页都 404 一次）。
29. **构建在 CI 上根本跑不起来。** 新插件让 `vite.config.ts` 间接 import 三个入口是 `.ts` 的 workspace 包，Vite 把它们原样外置，只有 Node ≥ 22.18 能原生执行；两份工作流钉的是 Node 20（本机 `--no-experimental-strip-types` 复现 `ERR_UNKNOWN_FILE_EXTENSION`）。修：两份工作流与脚手架钉 Node 24，加 `.nvmrc` 与 `engines`。
30. **其余。** `@jjj/datadir`：数据目录不存在抛可读错而非 ENOENT 堆栈、悬空链接与目录形态的 plan.md 不再 abort、`insideDir` 按真实路径比（目录内指向外面的符号链接）、去掉未用的依赖、测试进 tsconfig。UI：`slots.bag === null` 的交通方式（网约车、步行）写了 `baggage` 会被静默丢掉（本轮重构引入）、行 5 的占位 span 让 `truncate` 失效（长站名撑破三行对齐，上一轮引入）—— 两处修了并用合成数据截图核对。`TripRepository` 长出 `assetUrl`，`lib/data-url.ts` 删掉（组件自己拼 `data/` 前缀绕开了唯一接缝）；`saveTrip?` 空桩删掉；`tools/lib/chrome.ts` 的警告恢复黄色；`check-built` 的 MIME 表基于 `DATA_MIME`。新增测试：`data-routes.test.ts`（路由、写路径、CSRF）、`stage-public.test.ts`（收哪些、拷哪些、geometry 过滤到门牌不出现）、`public.test.ts`、`boundary.test.ts`（浏览器代码不许 import node）、datadir 恶意形态、sanitize 居家日 / leg、leaks 硬约束。基线 **32 套件 / 359 测试**。审查里判为「不改」的：`serializeSpace` 只有测试用（它是 space.md 格式幂等性的契约，编辑模式要用，留）；两张 MIME 表已合；`showsField` 第二参数只有测试传（可测性缝，可接受）。
31. **官方 `/code-review` 复审（2026-09-30，Harley 装上 Anthropic 的 code-review 与 pr-review-toolkit 插件后要求再查一遍）。** 十条发现，七条坐实并修，两条是小事一起改，一条换了修法。**最重的两条是上一轮修复本身的缝**：① 实现记录 27 的「按引用日期跨度判 role」把住宿、租车的 `detail:` 引用也算进了跨度 —— 去程前一天在机场旁取车，去程就被判成内部移动，出发机场与时刻原样发出（合成数据复现）。修：跨度只收长途。② 实现记录 28 的「先规范化再判断」只做在 `{base}data/` 之后那一段，前缀本身是在原始 URL 上比的 —— `/%64ata/seattle-2026-10/plan.md` 不匹配前缀、落给 vite 自己的静态服务，它再解码一次，公开版 dev 发出了未抹的 plan.md、订阅日历和 `_demo`（真服务器复现）。修：整条路径先解码规范化、再比前缀；分派逻辑（`dataRoute`）挪进可测的 `data-routes.ts`，插件只剩适配。其余：离开卡**之前**那段路（去机场、还车）的 label / note 没清，只清了卡后面的（离开的接驳在卡前）；公开版 dev 仍挂着写端点；行程 id 拼路径时没过 `insideDir`，数据目录里指到外面的符号链接会被列出、读取，甚至被开关**写出去**（`@jjj/datadir` 改为 `planFile` / `tripDirs` 全部按真实路径检查，`planPath` 删掉）；`space.md` 的资源路径不校验，`../me.png` 过了 data:check、暂存时拷到数据目录外，`./avatar.png` 构建照发而 dev 白名单比不上（改为解析时规范化并拒绝越界）；`geometry.json` / `space.md` 的读取在三处各写一份（收进 `readGeometry` 三态 / `readSpace`）。**换了修法的**：审查建议硬约束只收 note 不收 label（label 是自由文本，与地点同名会在别的结构块里误报致命）；改为硬约束的值单独成名单 `constraintValues`，只在 `trip-constraints` 围栏里致命、正文里提醒、别的围栏不查 —— 误报没了，「sanitize 忘了丢整块」仍然会被拦。小事：公开请求先匹配行程路径再读名片；`_broken` 过滤是死代码删掉。每条修复都做了负向对照（故意改回旧行为，对应测试变红）。`_showcase` 重生成**零差异**：这轮规则修订对 seattle 的实际数据没有影响。基线 **32 套件 / 369 测试**。
32. **四条裁决落地（2026-09-30，Harley）。** ① 正文残余：删掉附录·预算里的机票确认号；Global Entry 四处全删（她没有，硬约束 note、接机卡正文、出发前清单都写错了），工具仓库与数据仓库脚手架两份同步。② 硬约束整块不发：维持现状，写进已拍板表。③ **「已预订」「需预订」也不进公开版**（此前只藏「待订」）：做在数据层而不是界面层 —— `sanitize` 对每个事件去掉 `booking` 块与 `needs-booking` 标记，公开版 plan.md 里再没有任何预订信息，`booking.note` 这个残余面也随之消失；界面上原来为「待订」写的三处 `PUBLIC_BUILD` 分支（事件角标、月视图待订数、首页「N 项待订」）成了死代码，删掉，净删除。fixture 加了一张已订（带截止与备注）、一张待订的内部事件，负向对照会红。④ 长途判定采纳新规则。`_showcase` 重生成：14 行差异，全是预订块、确认号与 Global Entry 的消失。基线 **32 套件 / 370 测试**。
33. **回归：完整版 dev 首页又出现了两张西雅图（Harley 2026-09-30 指出）。** 实现记录 28 让 dev 服务器现算 manifest 时把所有示范目录都列上了首页，`_showcase`（和 seattle 是同一趟）与 `_example` 跟着上去 —— 这推翻了 09-29 的明确要求「完整版首页不要两个西雅图」，而且截图里看得见却没当成问题。修：`data-routes.ts` 里一张 `DEV_HOME_FIXTURES = ['_demo']` 表，完整版 dev 首页 = 入册的真行程 + 表里的示范，与审查轮之前的行为一致（当时浏览器里硬编码追加 `_demo`）；`_showcase` 直链照样能开。教训：审查轮的「去掉硬编码」把一条产品决定一起去掉了 —— 收敛代码时要对照用户拍过板的行为清单，不只对照代码。

