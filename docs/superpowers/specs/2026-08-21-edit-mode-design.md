# 编辑模式 · 实施计划

## Context

just-j-journey 目前是纯只读站点：浏览器 fetch plan.md 现场解析，五个视图全部只消费。写入阀门 `applyPatch`（apply → serialize → re-parse，解析器唯一校验）早已在 `packages/tripmd/src/patch.ts:82` 就绪并有测试，但**全仓零调用点**；`TripRepository.saveTrip?` 是未实现的桩。

Harley 要的完整产品是三条入口汇进同一条编辑管线：

1. **手工微调**已有行程（改事件、增删、排序、补坐标、改地点）；
2. **agent 微调**：页面内对话（直调 Anthropic API），agent 提案 → **预览审核 → 用户通过才生效**，用户手改优先级更高；
3. **从零对话搭建**新行程 + **导入外来非标准 md** 由 agent 转成标准 TripMD 后继续微调。

编辑**立即生效**（本地草稿层），**不手动提交 md**（应用用 GitHub PAT 直接 commit 到仓库，Pages 自动部署）。

### 已拍板的决定（勿再议）

| 决定 | 内容 |
|---|---|
| 写回 | v1 单用户自部署：PAT 存 localStorage，应用直 commit main；**同步层抽 `SyncBackend` 接口**，将来开源多用户换真后端，草稿/预览/审核交互不动 |
| 规范化 | 「转标准格式」是**导入时刻的显式一步**，不是保存副作用。系统内文件天生规范。仓库现有手写 plan.md 先跑一次纯规范化提交（工具产出 diff，Harley 过目后自己提交） |
| LLM | Anthropic 先行（浏览器直调，key 存本地，设置里配），**抽 provider 接口**留给别家；默认模型 claude-sonnet-5，可换 |
| v1 编辑范围 | 事件小改（时间/标题/cost/notes/待订/flags）+ 地点信息/坐标 + 增删事件/改顺序。日历拖拽后置 |
| 里程碑顺序 | ① op 面补全 → ② 草稿层+手工编辑 UI → ③ GitHub 同步 → ④ agent 微调面板 → ⑤ 导入转化+从零搭建。每站独立可上线 |

### 仓库约定（执行时必守）

- Harley 不让代跑 git 写操作 —— 每个里程碑结束给 pasteable commit 命令（英文单行，大块拆分需在 cp -a 临时副本验每块独立编译+测试）。
- UI 文案/注释中文；组件只消费主题令牌（禁 `dark:`、禁组件级 `@media prefers-color-scheme`、禁内联单套色）；CSS 注释禁 `*/` 字样。
- 布局/逻辑数学进 lib 纯函数 + 单测（负向对照：故意改错公式确认测试会红）；组件只画。
- 每里程碑收尾全套关口：`pnpm typecheck && pnpm test && pnpm data:check && pnpm build` + Playwright 截图（390px + 深浅主题）；动了地图加 `pnpm check:built`。
- 「不打补丁要深度整合」：能收敛的先收敛（本轮要收编 useTripOverrides 旁路、SettingsSheet 抽壳）。

## 总体数据流

```
UI 表单 / agent 提案(审核后) ──→ TripPatchOp[] ──→ applyPatch（唯一阀门）
     从零/导入(审核后) ────────→ 整份 markdown ──→ parse 验收 ─┘
        → markdown → 草稿层 localStorage jjj:draft:<tripId>（立即生效的载体）
        → repository parsed Map + react-query 双缓存（saveTrip 是唯一写点）
        → SyncBackend（GitHub 适配器）debounce 推送 → Pages 部署
        → getTrip 发现远端文本追平草稿 → 自动清草稿
```

草稿不是第二真相，是「plan.md 的下一版在部署途中的暂存」。远端追平即清除。

---

## 里程碑 ①：op 面补全（纯库层，零 UI 影响）

改 `packages/schema/src/patch.ts`、`packages/tripmd/src/patch.ts`、`packages/tripmd/src/diagnostics.ts`、`packages/tripmd/test/patch.test.ts`。TDD：每条先写失败测试。

1. **`update_event` 加宽**（UpdateEventFieldsSchema 追加，沿用「null 清除 / 缺省不动」约定）：
   - `notes?: string[]`（整组替换，`[]` 清空）
   - `booking?: {status, deadline?, note?} | null`（serialize 已支持写回，patch 直接赋值）
   - `flags?: FlagKey[]`（整组替换）
2. **新 op `update_place`**：`{op, placeId, fields: {name?, nameEn?|null, coord?: {lat,lng}|null, tentative?, url?|null, note?|null}}`。
   - coord 用 **`{lat,lng}` 对象**而非数组（作者格式 lat,lng、CoordSchema 是 [lng,lat]，数组必被填反，对 agent 尤甚）；applyPatch 内转 `[lng,lat]`。geo 派生量 re-parse 自动变 `authored`，零特判。
3. **新 op `update_trip`**：`{op, fields: {title?, subtitle?|null, destination?, timezone?, travelers?|null, currency?|null}}`。**不含 dates**（牵动所有 trip-day，明确拒绝，不进 schema）。v1 UI 只用 title（收编改名）。
4. **PatchResult 扩展**：
   - `Diagnostic` 加可选 `opIndex?: number`；`opError`（patch.ts:61）带上索引 —— 表单才能把错误定位到输入框。
   - 返回 `idMap: Record<string,string>`（旧 id→新 id，仅含变化者）。实现按位置 zip：serialize 前的 clone 与 re-parse 后的 trip 天数/每日事件数一一对应，不复制 id 公式。
   - schema 顶部注释写明**批内引用限制**：ops 只能引用批前已存在的 id（新增事件批内不可被后续 op 引用）。
5. **测试**：每个新 op 成功/目标缺失(带 opIndex)/null 清除/应用后 markdown 再 parse 语义幂等；add/move 后 idMap 完整性（同天后续全漂、跨天两天都漂）；`ops: []` 短路；roundtrip 不回归。

验收：全套关口（data:check/build 应零行为变化）。

## 里程碑 ②：草稿层 + 保存管线 + 手工编辑 UI

**②-0 规范化预提交**：新建 `tools/normalize.ts <dir>`（parse → serialize → 写回，落盘前 re-parse 验收，风格对齐 `tools/enrich.ts --apply`）。对 seattle 与 `_example`/`_demo` 各跑一次，diff 给 Harley 逐行过目后他自己提交。此后仓库内文件即规范格式。

**②-1 数据层**：
- 新 `apps/web/src/data/drafts.ts`：localStorage `jjj:draft:<tripId>`，形状 `{markdown, prevMarkdown: string|null, baseRemoteSha: string|null, savedAt}`。门面 read/write/clear/list + subscribe（`lib/settings.ts` 同款 try/catch；跨标签 storage 事件 + 同标签自定义事件）。`list()` 为 ⑤ 的「本地新行程」预留。
- `TripRepository.saveTrip` 转正，签名 **`saveTrip(id, markdown): Promise<Trip>`**（阀门产物就是 markdown，收 Trip 会绕开阀门再 serialize 一遍）。
- `MarkdownTripRepository`（apps/web/src/data/MarkdownTripRepository.ts）：
  - `getTrip`：草稿优先（parse 草稿；防御性：error 级诊断 → 丢草稿回退远端 + console.error）→ mergeGeometry 照旧。**追平清理**：后台 fetch 远端 plan.md，文本 === 草稿 → clearDraft + invalidate（部署窗口期草稿自然兜底）。
  - `saveTrip`：parse → mergeGeometry → 替换 parsed Map 条目 → writeDraft → 返回 trip。**双缓存唯一写点**。
- 新 `apps/web/src/data/useSaveTrip.ts`（UI 与 agent 共用管线）：取缓存 trip → applyPatch → `!ok` 返回 diagnostics（不落盘）→ `remapFavorites(id, idMap)`（useFavorites 新导出纯函数：读→映射→写→广播）→ `repo.saveTrip` → `setQueryData(['trip',id])` + `invalidateQueries(['trips'])` → 通知同步调度器（本里程碑为桩）→ 返回 `{ok, warnings}`。
- **撤销**：toast「撤销」payload = `{markdown: prevMarkdown, favorites: 保存前快照}`（收藏重映射不可逆，须整组快照），撤销 = saveTrip(prev) + 恢复收藏。
- **收编 useTripOverrides**：删 `useTripOverrides.ts`；HomePage TitleEditor 改走 `update_trip {title}` 管线；挂载时一次性迁移 `jjj:overrides`（逐条 getTrip → title 不同则 applyPatch 落草稿 → 删条目，幂等）。

**②-2 UI 原语**（`apps/web/src/components/`，最小四件）：
- `Sheet.tsx`：createPortal + focus trap + Esc/遮罩关 + aria-modal；手机底部滑出、≥sm 居中。**SettingsSheet（features/trip-list/SettingsSheet.tsx:96-316）迁移上来**，净删其自有容器。
- `fields.tsx`：TextField / TextAreaField / SelectField（label + 错误行）。
- `ConfirmDialog.tsx`：基于 Sheet 的两键确认。
- `Toast.tsx` + useToast：成功/警告/错误 + 可选动作键（撤销），aria-live，Provider 挂 main.tsx。

**②-3 编辑入口**：
- TripPage 头部铅笔钮进编辑态（useState + EditModeContext，不持久化）。
- DayTimeline 卡片动作簇（DayTimeline.tsx:202-209）编辑态追加：编辑 / 删除（ConfirmDialog → remove_event）/ 上移下移（move_event，首末禁用；`lib/edit/reorder.ts` 纯函数算 afterEventId + 单测）。
- 每天末尾「+ 添加事件」→ 新增表单（afterEventId = 当天末事件；插中间靠上移下移调）。
- `features/itinerary/EventEditorSheet.tsx` 字段映射：日期(Select trip.days→变了追加 move_event) / 时间(TextField，**不做前端格式校验** —— 保存失败诊断按 opIndex 映射回字段) / 标题 / 类别(Select+CategoryChip) / 地点名(清空=null 摘除) / 费用 costRaw / 摘要 / 注意事项(TextArea 每行一条→notes) / 预订(Select 无·待订·已订 + deadline + note→booking，表单不重复暴露 needs-booking flag) / 标记(复选 tentative·optional·warning→flags)。提交经 `lib/edit/eventForm.ts` 纯函数 `diffEventForm(event, values): TripPatchOp[]`（只含改动；空=不保存）+ 单测。
- **地图补坐标**（依赖本里程碑管线，可与 ③ 并行）：缺坐标 chip 列表（MapView.tsx:513-534）li 改 button **全时可点** → 选点模式（新 `features/map/PickCoordinate.tsx`：横幅提示 + crosshair + 临时 marker + 底部确认条）→ `update_place {coord}`（`lib/edit/coord.ts` roundCoord 5 位小数 + 单测）→ 缺坐标列表自动缩短。PlaceCard 编辑态加「重新选点 / 编辑地点」（Sheet → update_place）。toast 提醒「相关路线退直线，跑 pnpm enrich 可恢复」。

验收：全套关口 + 截图（编辑态列表、Sheet、选点模式 × 390px × 双主题）+ `pnpm check:built`（动了地图）；手测草稿：改→刷新仍在→删草稿回远端版。

## 里程碑 ③：GitHub 自动同步

- `lib/settings.ts` 加 `github: {pat, repo /*默认 HelloworldHarley/just-j-journey*/, branch /*默认 main*/} | null` 与 `anthropicKey/model`（⑤ 用，一次动完形状）。SettingsSheet 加「同步」区（PAT 用 password input，文案：fine-grained、仅此仓库、仅 Contents 读写）。
- **`SyncBackend` 接口**（`apps/web/src/data/sync.ts`）：`fetchRemote(tripId) → {sha, markdown} | null` / `push(tripId, markdown, baseSha) → {sha}`。**唯一实现 `GithubSyncBackend`**（`data/github.ts`）：Contents API GET/PUT（`Bearer PAT`、`application/vnd.github+json`），路径 `apps/web/public/data/<id>/plan.md`，commit message `edit: <tripId> via web`。纯函数半区（单测）：`contentsUrl` / `encodeBase64Utf8`+decode（中文 emoji 往返）/ `decideSync({draftMd, remoteMd, remoteSha, baseRemoteSha}) → 'clean'|'push'|'conflict'`。
- `data/useSync.ts`：模块级单例调度器 + hook 读状态。状态机 per trip：`localOnly → pending(debounce 5s 合并连续保存) → pushing → pushed(等部署) → clean`，旁路 `conflict/error`。409/422 → 重取 sha 重判一次。`window 'online'` 重试 + 手动「立即推送」。
- **冲突 UI**：TripPage 顶部横幅两键 ——「以本地为准覆盖推送」/「丢弃本地草稿」。
- **状态指示**：TripPage 头部 chip（仅本地·灰 / 待推送·琥珀 / 推送中 / 部署中「约 1-2 分钟」/ 已同步·绿短暂 / 冲突失败·红）；HomePage 草稿卡片角标。
- 降级：无 PAT/离线 → 停在草稿层，指示「仅本地」并引导设置。派生文件零处理（calendar.ics CI 重生成；geometry 自动降级虚线）。

验收：全套关口 + github.ts 纯函数单测 + 真机全链路（编辑→commit 出现→部署→草稿自动清除）。

## 里程碑 ④：agent 微调面板（对话改现有行程）

- 依赖 `pnpm add --filter @jjj/web @anthropic-ai/sdk`（装完重跑 `pnpm install`），随 lazy chunk 加载。
- **`LlmProvider` 接口**（`lib/agent/provider.ts`）：`stream(messages, tools) → 事件流`。唯一实现 `AnthropicProvider`（`dangerouslyAllowBrowser: true`，SDK 自动带 CORS 头；model 从 settings 读，默认 claude-sonnet-5）。
- **提示词**（`lib/agent/prompt.ts` 纯函数 + 单测）：system = 角色 + TripMD 语义要点 + op 限制（批内禁引新增 id；保存后 id 漂移，一次一批）+ 收藏事件清单（「用户亲自标记，未经要求不得删/移」）。user = 当前 markdown（草稿优先）+ **id 对照表**（`lib/agent/idTable.ts` 纯函数：markdown 里没有 id，必须附「Day1 #1 <id> 08:30 标题」+ place id 表）+ 用户指令。
- **tool `propose_patch`** `{summary, ops}`：input_schema 为**手写 JSON Schema 常量**（`lib/agent/patch-json-schema.ts`，zod v3 无 toJSONSchema；配同步测试内省 zod shape 逐项比对钉住双份一致）。不强制 tool_choice；无 tool_use 的回复按聊天文本显示。
- **三道闸**（`features/agent/AgentPanel.tsx`）：① `z.array(TripPatchOpSchema).safeParse`（该 schema 首次获得运行时调用点；失败以 tool_result is_error 回传让模型自修一次）→ ② dry-run applyPatch 不落盘（失败同样回传重试一次）→ ③ 预览 UI：结构化摘要为主（`lib/edit/describeOps.ts` 纯函数：op→中文人话，update 列「字段：旧→新」+ 单测）+ 折叠行级 diff（`lib/diff.ts` 自实现 LCS + 单测，不引依赖）+ warning 列表。
- **通过** → 应用时刻**再 dry-run 最新 trip**（预览期间用户可能手改，id 已漂 → locate 失败即「提案过期，请重新生成」）→ 走同一 useSaveTrip 管线。**用户优先 = agent 永远叠加在最新状态、过期作废，结构上不存在反向覆盖。** 拒绝 → tool_result「用户已拒绝：<理由>」，会话内继续调整。
- 面板挂 TripPage（侧栏/Sheet，390px 底部滑出）。key 未配 → 面板内引导去设置。

验收：全套关口 + 手测提案→审核→应用→推送全链路 + 三条失败路径（无 key / 坏 ops / 过期提案）。

## 里程碑 ⑤：导入转化 + 从零对话搭建

- **agent 加第二个 tool `propose_plan`** `{summary, markdown}`（整份 plan.md）：用于从零生成与大重构。闸门同构：parse 验收（error 即 is_error 回传自修，最多 2 次）→ 预览（行程摘要卡：天数/事件数/警告 + 折叠 markdown）→ 通过 → `repo.saveTrip(id, markdown)` 同一管线。
- **新建行程向导**（HomePage「+ 新建」）：最小表单（id slug 校验纯函数 + 单测 / 标题 / 起止日期 / 目的地 / 时区）→ 生成骨架 markdown（serialize 最小 Trip）→ 存草稿 → 进 TripPage 编辑态 + agent 面板（从零对话即在此行程上 propose_patch/propose_plan）。
- **导入向导**（HomePage「导入」）：粘贴文本或上传 .md → 若直接 parse 通过 → 预览即收；否则喂 agent（system 用 `docs/AUTHORING_PROMPT.md` 精编版 + 原文）→ propose_plan 闸门 → 预览确认 → 成为本地草稿行程。
- **本地新行程的存在感**：`listTrips` 合并 manifest 行程 + `drafts.list()` 中 manifest 没有的（HomePage 标「本地草稿」）；`getTrip` 对 manifest 外 id 先查草稿再 404。**推送新行程** = PUT 不带 sha（GitHub 创建文件）；部署后 CI data:check 自动把它写进 manifest.json，本地草稿追平后清除，列表自然转正。
- AUTHORING_PROMPT 改动需保持「骨架示例经真解析器零警告」（HANDOVER 明确要求）。

验收：全套关口 + 手测三链路（从零建→对话搭→推送转正；导入非标准 md→转化→微调；导入已标准 md 直收）。

---

## 风险与处置

| 风险 | 处置 |
|---|---|
| 事件 id 漂移（add/remove/move 后同天后续全换） | PatchResult.idMap 重映射收藏（+撤销快照）；agent 提案跨保存即过期重生成；ics UID 漂移是既有已知行为 |
| PAT / API key 明文 localStorage | 用户拍板；文案强制引导 fine-grained 单仓 Contents；设置里可一键清除 |
| 双缓存不一致 | saveTrip 是 parsed Map + react-query 的唯一写点，无第二写路径 |
| Pages 部署窗口回退 | 草稿仅在远端文本追平后清除，窗口期读草稿 |
| serialize 规范化 | 已重定义为导入时刻的显式动作；存量文件走 ②-0 一次性规范化提交（Harley 过目 diff） |
| 多标签同 trip 双开 | storage 事件同步，后写覆盖（单用户接受，注释注明） |
| agent 写坏数据 | 三道闸（zod → dry-run → 人审），应用时刻再验一次；解析器永远是最后一道 |

## 纯函数 + 单测清单（铁律）

tripmd patch 新 op/idMap · `lib/edit/eventForm.ts` · `lib/edit/reorder.ts` · `lib/edit/coord.ts` · `lib/edit/describeOps.ts` · `lib/diff.ts` · `data/github.ts` 纯函数半区 · `lib/agent/prompt.ts` · `lib/agent/idTable.ts` · `lib/agent/patch-json-schema.ts` · slug 校验。每条配负向对照。

## 全局验收

每里程碑：`pnpm typecheck && pnpm test && pnpm data:check && pnpm build`（触地图加 `pnpm check:built`）+ Playwright 截图 390px × 双主题肉眼核对 + 该站的手测链路；结束更新 CLAUDE.md / HANDOVER / TRIPMD_SPEC 相应段落，并给 Harley pasteable 的分块 commit 命令（临时副本验前缀）。
