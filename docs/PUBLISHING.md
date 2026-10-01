# 发布：个人空间与公开分享

工具（这个仓库）、你的私人数据、给别人看的公开数据是三个面。这份文档讲怎么把它们切开发布：
两份产物各发到一个 Cloudflare Pages 项目 —— 公开版谁都能看，完整版用 Cloudflare Access 挡在前面。
设计与每一处偏差的理由见 `docs/superpowers/specs/2026-09-09-personal-space-sharing-design.md`。

## 一、三个面

| 面 | 住在哪 | 含什么 | 谁能看 |
|---|---|---|---|
| 工具 | 本仓库（公开，可 fork） | 代码；示范数据 `_example` / `_demo` / `_showcase`；示范 `space.md` | 所有人 |
| 私人数据 | 你的数据仓库（私有） | `trips/space.md`（+ 头像、二维码）、`trips/<id>/plan.md`（+ `geometry.json`）、一个工作流 | 只有你 |
| 公开站 | Cloudflare Pages（项目 A，不挂 Access） | `visibility: public` 的行程，**过 sanitize** | 所有人 |
| 完整站 | Cloudflare Pages（项目 B）+ Access | 全部行程，不抹 | Access 名单里的邮箱 |

数据仓库不含代码：工作流每次拉工具仓库的一个 tag 来构建，升级工具 = 改一行 tag。
两个 Pages 项目都是 wrangler **直传**，Cloudflare 只拿产物、拿不到源文件，数据仓库保持私有。
GitHub Pages 不参与：Free 账号只能给**公开**仓库开 Pages，而数据仓库里是完整版行程 —— 不能为了 Pages 把它改公开。
工具仓库自己的 GitHub Pages 继续发演示站（迁移第 4 步之后发的是 `_showcase`）。

## 二、本地怎么跑

```bash
JJJ_DATA_DIR=../journeys/trips pnpm look --both          # 完整版 + 公开版并排开在 Chrome 里（dev，HMR；公开版那份逐请求现抹、只列 public 行程，看到的就是要发出去的）
JJJ_DATA_DIR=../journeys/trips pnpm data:check           # 校验 plan.md / space.md，刷新 manifest.json，生成 calendar.ics
JJJ_DATA_DIR=../journeys/trips pnpm build                # 完整版 → apps/web/dist
JJJ_DATA_DIR=../journeys/trips pnpm build:public         # 公开版 → apps/web/dist-public；暂存目录 apps/web/.public-data 可直接翻
JJJ_DATA_DIR=../journeys/trips pnpm check:built --public # 公开版产物的地图关口（故意用子路径 base 重放 worker 的历史坑；Cloudflare 上挂根路径，更简单）
```

不设 `JJJ_DATA_DIR` 就用仓库自带的 `apps/web/public/data`。`pnpm enrich <dir>` 也读它。

### `visibility`

frontmatter 一行：`visibility: public` 进公开版（抹过）；`private` 或不写只进完整版。拼错的值按 private 处理并警告 —— 忘了写不会把私事发出去。

本地 dev 的首页上，每张行程卡右下角有一枚「公开 / 私有」开关：点一下就改那份 plan.md 的这一行（只动这一行，其余一个字节不动），标成公开的行程下次 `build:public` 就上架、自动抹敏感信息。它只在 dev 服务器上有 —— 线上是静态托管，没有写路径，那里只画一枚静态角标。改完照常 commit、推数据仓库，工作流才会把它发出去。

### `space.md`

数据目录根下一份，frontmatter 是名片，正文是自由 Markdown。没有这份文件首页显示工具默认头部。

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | 是 | 名片名字 |
| `handle` | 否 | 显示成 @handle |
| `avatar` | 否 | 头像，相对 space.md 的路径 |
| `bio` | 否 | 一句话简介 |
| `links` | 否 | `{label, url}` 列表 → 名片上的链接 chip |
| `tips` | 否 | 打赏入口：`{label, image}` 二维码图片 或 `{label, url}` 链接，**二选一**；有一项就长出「☕ 打赏」按钮，点开底部抽屉；公开版与完整版都显示 |

`data:check` 会检查 `avatar` 与 `tips[].image` 指向的文件真的在数据目录里，否则线上是一张裂图。本地路径必须相对数据目录：`./avatar.png` 会被规范成 `avatar.png`，以 `/` 开头或带 `..` 的会被警告并忽略。

## 三、抹除规则速查

只抹**前置块**；事件卡、正文、附录、事件散项 `cost` 一字不动。

| 块 | 规则 |
|---|---|
| 长途 `trip-transports` | 按**首次引用落在哪一天**判：各长途（只看长途，住宿租车的引用不算）首次引用日期里**最早**的那天 = 抵达，只留 `to` / `arr_time` / `arr_date`；**最晚**的那天 = 离开，只留 `from` / `dep_time`；中间 = 行程内部移动，两端全留；没被任何事件引用只留 `traveler` / `mode`。看的是引用日期的跨度而不是行程首末日 —— 首日在家收拾、末日在家歇着的写法很常见，按首末日判会把去程和返程都当成内部移动，家门口的机场就发出去了。承运、班次、票价、舱位、座位、行李、退改、中转、分段、备注、记录级 `cost` 全抹 |
| 住宿 `trip-stays` / 租车 `trip-rentals` | 只抹 `cost`，其余照留（逐字段白名单重拼，schema 新加的字段默认不发） |
| 地点 `trip-places` | `category: homestay` 坐标四舍五入到两位小数（约 1 公里），删 `en` / `note` / `url` / `gmaps_place_id`（任何一个都能反查到门口）；其他类别是公开商业地址，原样 |
| 硬约束 `trip-constraints` | **整块不进公开版**：它全站没有任何渲染，却会随 plan.md 发出去，而 label / note 里常写着班次号、确认号、倒推链 |
| 抵达 / 离开事件的正文 | 引用了抵达或离开长途的事件，其摘要、全文、注意条目、变体、预订块**全清**，挨着它的两段路（进来的与出去的，`to_next` / `from_stay`）的 `label` / `note` 也清 —— 这两张卡讲的是作者自己的接驳（谁几点落地、经哪里回、走到哪个站刷什么卡、几点前还车），票面抹了它们却在正文里复述。抵达的接驳在卡后、离开的在卡前，所以两边都清。行程内部移动的事件正文与路照留 |
| 预订信息 | 每个事件的 `booking` 块（需预订 / 已预订 / 截止 / 备注）与 `needs-booking` 标记（待订）**全去** —— 那是你自己的订票进度，不是攻略。去在数据层，公开版的 plan.md 被人直接下载也看不到。你写在注意条目或正文里的「已订 16:00 场」这类话不归这条管，照发 |
| `calendar.ics` | 公开版不生成，资料页也没有订阅入口 |
| `geometry.json` | **过滤后**随行、不重算：只留公开版 trip 真会用上的记录。路线的键是地点 id、而地点 id 派生自英文名 —— 民宿的英文名往往就是门牌，记录里还存着算路时的精确坐标；原样拷等于从旁路把 plan.md 里抹掉的东西再发一遍。民宿那几段对不上就被丢掉，公开版画虚线。别对抹除后的数据跑 `pnpm enrich` —— 会把假端点算成一条真路 |
| 公开构建的 UI（`VITE_PUBLIC=1`） | 不画「待填」槽（连标签图标一起消失）、不画航班空骨架、不挂缺坐标 chip、不给日历入口 |

### 怎么读 `build:public` 的输出

- `✓ <id> 已抹除`：正常。
- `⚠ <id> 第 N 行正文出现「…」`：正文里出现了和完整版票价 / 班次号 / 座位号 / 民宿门牌相同的字样。正文**按设计不抹** —— 附录预算表里写票价是作者自己的决定。行号是公开版 `apps/web/.public-data/<id>/plan.md` 里的，打开看一眼是不是你想公开的。
- 直接失败、写着「公开版结构块里仍有敏感值」：`sanitize` 漏了字段，是**工具的 bug**，回 `packages/tripmd/src/sanitize.ts` 补白名单，不要改数据绕过去。

### 扫描器看不到的东西

抹净断言的黑名单从完整版的**结构化字段**现算（票价、班次、座位、预订金额、长途备注、民宿的 en / note / 坐标）。只写在正文里的东西 —— 确认号、门牌、私人备注 —— 它不知道，也不会抹。事件的 `notes` / 正文、住宿租车的 `note` / `refund`、`Journey.what`、附录正文都原样进公开版。

**把确认号、门牌这类东西写进这些地方，公开版就有。** 发布前 `grep -n '确认号\|门牌' apps/web/.public-data/<id>/plan.md` 一遍是值得的。

另外两条工具管不到的：frontmatter 原样进公开版（`subtitle` 里写了票价就发了）；地点的模糊只认 `category: homestay` —— Airbnb 标成了 `hotel` 就按公开商业地址原样发，分类是你自己标的。

`pnpm look --public` 走的是和 `build:public` **同一条**规则链（抹除 → 再解析 → 抹净断言），只答构建会落盘的那几种文件，其余 404；构建会失败的行程在 dev 里回 500 —— dev 里看着对的，发出去就是对的。

## 四、建数据仓库（迁移第 2 步）

本地已经搭好一份脚手架：`projects/journeys/`，和工具仓库并排。`trips/` 里是当前的 `space.md`、头像、seattle 行程与路网，`.github/workflows/publish.yml` 是模板的拷贝，`README.md` 写了布局与预览命令。用它跑过整条链：`JJJ_DATA_DIR=../journeys/trips` 下 `data:check` / `build` / `build:public` / `check:built --public` 全绿，首页开关改它的 plan.md 时公开版页面半秒内自己刷新。

1. **工具仓库先提交、打 tag、推上去**，数据仓库钉这个版本：

   ```bash
   git tag v0.2.0 && git push origin main v0.2.0
   ```

2. 在 GitHub 新建**私有**空仓库（不要初始化 README）。仓库名随意 —— 站点地址由 Cloudflare 项目名决定，与仓库名无关。
3. 脚手架的布局（已就位）：

   ```
   trips/
     space.md                 # 改成你自己的 name / handle / bio / links —— 现在还是工具的示范文案
     avatar.png
     manifest.json            # data:check 生成，提交它
     seattle-2026-10/
       plan.md
       geometry.json
   .github/workflows/publish.yml
   README.md  .gitignore      # calendar.ics 被忽略
   ```

4. 打开 `.github/workflows/publish.yml`，确认 `JJJ_TOOL_REF` 与第 1 步的 tag 一致。不要完整站就删掉最后那一步。
5. 首次推送（这个仓库用**个人**账号的身份，别让全局的工作账号签进去）：

   ```bash
   cd ../journeys
   git init -b main
   git config user.name "Harley Tang" && git config user.email cntanghengyi@gmail.com
   git add -A && git commit -m "data: personal space and the seattle trip"
   git remote add origin git@github.com:<user>/journeys.git
   git push -u origin main
   ```

   这一次 Actions 会在部署那一步失败（Cloudflare 的 Secrets 还没配）—— 正常，前面的校验与构建两步已经替你把数据过了一遍关。第五节配完再推一次或手动 Run workflow。

## 五、Cloudflare 五步（迁移第 3 步）

```bash
npx wrangler login
npx wrangler pages project create <public>  --production-branch main   # 公开站，如 journeys
npx wrangler pages project create <full>    --production-branch main   # 完整站，如 journeys-full
```

1. 建的都是**直传**项目，不连仓库 —— Cloudflare 永远拿不到源文件，只拿产物。项目名就是地址：`https://<public>.pages.dev` 与 `https://<full>.pages.dev`。
2. **只给完整站**挂 Access：Zero Trust → Access → Applications → Add an application → Self-hosted：Application domain 填 `<full>.pages.dev`，再加一条 `*.<full>.pages.dev` 盖住预览域；Policy：Allow · Include · Emails（两人邮箱）；Authentication → 只留 One-time PIN；Session duration 30 天。公开站什么都不挂。
3. API Token：My Profile → API Tokens → Create Token → Custom → 权限只给 `Account · Cloudflare Pages · Edit`。
4. 数据仓库 Settings → Secrets and variables → Actions：Secrets `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`；Variables `CF_PROJECT_PUBLIC=<public>`、`CF_PROJECT_FULL=<full>`。
5. 再推一次 main（或 Actions → Run workflow）→ 两个站同时上线。手机浏览器给完整站登一次验证码 —— 会话 30 天，出发前先登。

`*.pages.dev` 的预览域每次部署都会多一个 `<hash>.<project>.pages.dev`；公开站无所谓，完整站靠第 2 步那条通配规则一并挡住。

## 六、迁移顺序与回退点

每一步之后现有站点都能用，随时可以停在中间。

| 步 | 做什么 | 验什么 | 停在这里意味着 |
|---|---|---|---|
| 1 | 工具仓库长出能力（`visibility`、`space.md`、`JJJ_DATA_DIR`、`sanitize`、`build:public`、`_showcase`、模板） | 全套关口 + `build:public` + `check:built --public` | 现有站零变化；真行程仍在工具仓库 |
| 2 | 建数据仓库：搬 `plan.md` + `geometry.json`、写 `space.md`、放工作流（第四节） | Actions 里校验与构建两步绿（部署那步等第 3 步） | 数据有了家，还没有站；老站照旧 |
| 3 | Cloudflare 五步（第五节） | 公开站首页是名片、行程是抹过的；完整站要登录，登录后全量 | 两个站都有了 |
| 4 | 工具仓库删掉真行程；`_showcase` 改名成不带 `_` 的目录（frontmatter `id` 同步改），工具仓库的 Pages 变成演示站 | 老地址显示示范行程 | **对外分享从这一步之后开始** —— 之前发出去的老链接会变成演示站 |
| 5 | 文档与旁路：CLAUDE.md / HANDOVER / 记忆改指向；编辑模式 spec 里程碑 ③ 的写回目标改成数据仓库 | — | 收尾 |

`_showcase` 的重生成：`pnpm showcase:refresh <dir>`（`<dir>` 在 `JJJ_DATA_DIR` 里，产物永远写进工具仓库自己的 `apps/web/public/data/_showcase`）。重跑后 `git diff` 一眼看出抹没抹干净。

## 七、验证清单

公开站：

- [ ] 首页是名片 + 行程卡；没有「N 项待订」，没有「公开」角标
- [ ] 抵达票只剩到达端、返程票只剩出发端，没有虚线「待填」框；这两张卡没有正文和注意条目
- [ ] 住宿 / 租车卡无金额
- [ ] 地图上民宿针落在约 1 公里格点，进出民宿那几段是虚线
- [ ] 资料页没有日历 chip；直链 `data/<id>/calendar.ics` 404
- [ ] `data/<id>/plan.md` 里没有 `trip-constraints` 块、没有 `price:` / `number:` / `seat:`

完整站：

- [ ] 打开先到 Access 登录页；登录后全部行程、待填槽照旧
