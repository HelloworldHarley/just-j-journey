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
| 托管形态 | **方案 A**：一份数据两条发布线。公开版 → 数据仓库自己的 GitHub Pages；完整版 → Cloudflare Pages + Cloudflare Access（One-time PIN 邮箱登录，免费档） |
| 代码 / 数据边界 | 工具仓库只带 `_example` / `_demo` / `_showcase` 示范数据；真实行程 + `space.md` 住私有数据仓库；数据仓库不含代码，只有 Markdown、geometry 缓存和一个工作流 |
| 抹除范围（v1） | 只抹**前置块**（长途 / 住宿 / 租车）里的敏感信息；事件卡、正文、附录、事件散项 cost 一字不动 |
| 长途抹法 | 按**天**判定：Day 1 首次引用 = 抵达（只留到达端）、末日 = 离开（只留出发端）、中间日 = 行程内部移动（两端全留）；其余字段全抹 |
| 住宿 / 租车抹法 | 只抹 `cost`；名字、平台、起止、房型、停车、早餐、退改、里程、保险照留 |
| 民宿地点 | `homestay` 类地点公开版坐标模糊到约 1 公里、去掉 `en` / `note`；`hotel` 是公开商业地址照留 |
| 待填槽 | 公开版**不画**「待填」—— 那是给作者的提醒，抹掉的字段直接不渲染 |
| visibility | 只有 `public` / `private` 两档，默认 `private`；不做 `unlisted` |
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

- `geometry.json`：民宿坐标模糊后，以它为端点的路线记录坐标对不上会被整条丢弃（既有规则）→ 公开版那几段画虚线，**不重算**（重算会把模糊后的假端点算成真路）
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

`build:public` 先跑 `tools/publish.ts`：过滤 visibility → 每份 plan.md 过 sanitize → 写到临时数据目录 → 重生成 manifest → geometry 原样拷（丢弃由运行时规则处理）→ 不生成 ics → 以该目录构建，并置 `VITE_PUBLIC=1`（控制待填槽不画）。产物与完整版是**同一个 SPA**。

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
6. `dist-public` → 数据仓库自己的 GitHub Pages（`upload-pages-artifact` + `deploy-pages`，与现有工作流同款）；`dist-full` → `wrangler pages deploy dist-full --project-name <name>`

不想要完整站的人删掉第 6 步的后半句即可。

---

## 第三节 · Cloudflare 配置、迁移顺序、验证

### Cloudflare 侧（一次性，Harley 操作，逐条给命令）

1. Pages 项目：`wrangler pages project create <name>`（直传模式，不连仓库 —— CF 永远拿不到源文件，只拿产物）
2. Zero Trust → Access → 应用：Self-hosted，域名 `<name>.pages.dev`；策略 Allow · Emails 含两人邮箱；登录方式只留 One-time PIN；会话 30 天
3. API Token：最小权限 `Account · Cloudflare Pages · Edit`
4. 数据仓库 Secrets：`CLOUDFLARE_API_TOKEN` `CLOUDFLARE_ACCOUNT_ID`

### 迁移顺序（每步之后现有站点都能用，随时可停在中间）

1. **工具仓库先长出能力，数据不动**：`JJJ_DATA_DIR`、`visibility`、`space.md` 解析 + 首页改版、`sanitize` + `tools/publish.ts`、`SlotText` 公开模式、`_showcase`、`templates/publish.yml`。seattle 仍在原位，`pnpm build` 产物与今天一致 → 现有站零变化。绝大部分代码量在这一步
2. **建数据仓库**（私有；仓库名即公开站 URL 段，如 `journeys` → `helloworldharley.github.io/journeys`）：搬 seattle 的 plan.md + geometry.json，写 `space.md`，放工作流。首次推送 → 公开版上线，与老站并存
3. **接 Cloudflare**：四步配置 → 工作流末步生效 → 完整版上线，手机验一次验证码
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

## 实现记录（2026-09-09 → 09-11，迁移第 1 步做到 Task 6 / 11，暂停）

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
