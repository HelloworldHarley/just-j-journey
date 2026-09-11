# 个人空间与分享 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让工具仓库长出「代码 / 私人数据 / 公开数据」三面切开所需的全部能力：`visibility` 前置字段、`space.md` 个人空间、可配置数据目录、构建期 `sanitize` 与 `pnpm build:public`、公开构建下的 UI 连带、`_showcase` 示范数据、数据仓库用的工作流模板与发布文档。

**Architecture:** 抹除是 `@jjj/tripmd` 里的纯函数 `sanitize(trip): Trip`（白名单写法），链路 parse → sanitize → serialize → 再 parse 验收，解析器仍是唯一校验器；公开版由 `tools/publish.ts` 把 public 行程抹完写进临时数据目录，再以 `JJJ_DATA_DIR` 指向它、`VITE_PUBLIC=1` 跑同一份 vite build —— 产物与完整版是同一个 SPA。`TripRepository` 接缝不动，浏览器仍 fetch 同一相对路径；数据目录由一个 vite 插件在 dev 时代答、build 时整份拷进 `dist/data`。

**Tech Stack:** pnpm workspace · zod（`@jjj/schema`）· `@jjj/tripmd`（yaml）· Vite 6 + React 19 + Tailwind v4 · tsx 脚本 · vitest · GitHub Actions · Cloudflare Pages（wrangler 直传）+ Access

**Spec:** `docs/superpowers/specs/2026-09-09-personal-space-sharing-design.md`（本计划只覆盖 spec 迁移顺序的**第 1 步**「工具仓库先长出能力，数据不动」，外加第 2/3 步要用的模板与文档；第 2–5 步是 Harley 在数据仓库 / Cloudflare 侧的操作，见 Task 10 的 `docs/PUBLISHING.md`）

## 进度（2026-09-11 暂停，半成品已提交）

执行方式：子代理驱动（每个 Task 一个新鲜实现者 + 独立审核 + 修复轮复审），全部在 main 工作树上未提交地进行，最后一次性以 `wip:` commit 提交。开发环境从公用 EC2 迁到 Harley 本地，**下一个 agent 从这里接**：

| Task | 状态 | 备注 |
|---|---|---|
| 1 `visibility` | ✅ 过审 | 顺手给 frontmatter 加了键检查；`map-scene.test.ts` 的 Trip 字面量补了 `visibility` |
| 2 manifest + `PUBLIC_BUILD` | ✅ 过审 | manifest 形状 `{trips:[{id,visibility}]}`，浏览器兼容旧字符串数组 |
| 3 `space.md` + 名片 + 打赏 | ✅ 过审（1 轮修复） | 打赏是 Harley 追加的需求：`tips` 列表 → 「☕ 打赏」chip → 底部抽屉；修复：遮罩改 `bg-black/35`（`bg-ink/30` 深色下会发亮）、`aria-modal` + 初始焦点、宽屏居中、唯一 key |
| 4 `JJJ_DATA_DIR` + tools/lib | ✅ 过审（1 轮修复） | 修复：dev 中间件加目录边界检查（`resolve` + `root + sep`），dev 服务器是 `host: true` |
| 5 `sanitize` | ✅ 过审（1 轮修复） | 修复：fixture 里混进的真行程值全部换成编造值；民宿 / 住宿 / 租车改逐字段白名单，民宿还抹 `url` / `gmaps_place_id`；`dep_date` 全抹；补了空断言与 unreferenced 用例 |
| 6 `findLeaks` | ✅ 过审（1 轮修复） | 修复：吃 `lex()` 的 fence token 而不是手数 ```；金额千分位逗号友好 |
| 7 公开构建 UI | ⚠️ **代码已改、未过审** | `ticket-parts.tsx` / `TransportTimeline.tsx` / `InfoView.tsx` 三处改动在树里，typecheck/test/build 全绿；子代理在截图验证时被叫停，**没有审核报告**。接手先按 Task 7 Step 4 做一遍 `VITE_PUBLIC=1` 的视觉核对，再走一次审核 |
| 8 `build:public` | ⬜ 未开始 | brief 里的代码可直接用 |
| 9 `_showcase` | ⬜ 未开始 | 依赖 8（seattle 标 `visibility: public` 也在 8） |
| 10 CI + 模板 + `PUBLISHING.md` | ⬜ 未开始 | |
| 11 文档收尾 + 全套关口 | ⬜ 未开始 | spec 的实现记录已先写了一版（见 spec 末尾），Task 11 时补齐 |

测试基线：开始 20 套 / 280 → 现在 **25 套 / 313**，全绿；`pnpm data:check` 多出 `✓ space.md`；`pnpm build` 绿。

执行时对计划的偏差与裁决全部写进了 spec 的「实现记录」一节（本地 `.superpowers/` 工作目录是 gitignored 的，不随仓库走）。**接手时的注意事项**：Task 8/9 的 brief 引用的 fixture 值以 `packages/tripmd/test/fixtures/sanitize-full.md` 现状为准；Task 9 把 `patch.test.ts` 换到 `_showcase` 前先确认它没有断言 seattle 前置块里的真值；在公用机器上起 dev / preview 服务器验证完**必须关掉端口**（本地开发不受此限）。

## Global Constraints

- **不代跑 git 写操作**（add/commit/push/checkout 一律不跑）。每个 Task 末尾把可粘贴的 commit 命令交给 Harley；他已表态「分享功能做好了再提交」，所以命令给到即可，是否立刻跑由他定。只读 git 随便用。
- 对话、UI 文案、代码注释**中文**；commit 信息**英文单行** `feature|fix|refactor|docs|chore: description`。
- 布局与逻辑进纯函数 + 单测，组件只画；每条新纯函数配**负向对照**（故意改坏公式，测试要红，再改回）。
- 全套关口：`pnpm typecheck && pnpm test && pnpm data:check && pnpm build`；看 `pnpm test` 输出要同时看 `Test Files` 行（当前基线 **20 suites / 280 tests**，套件收集失败时 `Tests N passed` 照样是绿的）。碰 UI 的 Task 再加 Playwright 截图：390px 手机宽 + 深浅两套主题。
- 主题：只消费切换令牌（`.tint-*`、`--t-*`、`text-ink/graphite/soft`、`bg-paper/raised/sunken`、`var(--hairline)`），不写组件级 `@media (prefers-color-scheme)`，不用 `dark:`，不内联单套色值。
- **CSS 注释里不能出现 `*/`**。
- 深度整合不打补丁：加东西前先看有没有该收敛的重复。
- 抹除规则用**白名单**：只有显式抄过去的字段能进公开版，schema 新增字段默认被抹。
- 公开版 **不生成 / 不提供** `calendar.ics`；**不重算** geometry（民宿坐标模糊后对不上的段按既有规则回退虚线）。
- 工具仓库是公开的：**任何真值（票价、航班号、门牌、确认号、座位号）都不能写进测试或代码**。抹净断言的黑名单必须从完整版 Trip 现算。
- Playwright：`playwright-core` 在 scratchpad 里临时装（不进 package.json），Chromium 在 `~/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome`；主题用 `addInitScript` 写 `localStorage['jjj:settings']`。
- 新地点坐标一律查 Nominatim / Overpass，不手猜（本计划不新增地点，记着即可）。

---

## 文件结构

**新建**

| 文件 | 职责 |
|---|---|
| `packages/schema/src/space.ts` | `SpaceSchema` / `SpaceLinkSchema` + 类型 |
| `packages/tripmd/src/space.ts` | `parseSpace` / `serializeSpace` / `SPACE_KEYS` |
| `packages/tripmd/src/manifest.ts` | `Manifest` 形状、`buildManifest` / `publicEntries` / `manifestIds` |
| `packages/tripmd/src/sanitize.ts` | `sanitize` / `transportRole` / `blurCoord` / `sanitizeTransport` |
| `packages/tripmd/src/leaks.ts` | `sensitiveValues` / `findLeaks` |
| `packages/tripmd/test/fixtures/sanitize-full.md` | 字段全满的合成 fixture（不含任何真值） |
| `packages/tripmd/test/{visibility,space,manifest,sanitize,leaks}.test.ts` | 对应单测 |
| `tools/lib/cli.ts` | 终端颜色 + `die`（三个工具各自复制的那份收敛到这里） |
| `tools/lib/paths.ts` | `ROOT` / `dataDir()`（读 `JJJ_DATA_DIR`） |
| `tools/lib/stage-public.ts` | `stagePublic(src, stage)`：过滤 → sanitize → 验收 → 抹净断言 → 写临时数据目录 |
| `tools/publish.ts` | `pnpm build:public` CLI |
| `tools/showcase.ts` | `pnpm showcase:refresh <dir>` CLI |
| `apps/web/src/lib/public.ts` | `PUBLIC_BUILD` 常量（唯一读 `VITE_PUBLIC` 的地方） |
| `apps/web/src/features/trip-list/SpaceHeader.tsx` | 首页头部：头像 / 名字 / 简介 / 链接 / 打赏按钮 / 正文 |
| `apps/web/src/features/trip-list/TipsSheet.tsx` | 打赏抽屉：二维码横排 + 链接按钮 |
| `apps/web/src/lib/data-url.ts` | `dataUrl(rel)`：数据目录相对路径 → 浏览器 URL |
| `apps/web/public/data/space.md` | 工具仓库自带的示范个人空间 |
| `apps/web/public/data/_showcase/{plan.md,geometry.json}` | seattle 抹除后的公开版副本（由 `showcase:refresh` 生成，入库） |
| `templates/publish.yml` | 数据仓库用的 GitHub Actions 工作流 |
| `docs/PUBLISHING.md` | 数据仓库布局、Cloudflare 四步、迁移顺序、验证 |

**修改**

| 文件 | 改什么 |
|---|---|
| `packages/schema/src/trip.ts` | `VISIBILITIES` / `Visibility`；`TripSchema.visibility`；`TripSummarySchema` 带 `visibility` |
| `packages/schema/src/index.ts` | 导出 `space.ts` |
| `packages/tripmd/src/read.ts` | `FRONTMATTER_KEYS` |
| `packages/tripmd/src/parse.ts` | frontmatter 键检查 + `visibility` 读取 |
| `packages/tripmd/src/serialize.ts` | 写 `visibility`；导出 `scalar` / `flowMap` 供 `space.ts` 复用 |
| `packages/tripmd/src/summary.ts` | 摘要带 `visibility` |
| `packages/tripmd/src/index.ts` | 导出新模块 |
| `packages/tripmd/test/roundtrip.test.ts` | FIXTURES 加 `_showcase` |
| `packages/tripmd/test/patch.test.ts` | fixture 从 `seattle-2026-10` 换成 `_showcase`（第 4 步删 seattle 时测试不受影响） |
| `tools/check.ts` | 用 `dataDir()` / `cli.ts`；manifest 新形状；校验 `space.md` |
| `tools/enrich.ts` | 用 `dataDir()` / `cli.ts` |
| `tools/check-built.ts` | 用 `cli.ts`；`--public`；浏览器层的行程 id 从产物 manifest 读 |
| `apps/web/vite.config.ts` | `dataDirPlugin` |
| `apps/web/src/data/TripRepository.ts` | `getSpace()` |
| `apps/web/src/data/MarkdownTripRepository.ts` | `manifestIds`；`getSpace`；dev 列表加 `_showcase` |
| `apps/web/src/data/hooks.ts` | `useSpace` |
| `apps/web/src/features/trip-list/HomePage.tsx` | 换 `SpaceHeader`；「公开」角标；公开构建下藏「待订」 |
| `apps/web/src/features/itinerary/ticket-parts.tsx` | `SlotText` / `TermsRow` 公开构建下不画待填 |
| `apps/web/src/features/itinerary/TransportTimeline.tsx` | 公开构建下空槽位整格不画 |
| `apps/web/src/features/reference/InfoView.tsx` | 公开构建下不渲染 `CalendarExport` |
| `apps/web/public/data/seattle-2026-10/plan.md` | 加 `visibility: public`（一行） |
| `package.json` | `build:public` / `showcase:refresh` 脚本 |
| `.gitignore` | `dist-public/` / `.public-data/` |
| `.github/workflows/deploy.yml` | `build:public` 与 `check:built` 进 CI（只作关口，本仓库仍发完整版） |
| `docs/TRIPMD_SPEC.md` / `docs/AUTHORING_PROMPT.md` / `CLAUDE.md` / `docs/HANDOVER.md` / spec 文件 | 文档 |

---

### Task 1: `visibility` 前置字段

**Files:**
- Modify: `packages/schema/src/trip.ts`
- Modify: `packages/tripmd/src/read.ts:138`（`TRANSPORT_KEYS` 之后加一行）
- Modify: `packages/tripmd/src/parse.ts:43-62`
- Modify: `packages/tripmd/src/serialize.ts:57-70`
- Modify: `packages/tripmd/src/summary.ts:34-51`
- Test: `packages/tripmd/test/visibility.test.ts`

**Interfaces:**
- Produces: `VISIBILITIES: readonly ['public','private']`、`type Visibility`；`Trip.visibility: Visibility`（缺省 `'private'`）；`TripSummary.visibility`；`FRONTMATTER_KEYS`。

- [ ] **Step 1: 写失败测试**

```ts
// packages/tripmd/test/visibility.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from '../src/parse.ts'
import { serialize } from '../src/serialize.ts'

/**
 * visibility：public 进公开版（抹过），private 只进完整版，缺省 private。
 * 拼错的值不能静默变成 public —— 那是把私事发出去。
 */
const md = readFileSync(join(__dirname, '../../../apps/web/public/data/_example/plan.md'), 'utf8')
/** 在 frontmatter 末尾追加一行 */
const withFm = (extra: string) => md.replace('currency: JPY\n', `currency: JPY\n${extra}\n`)

describe('visibility', () => {
  it('缺省 private，摘要里也带着', () => {
    const { trip } = parse(md)
    expect(trip!.visibility).toBe('private')
  })

  it('public 读进来，serialize 写回去', () => {
    const { trip, diagnostics } = parse(withFm('visibility: public'))
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(trip!.visibility).toBe('public')
    expect(serialize(trip!)).toMatch(/^visibility: public$/m)
  })

  it('private 是缺省值，serialize 不写它（二次往返字节稳定）', () => {
    const { trip } = parse(withFm('visibility: private'))
    expect(trip!.visibility).toBe('private')
    expect(serialize(trip!)).not.toMatch(/^visibility:/m)
  })

  it('拼错的值按 private 处理并警告，绝不静默变 public', () => {
    const { trip, diagnostics } = parse(withFm('visibility: pubilc'))
    expect(trip!.visibility).toBe('private')
    const w = diagnostics.find((d) => d.message.includes('visibility'))
    expect(w?.severity).toBe('warning')
    expect(w?.hint).toContain('public / private')
  })

  it('frontmatter 里认不出的键要警告（拼错的 visibilty 不能悄悄消失）', () => {
    const { diagnostics } = parse(withFm('visibilty: public'))
    const w = diagnostics.find((d) => d.message.includes('visibilty'))
    expect(w?.severity).toBe('warning')
    expect(w?.hint).toContain('visibility')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run packages/tripmd/test/visibility.test.ts`
Expected: FAIL —— `trip.visibility` 是 `undefined`，serialize 不含 `visibility:`。

- [ ] **Step 3: schema**

在 `packages/schema/src/trip.ts` 的 `TripSchema` 之前加：

```ts
/**
 * 行程对外可见性。public 进公开版（经 sanitize 抹除后发到个人空间站），
 * private 只进完整版；缺省 private —— 忘了写不会把私事发出去。不做 unlisted。
 */
export const VISIBILITIES = ['public', 'private'] as const
export type Visibility = (typeof VISIBILITIES)[number]
```

`TripSchema` 里 `currency` 之后加：

```ts
  visibility: z.enum(VISIBILITIES).default('private'),
```

`TripSummarySchema.pick({...})` 里加 `visibility: true,`（首页要画「公开」角标）。

- [ ] **Step 4: read.ts 白名单**

`packages/tripmd/src/read.ts` 末尾加：

```ts
export const FRONTMATTER_KEYS = ['id', 'title', 'subtitle', 'destination', 'timezone', 'start', 'end', 'travelers', 'currency', 'visibility'] as const
```

- [ ] **Step 5: parse.ts**

import 里加 `FRONTMATTER_KEYS, checkKeys`（从 `./read.ts`）与 `VISIBILITIES, type Visibility`（从 `@jjj/schema`）。`const meta = …` 之后、`required` 检查之前加：

```ts
  checkKeys(bag, meta, FRONTMATTER_KEYS, fm.line, 'frontmatter')
```

`ctx` 之前加：

```ts
  // 拼错的 visibility 不能兜成 public —— 那是把私事发出去；按 private 处理并大声说
  const visRaw = str(meta['visibility'])
  let visibility: Visibility = 'private'
  if (visRaw) {
    if ((VISIBILITIES as readonly string[]).includes(visRaw)) visibility = visRaw as Visibility
    else bag.warn(fm.line, `frontmatter 的 visibility "${visRaw}" 无效，按 private 处理`, `可选值：${VISIBILITIES.join(' / ')}`)
  }
```

`const trip: Trip = {…}` 里 `currency: str(meta['currency']),` 之后加 `visibility,`。

- [ ] **Step 6: serialize.ts / summary.ts**

`frontmatter()` 里 `currency` 那行之后：

```ts
  // 缺省值不写：规范形态不留默认值歧义，二次往返字节稳定
  if (trip.visibility !== 'private') L.push(`visibility: ${trip.visibility}`)
```

`summarize()` 返回对象加 `visibility: trip.visibility,`。

- [ ] **Step 7: 跑测试与类型检查**

Run: `pnpm vitest run packages/tripmd/test/visibility.test.ts && pnpm typecheck`
Expected: 5 passed；typecheck 绿。若 typecheck 报某处 `Trip` 字面量缺 `visibility`（目前全仓没有手写完整 `Trip` 字面量的测试，理论上不会），在那处补 `visibility: 'private'`。

Run: `pnpm test`
Expected: `Test Files 21 passed`，roundtrip 三份 fixture 仍绿。

- [ ] **Step 8: 交 commit 命令**

```bash
git add packages/schema/src/trip.ts packages/tripmd/src/read.ts packages/tripmd/src/parse.ts packages/tripmd/src/serialize.ts packages/tripmd/src/summary.ts packages/tripmd/test/visibility.test.ts
git commit -m "feature: visibility frontmatter field, frontmatter key check"
```

---

### Task 2: manifest 新形状 + `PUBLIC_BUILD` 常量 + 首页「公开」角标

**Files:**
- Create: `packages/tripmd/src/manifest.ts`
- Create: `apps/web/src/lib/public.ts`
- Modify: `packages/tripmd/src/index.ts`
- Modify: `tools/check.ts:45-46, 92, 129-133`
- Modify: `apps/web/src/data/MarkdownTripRepository.ts:18-21`
- Modify: `apps/web/src/features/trip-list/HomePage.tsx:167-182`
- Test: `packages/tripmd/test/manifest.test.ts`

**Interfaces:**
- Consumes: `Visibility`（Task 1）。
- Produces: `interface ManifestEntry { id: string; visibility: Visibility }`、`interface Manifest { trips: ManifestEntry[] }`、`buildManifest(entries): Manifest`、`publicEntries(entries): ManifestEntry[]`、`manifestIds(raw: unknown): string[]`；`PUBLIC_BUILD: boolean`。

- [ ] **Step 1: 写失败测试**

```ts
// packages/tripmd/test/manifest.test.ts
import { describe, expect, it } from 'vitest'
import { buildManifest, manifestIds, publicEntries } from '../src/manifest.ts'

const entries = [
  { id: 'seattle-2026-10', visibility: 'public' as const },
  { id: 'tokyo-2027-01', visibility: 'private' as const },
  { id: '_demo', visibility: 'public' as const },
]

describe('manifest', () => {
  it('_ 前缀目录不入册，其余带着 visibility', () => {
    expect(buildManifest(entries)).toEqual({
      trips: [
        { id: 'seattle-2026-10', visibility: 'public' },
        { id: 'tokyo-2027-01', visibility: 'private' },
      ],
    })
  })

  it('公开版只收 public，且 _ 前缀照样排除', () => {
    expect(publicEntries(entries).map((e) => e.id)).toEqual(['seattle-2026-10'])
  })

  it('浏览器读 id：新形状与旧的字符串数组都认，垃圾跳过', () => {
    expect(manifestIds({ trips: [{ id: 'a', visibility: 'public' }, 'b', 42, { nope: 1 }] })).toEqual(['a', 'b'])
    expect(manifestIds({})).toEqual([])
    expect(manifestIds(null)).toEqual([])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run packages/tripmd/test/manifest.test.ts`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 实现 manifest.ts**

```ts
// packages/tripmd/src/manifest.ts
import type { Visibility } from '@jjj/schema'

/**
 * manifest.json —— 首页需要知道有哪些行程，publish 需要知道哪些是 public。
 * data:check 生成，浏览器与 tools/publish.ts 消费，形状只在这里定义一次。
 */
export interface ManifestEntry {
  id: string
  visibility: Visibility
}

export interface Manifest {
  trips: ManifestEntry[]
}

/** `_` 前缀目录是仓库自带的示范 / 负向样本，不入册（CI 部署前也会把它们从 dist 删掉） */
export function buildManifest(entries: readonly ManifestEntry[]): Manifest {
  return {
    trips: entries
      .filter((e) => !e.id.startsWith('_'))
      .map((e) => ({ id: e.id, visibility: e.visibility })),
  }
}

/** 公开版收的那些：入册且 public */
export function publicEntries(entries: readonly ManifestEntry[]): ManifestEntry[] {
  return buildManifest(entries).trips.filter((e) => e.visibility === 'public')
}

/**
 * 浏览器侧读 id。容忍旧形状（纯字符串数组）—— 浏览器缓存里可能还躺着上一版产物的 manifest；
 * 认不出的项跳过，绝不让首页因为一份 manifest 直接白屏。
 */
export function manifestIds(raw: unknown): string[] {
  const trips = (raw as { trips?: unknown } | null)?.trips
  if (!Array.isArray(trips)) return []
  return trips.flatMap((t): string[] => {
    if (typeof t === 'string') return [t]
    const id = (t as { id?: unknown } | null)?.id
    return typeof id === 'string' ? [id] : []
  })
}
```

`packages/tripmd/src/index.ts` 加：

```ts
export { buildManifest, manifestIds, publicEntries, type Manifest, type ManifestEntry } from './manifest.ts'
```

- [ ] **Step 4: check.ts 写新形状**

`tools/check.ts`：import 加 `buildManifest, type ManifestEntry`；`const manifest: string[] = []` → `const manifest: ManifestEntry[] = []`；第 92 行 `if (!dir.startsWith('_')) manifest.push(dir)` → `manifest.push({ id: dir, visibility: trip.visibility })`（过滤交给 buildManifest）；写文件那行改为：

```ts
  const doc = buildManifest(manifest)
  writeFileSync(join(DATA, 'manifest.json'), JSON.stringify(doc, null, 2) + '\n')
  console.log(dim(`\nmanifest.json ← [${doc.trips.map((t) => `${t.id}${t.visibility === 'public' ? ' (public)' : ''}`).join(', ')}]`))
```

- [ ] **Step 5: 浏览器侧**

`apps/web/src/lib/public.ts`：

```ts
/**
 * 公开构建（`pnpm build:public`，VITE_PUBLIC=1）—— 给别人看的版本。
 * 缺的字段不画「待填」、不画待订数、不提供日历订阅：那些都是给作者的提醒。
 * 全站只在这里读环境变量，组件只认这个布尔值。
 */
export const PUBLIC_BUILD = import.meta.env['VITE_PUBLIC'] === '1'
```

`MarkdownTripRepository.ts`：import 加 `manifestIds`；第 21 行改为 `const ids = manifestIds(await res.json())`。

`HomePage.tsx`：import `PUBLIC_BUILD`；`bookingCount` 角标包一层 `!PUBLIC_BUILD &&`，其后加公开角标：

```tsx
          {!PUBLIC_BUILD && trip.visibility === 'public' && (
            <span
              className="rounded-full border border-[var(--hairline)] px-2 py-[1.5px] text-[11px] text-graphite"
              title="visibility: public —— 会出现在公开版个人空间里"
            >
              公开
            </span>
          )}
```

- [ ] **Step 6: 跑关口**

Run: `pnpm vitest run packages/tripmd/test/manifest.test.ts && pnpm typecheck && pnpm data:check && git diff --stat apps/web/public/data/manifest.json`
Expected: 3 passed；typecheck 绿；manifest.json 变成 `{"trips":[{"id":"seattle-2026-10","visibility":"private"}]}`。`pnpm dev` 打开首页仍列出 seattle，无「公开」角标（它还是 private）。

- [ ] **Step 7: 交 commit 命令**

```bash
git add packages/tripmd/src/manifest.ts packages/tripmd/src/index.ts packages/tripmd/test/manifest.test.ts tools/check.ts apps/web/src/lib/public.ts apps/web/src/data/MarkdownTripRepository.ts apps/web/src/features/trip-list/HomePage.tsx apps/web/public/data/manifest.json
git commit -m "feature: manifest entries carry visibility, PUBLIC_BUILD switch, public badge on the home page"
```

---

### Task 3: `space.md` 个人空间 —— schema、解析、仓库、首页

**Files:**
- Create: `packages/schema/src/space.ts`
- Create: `packages/tripmd/src/space.ts`
- Create: `apps/web/src/features/trip-list/SpaceHeader.tsx`
- Create: `apps/web/src/features/trip-list/TipsSheet.tsx`
- Create: `apps/web/src/lib/data-url.ts`
- Create: `apps/web/public/data/space.md`
- Modify: `packages/schema/src/index.ts`
- Modify: `packages/tripmd/src/serialize.ts:28, 46`（导出 `scalar` / `flowMap`）
- Modify: `packages/tripmd/src/index.ts`
- Modify: `apps/web/src/data/TripRepository.ts`
- Modify: `apps/web/src/data/MarkdownTripRepository.ts`
- Modify: `apps/web/src/data/hooks.ts`
- Modify: `apps/web/src/features/trip-list/HomePage.tsx:16-61`
- Modify: `tools/check.ts`（校验 space.md）
- Test: `packages/tripmd/test/space.test.ts`

**Interfaces:**
- Produces: `SpaceSchema`、`type Space = { name; handle?; avatar?; bio?; links: {label,url}[]; tips: {label, image?, url?}[]; markdown: string }`、`type SpaceTip`；`parseSpace(src): { space: Space | null; diagnostics }`；`serializeSpace(space): string`；`TripRepository.getSpace(): Promise<Space | null>`；`useSpace()`；`dataUrl(rel): string`。

打赏（Harley 2026-09-09 追加的需求）：`tips` 是 `space.md` 里的数据，每项 `label` 必填、`image`（二维码，相对路径）与 `url`（链接）二选一；有一项就在名片链接行末尾长出「☕ 打赏」chip，点开底部抽屉：二维码横排可左右滑、链接项是按钮；公开版和完整版都显示。工具仓库的示范 `space.md` **不带** tips。

- [ ] **Step 1: 写失败测试**

```ts
// packages/tripmd/test/space.test.ts
import { describe, expect, it } from 'vitest'
import { parseSpace, serializeSpace } from '../src/space.ts'

const FULL = `---
name: 示例
handle: demo
avatar: avatar.jpg
bio: 一句话简介
links:
  - {label: GitHub, url: https://github.com/example}
  - {label: 小红书, url: https://xhslink.com/x}
tips:
  - {label: 微信, image: tips/wechat.png}
  - {label: Buy Me a Coffee, url: https://buymeacoffee.com/example}
---

自我介绍第一段。

第二段，**加粗**。
`

describe('parseSpace', () => {
  it('全字段', () => {
    const { space, diagnostics } = parseSpace(FULL)
    expect(diagnostics).toEqual([])
    expect(space).toEqual({
      name: '示例',
      handle: 'demo',
      avatar: 'avatar.jpg',
      bio: '一句话简介',
      links: [
        { label: 'GitHub', url: 'https://github.com/example' },
        { label: '小红书', url: 'https://xhslink.com/x' },
      ],
      tips: [
        { label: '微信', image: 'tips/wechat.png' },
        { label: 'Buy Me a Coffee', url: 'https://buymeacoffee.com/example' },
      ],
      markdown: '自我介绍第一段。\n\n第二段，**加粗**。',
    })
  })

  it('只有 name 也成立，其余缺省', () => {
    const { space } = parseSpace('---\nname: 只有名字\n---\n')
    expect(space).toEqual({ name: '只有名字', links: [], tips: [], markdown: '' })
  })

  it('打赏项：缺 label、image 与 url 都没有、两者都有 —— 各自警告并忽略', () => {
    const { space, diagnostics } = parseSpace(
      '---\nname: A\ntips: [{image: a.png}, {label: 空的}, {label: 双, image: a.png, url: https://x}]\n---\n',
    )
    expect(space?.tips).toEqual([])
    expect(diagnostics.filter((d) => d.message.includes('tips'))).toHaveLength(3)
    expect(diagnostics.every((d) => d.severity === 'warning')).toBe(true)
  })

  it('缺 name 是错误；缺 frontmatter 是错误', () => {
    expect(parseSpace('---\nbio: x\n---\n').space).toBeNull()
    expect(parseSpace('# 没有 frontmatter\n').space).toBeNull()
  })

  it('拼错的键与残缺的 link 都要警告，不静默', () => {
    const { space, diagnostics } = parseSpace('---\nname: A\nboi: x\nlinks: [{label: 没 url}]\n---\n')
    expect(space?.links).toEqual([])
    expect(diagnostics.map((d) => d.severity)).toEqual(['warning', 'warning'])
    expect(diagnostics[0]?.hint).toContain('bio')
  })

  it('roundtrip：parse ∘ serialize ∘ parse = parse', () => {
    const once = parseSpace(FULL).space!
    const md2 = serializeSpace(once)
    expect(parseSpace(md2).space).toEqual(once)
    expect(serializeSpace(parseSpace(md2).space!)).toBe(md2)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run packages/tripmd/test/space.test.ts`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: schema**

```ts
// packages/schema/src/space.ts
import { z } from 'zod'

/**
 * 个人空间 —— 数据目录根下一份 `space.md`：frontmatter 是名片，正文是自由 Markdown。
 * 首页从「行程列表」变成「个人主页」：名片在上，行程卡片在下。
 * 完整版与公开版共用这一份，区别只在列出的行程。
 */
export const SpaceLinkSchema = z.object({
  label: z.string().min(1),
  url: z.string().min(1),
})

/**
 * 打赏入口 —— 二维码图片（微信 / 支付宝，相对 space.md 的路径）或一个链接（Buy Me a Coffee / 爱发电）。
 * 二选一：两者都有或都没有的项在解析时被拒。工具不预设任何平台，全由数据说话。
 */
export const SpaceTipSchema = z
  .object({
    label: z.string().min(1),
    image: z.string().min(1).optional(),
    url: z.string().min(1).optional(),
  })
  .refine((t) => (t.image === undefined) !== (t.url === undefined), 'image 与 url 二选一')

export const SpaceSchema = z.object({
  name: z.string().min(1),
  /** 可选，站点标题 / 页签用，显示成 @handle */
  handle: z.string().optional(),
  /** 相对 space.md 的路径；浏览器拼在数据目录 URL 后面 */
  avatar: z.string().optional(),
  bio: z.string().optional(),
  links: z.array(SpaceLinkSchema).default([]),
  /** 有一项就在名片上长出「打赏」按钮；公开版和完整版都显示 —— 二维码本来就是给别人扫的 */
  tips: z.array(SpaceTipSchema).default([]),
  /** frontmatter 之后的自由 Markdown */
  markdown: z.string().default(''),
})

export type Space = z.infer<typeof SpaceSchema>
export type SpaceLink = z.infer<typeof SpaceLinkSchema>
export type SpaceTip = z.infer<typeof SpaceTipSchema>
```

`packages/schema/src/index.ts` 加 `export * from './space.ts'`。

- [ ] **Step 4: 导出 serialize 的两个 YAML 零件**

`packages/tripmd/src/serialize.ts`：`function scalar(` → `export function scalar(`；`function flowMap(` → `export function flowMap(`；`type FlowVal` → `export type FlowVal`。

- [ ] **Step 5: parseSpace / serializeSpace**

```ts
// packages/tripmd/src/space.ts
import { SpaceSchema, type Space } from '@jjj/schema'
import { DiagnosticBag, type Diagnostic } from './diagnostics.ts'
import { lex, proseOf } from './lexer.ts'
import { asRecord, checkKeys, str, yamlOf } from './read.ts'
import { flowMap, scalar } from './serialize.ts'

/**
 * space.md 的解析与序列化 —— 与 plan.md 同一套 lexer / 诊断 / YAML 零件，
 * 同一条规矩：拼错的键要报，残缺的项要报，解析器是唯一校验器。
 */

export const SPACE_KEYS = ['name', 'handle', 'avatar', 'bio', 'links', 'tips'] as const

export interface SpaceParseResult {
  space: Space | null
  diagnostics: Diagnostic[]
}

export function parseSpace(src: string): SpaceParseResult {
  const bag = new DiagnosticBag()
  const tokens = lex(src)
  const fm = tokens.find((t) => t.kind === 'frontmatter')
  if (!fm || fm.kind !== 'frontmatter') {
    bag.error(1, '缺少 frontmatter', 'space.md 必须以 --- 开头，至少声明 name')
    return { space: null, diagnostics: bag.sorted() }
  }
  const meta = asRecord(yamlOf(bag, 0, fm.yaml, 'frontmatter')) ?? {}
  checkKeys(bag, meta, SPACE_KEYS, fm.line, 'space.md')

  const name = str(meta['name'])
  if (!name) bag.error(fm.line, 'space.md 缺少必需字段 `name`')

  const links: Space['links'] = []
  const linksRaw = meta['links']
  for (const item of Array.isArray(linksRaw) ? linksRaw : linksRaw ? [linksRaw] : []) {
    const rec = asRecord(item)
    const label = rec ? str(rec['label']) : undefined
    const url = rec ? str(rec['url']) : undefined
    if (!label || !url) {
      bag.warn(fm.line, 'links 里有一项缺少 label 或 url，已忽略', '写成 `{label: GitHub, url: https://…}`')
      continue
    }
    links.push({ label, url })
  }

  // 打赏项：label 必填，image / url 二选一 —— 两者都没有就没东西可展示，两者都有就不知道该画哪个
  const tips: Space['tips'] = []
  const tipsRaw = meta['tips']
  for (const item of Array.isArray(tipsRaw) ? tipsRaw : tipsRaw ? [tipsRaw] : []) {
    const rec = asRecord(item)
    const label = rec ? str(rec['label']) : undefined
    const image = rec ? str(rec['image']) : undefined
    const url = rec ? str(rec['url']) : undefined
    if (!label) {
      bag.warn(fm.line, 'tips 里有一项缺少 label，已忽略', '写成 `{label: 微信, image: tips/wechat.png}`')
      continue
    }
    if ((image === undefined) === (url === undefined)) {
      bag.warn(fm.line, `tips「${label}」要么给 image（二维码图片）要么给 url（链接），二选一，已忽略`)
      continue
    }
    tips.push(image !== undefined ? { label, image } : { label, url })
  }

  if (bag.hasErrors) return { space: null, diagnostics: bag.sorted() }

  const checked = SpaceSchema.safeParse({
    name,
    handle: str(meta['handle']),
    avatar: str(meta['avatar']),
    bio: str(meta['bio']),
    links,
    tips,
    markdown: proseOf(tokens.filter((t) => t.kind !== 'frontmatter')),
  })
  if (!checked.success) {
    for (const issue of checked.error.issues) {
      bag.error(fm.line, `schema 校验失败 @ ${issue.path.join('.')}：${issue.message}`)
    }
    return { space: null, diagnostics: bag.sorted() }
  }
  return { space: checked.data, diagnostics: bag.sorted() }
}

/** Space → 规范 space.md。与 serialize(trip) 同一条性质：语义幂等、二次往返字节稳定 */
export function serializeSpace(space: Space): string {
  const L = ['---', `name: ${scalar(space.name)}`]
  if (space.handle) L.push(`handle: ${scalar(space.handle)}`)
  if (space.avatar) L.push(`avatar: ${scalar(space.avatar)}`)
  if (space.bio) L.push(`bio: ${scalar(space.bio)}`)
  if (space.links.length > 0) {
    L.push('links:')
    for (const l of space.links) L.push(`  - ${flowMap([['label', l.label], ['url', l.url]])}`)
  }
  if (space.tips.length > 0) {
    L.push('tips:')
    for (const t of space.tips) L.push(`  - ${flowMap([['label', t.label], ['image', t.image], ['url', t.url]])}`)
  }
  L.push('---')
  return L.join('\n') + '\n' + (space.markdown ? `\n${space.markdown}\n` : '')
}
```

`packages/tripmd/src/index.ts` 加：

```ts
export { parseSpace, serializeSpace, SPACE_KEYS, type SpaceParseResult } from './space.ts'
```

注意 `proseOf` 会把 `frontmatter` 之外的 heading / fence 都还原，正文里的 `#` 标题原样保留。

- [ ] **Step 6: 跑单测**

Run: `pnpm vitest run packages/tripmd/test/space.test.ts`
Expected: 6 passed。若「拼错的键」那条的 hint 不含 `bio`：`suggest('boi', SPACE_KEYS)` 的编辑距离是 2、阈值 `max(2, floor(3/3))=2`，应命中；若没命中检查 `checkKeys` 传的 `allowed` 是不是 `SPACE_KEYS`。

- [ ] **Step 7: 仓库与 hook**

`apps/web/src/data/TripRepository.ts` 接口加：

```ts
  /** 个人空间名片；数据目录里没有 space.md 时为 null（首页退回工具默认头部） */
  getSpace(): Promise<Space | null>
```

（import `type Space` 自 `@jjj/schema`。）

`MarkdownTripRepository.ts` 加方法（import `parseSpace`、`type Space`）：

```ts
  async getSpace(): Promise<Space | null> {
    const res = await fetch(`${this.base}/space.md`)
    if (res.status === 404) return null // 没写 space.md 是常态，不是错
    if (!res.ok) throw new Error(`space.md 加载失败（HTTP ${res.status}）`)
    const { space, diagnostics } = parseSpace(await res.text())
    // 写坏了要看得见：与 plan.md 同一待遇，带行号的诊断直接上屏
    if (!space) throw new Error(formatDiagnostics('space.md', diagnostics))
    return space
  }
```

`hooks.ts` 加：

```ts
export function useSpace(): UseQueryResult<Space | null> {
  const repo = useRepository()
  return useQuery({ queryKey: ['space'], queryFn: () => repo.getSpace() })
}
```

- [ ] **Step 8: SpaceHeader 组件**

```tsx
// apps/web/src/features/trip-list/SpaceHeader.tsx
import { Suspense, lazy, useState } from 'react'
import { Coffee, ExternalLink, Settings2 } from 'lucide-react'
import type { Space } from '@jjj/schema'
import { dataUrl } from '../../lib/data-url.ts'
import { TipsSheet } from './TipsSheet.tsx'

// 正文用与行程相同的 Markdown 渲染，但 react-markdown 不该进首页壳 —— 按需加载
const Markdown = lazy(() => import('../../components/Markdown.tsx').then((m) => ({ default: m.Markdown })))

/**
 * 首页头部 —— 个人空间的名片：头像 · 名字 · @handle · 简介 · 链接（+ 打赏）· 正文。
 * 没有 space.md（space 为 null）时退回工具自己的名字，首页仍是一张行程列表。
 * 头像缺省画首字母圆牌，不塞占位图。写了 tips 才有「打赏」按钮，点开是底部抽屉。
 */
export function SpaceHeader({ space, onSettings }: { space: Space | null; onSettings: () => void }) {
  const [tipsOpen, setTipsOpen] = useState(false)
  const name = space?.name ?? 'Just J Journey'
  const bio = space?.bio ?? '把 Markdown 行程读成时间的形状。It\'s just a J thing.'
  const avatarUrl = space?.avatar ? dataUrl(space.avatar) : null

  return (
    <header>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          {space && (
            avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="display flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sunken text-[22px] text-ink" aria-hidden>
                {name.slice(0, 1)}
              </span>
            )
          )}
          <div className="min-w-0">
            <h1 className="display truncate text-[34px] leading-none tracking-[-0.03em] text-ink sm:text-[40px]">
              {name}
            </h1>
            {space?.handle && <p className="tnum mt-1.5 text-[13px] text-soft">@{space.handle}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={onSettings}
          aria-label="设置"
          title="设置"
          className="mt-1 shrink-0 rounded-full bg-sunken p-2 text-graphite transition-colors hover:text-ink"
        >
          <Settings2 size={16} aria-hidden />
        </button>
      </div>
      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-graphite">{bio}</p>
      {space && (space.links.length > 0 || space.tips.length > 0) && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {space.links.map((l) => (
            <li key={l.url}>
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className={CHIP}
              >
                {l.label}
                <ExternalLink size={11} aria-hidden />
              </a>
            </li>
          ))}
          {space.tips.length > 0 && (
            <li>
              <button type="button" onClick={() => setTipsOpen(true)} className={CHIP}>
                <Coffee size={11} aria-hidden />
                打赏
              </button>
            </li>
          )}
        </ul>
      )}
      {space?.markdown && (
        <Suspense fallback={null}>
          <Markdown className="mt-5 text-[14px]">{space.markdown}</Markdown>
        </Suspense>
      )}
      {tipsOpen && space && <TipsSheet tips={space.tips} onClose={() => setTipsOpen(false)} />}
    </header>
  )
}

/** 链接与打赏共用的 chip 样式 —— 同一行里两种控件读起来必须是同一种东西 */
const CHIP =
  'inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] px-2.5 py-1 text-[12px] text-graphite transition-colors hover:border-ink/20 hover:text-ink'
```

打赏抽屉，照 `SettingsSheet.tsx` 的底部抽屉写法（遮罩 + 底部面板 + 关闭按钮；先读一遍它，复用它的容器 class）：

```tsx
// apps/web/src/features/trip-list/TipsSheet.tsx
import { useEffect } from 'react'
import { ExternalLink, X } from 'lucide-react'
import type { SpaceTip } from '@jjj/schema'
import { dataUrl } from '../../lib/data-url.ts'

/**
 * 打赏抽屉 —— 二维码横排（手机上一屏一张、可左右滑，不显示滚动条），链接项渲染成按钮。
 * 二维码是给人扫的：图要大（手机宽度下约 220px 见方），标签在图下方。
 * 公开版和完整版都显示；工具不预设平台，微信 / 支付宝 / Buy Me a Coffee 都只是数据。
 */
export function TipsSheet({ tips, onClose }: { tips: SpaceTip[]; onClose: () => void }) {
  const images = tips.filter((t) => t.image)
  const links = tips.filter((t) => t.url)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-label="打赏"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl border border-[var(--hairline)] bg-raised px-5 pb-8 pt-4 shadow-[var(--shadow)]"
      >
        <div className="flex items-center justify-between">
          <h2 className="display text-[17px] text-ink">打赏</h2>
          <button type="button" onClick={onClose} aria-label="关闭" className="rounded-full p-1 text-graphite hover:text-ink">
            <X size={16} aria-hidden />
          </button>
        </div>
        <p className="mt-1 text-[12.5px] text-graphite">攻略有用的话，请我喝杯咖啡。</p>
        {images.length > 0 && (
          <div className="-mx-5 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {images.map((t) => (
              <figure key={t.label} className="w-[220px] shrink-0 snap-center">
                <img src={dataUrl(t.image!)} alt={`${t.label}打赏二维码`} className="h-[220px] w-[220px] rounded-xl bg-paper object-contain" />
                <figcaption className="mt-2 text-center text-[12.5px] text-graphite">{t.label}</figcaption>
              </figure>
            ))}
          </div>
        )}
        {links.length > 0 && (
          <div className="mt-4 grid gap-2">
            {links.map((t) => (
              <a
                key={t.label}
                href={t.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl border border-[var(--hairline)] px-4 py-2.5 text-[14px] text-ink transition-colors hover:border-ink/20"
              >
                {t.label}
                <ExternalLink size={13} className="text-graphite" aria-hidden />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

两处共用的 URL 拼接住在 lib 里，不从组件导出（组件互相 import 会成环）：

```ts
// apps/web/src/lib/data-url.ts
/** 数据目录里的相对路径 → 浏览器 URL。头像、打赏二维码都从这里拼，与 MarkdownTripRepository 的 base 同源 */
export function dataUrl(rel: string): string {
  return `${import.meta.env.BASE_URL}data/${rel}`
}
```

抽屉的容器 class 先对照 `SettingsSheet.tsx` 现有写法，能复用就复用（同一站里两种底部抽屉不该长得不一样）。

`HomePage.tsx`：删掉原来的 `<div className="flex items-start justify-between gap-3">…</div>` 与其后的 `<p>`（第 30–46 行），换成 `<SpaceHeader space={space.data ?? null} onSettings={() => setSettingsOpen(true)} />`；组件顶部加 `const space = useSpace()`；载入判断改成 `if (isPending || space.isPending) return <Loading />` —— 两份数据都到齐再画，否则头部先画默认再闪成名片；`Settings2` import 若不再用就删；空状态文案改为：

```tsx
          detail="在数据目录（默认 apps/web/public/data，或 JJJ_DATA_DIR）下建一个目录放 plan.md，然后运行 pnpm data:check"
```

`space` 加载失败要显示：`if (space.error) return <Problem title="space.md 解析失败" detail={String(space.error)} />`（放在 `error` 判断之后）。

- [ ] **Step 9: 工具仓库的示范 space.md**

`apps/web/public/data/space.md`（bio 与今天首页的口号一字不差 —— 现有站点首页只多出一枚 GitHub 链接，其余零变化；正文留空，第 4 步变成演示站时再写）：

```markdown
---
name: Just J Journey
handle: jjj
bio: 把 Markdown 行程读成时间的形状。It's just a J thing.
links:
  - {label: GitHub, url: https://github.com/HelloworldHarley/just-j-journey}
---
```

- [ ] **Step 10: data:check 校验 space.md**

`tools/check.ts` 在行程循环之后、manifest 写入之前加（import `parseSpace`）：

```ts
// space.md 与 plan.md 同一待遇：有就校验，写坏了 CI 拦下；没有不算错
const spacePath = join(DATA, 'space.md')
if (existsSync(spacePath)) {
  const { space, diagnostics } = parseSpace(readFileSync(spacePath, 'utf8'))
  if (diagnostics.length > 0) console.log(formatDiagnostics('space.md', diagnostics))
  if (!space) {
    console.error(red('✗ space.md 解析失败'))
    failed++
  } else {
    // 名片引用的文件（头像、打赏二维码）必须在数据目录里，否则线上是一张裂图
    const files = [space.avatar, ...space.tips.map((t) => t.image)].filter((f): f is string => Boolean(f))
    const missing = files.filter((f) => !existsSync(join(DATA, f)))
    if (missing.length > 0) {
      console.error(red(`✗ space.md 引用的文件在数据目录里找不到：${missing.join(', ')}`))
      failed++
    } else {
      console.log(`${green('✓')} ${bold('space.md')} ${dim(`${space.name}${space.handle ? ` @${space.handle}` : ''} · ${space.links.length} 个链接 · ${space.tips.length} 个打赏入口`)}`)
    }
  }
}
```

- [ ] **Step 11: 关口 + 截图**

Run: `pnpm typecheck && pnpm test && pnpm data:check && pnpm build`
Expected: 全绿，`Test Files 22 passed`；data:check 多出 `✓ space.md Just J Journey @jjj · 1 个链接 · 0 个打赏入口`。

截图：`pnpm dev` 起着（Harley 那台 :5173 已在跑就直接用），scratchpad 里 Playwright 截首页 390px 深浅两套 —— 头部应为「Just J Journey」+ `@jjj` + 口号 + GitHub 链接 chip，下方行程卡片不变。把 `space.md` 临时改坏（删 `name`）刷新 → 首页显示带行号的诊断；改回。

打赏抽屉也要截：在 `space.md` 里临时加 `tips: [{label: 微信, image: tips/wechat.png}, {label: Buy Me a Coffee, url: https://example.com}]`，并用 Playwright / Node 生成一张占位 PNG 写到 `apps/web/public/data/tips/wechat.png`（任意 220×220 纯色图即可，**不要**用真二维码），刷新 → 名片链接行末尾出现「☕ 打赏」，点开抽屉：二维码 + 标签、链接按钮、点遮罩 / Esc 关闭；390px 深浅两套。截完把 `space.md` 与占位图**改回 / 删掉**（工具仓库不带打赏数据；Harley 的真二维码住数据仓库）。

- [ ] **Step 12: 交 commit 命令**

```bash
git add packages/schema/src/space.ts packages/schema/src/index.ts packages/tripmd/src/space.ts packages/tripmd/src/serialize.ts packages/tripmd/src/index.ts packages/tripmd/test/space.test.ts apps/web/src/data apps/web/src/lib/data-url.ts apps/web/src/features/trip-list apps/web/public/data/space.md tools/check.ts
git commit -m "feature: space.md personal space with tips, home page becomes a profile"
```

---

### Task 4: 数据目录可配置（`JJJ_DATA_DIR`）+ tools 公共层收敛

**Files:**
- Create: `tools/lib/cli.ts`
- Create: `tools/lib/paths.ts`
- Modify: `tools/check.ts`、`tools/enrich.ts`、`tools/check-built.ts`（颜色常量 / ROOT / DATA 改用公共层）
- Modify: `apps/web/vite.config.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `ROOT: string`、`dataDir(): string`；`dim/red/yellow/green/bold(s): string`、`die(msg): never`。

- [ ] **Step 1: 公共层**

```ts
// tools/lib/cli.ts
/** 终端着色与致命退出 —— 三个 CLI 原先各抄一份，现在只有这一份 */
export const dim = (s: string): string => `\x1b[2m${s}\x1b[0m`
export const red = (s: string): string => `\x1b[31m${s}\x1b[0m`
export const yellow = (s: string): string => `\x1b[33m${s}\x1b[0m`
export const green = (s: string): string => `\x1b[32m${s}\x1b[0m`
export const bold = (s: string): string => `\x1b[1m${s}\x1b[0m`

// 函数声明而非箭头常量：只有这样 TS 才认它「不返回」，`if (!x) die()` 之后 x 才收窄
export function die(msg: string): never {
  console.error(red(msg))
  process.exit(1)
}
```

```ts
// tools/lib/paths.ts
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))

/**
 * 数据目录 —— 代码与数据的分界线。
 * 缺省是仓库自带的 apps/web/public/data（示范数据 + 开发期的行程）；
 * 数据仓库的工作流把 JJJ_DATA_DIR 指到它自己的 trips/（含 space.md）。
 * data:check / enrich / build / publish 全从这里取路径，浏览器那头不知道也不需要知道。
 */
export function dataDir(): string {
  const env = process.env['JJJ_DATA_DIR']
  return env ? resolve(env) : join(ROOT, 'apps/web/public/data')
}
```

- [ ] **Step 2: 三个 CLI 改用公共层**

`tools/check.ts`：删 `ROOT`/`DATA` 与五个颜色常量的定义，改为

```ts
import { ROOT, dataDir } from './lib/paths.ts'
import { bold, dim, green, red, yellow } from './lib/cli.ts'
const DATA = dataDir()
if (process.env['JJJ_DATA_DIR']) console.log(dim(`数据目录 ${DATA}`))
```

`rel` 标签（`data/${dir}/plan.md`）保持不变即可。`ROOT` 如不再用就不 import。

`tools/enrich.ts`：同样删掉本地的颜色常量与 `die`、`ROOT`/`DATA`，import 公共层；`secret()` 里的 `.env` 路径仍用 `ROOT`（key 住工具仓库根，不住数据目录）。

`tools/check-built.ts`：删本地颜色常量与 `ROOT`，import 公共层（`ROOT` 仍要用）。

- [ ] **Step 3: vite 插件**

`apps/web/vite.config.ts` 顶部加 import：

```ts
import { cpSync, existsSync, readFileSync, rmSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
```

`defineConfig` 之前加：

```ts
const DATA_MIME: Record<string, string> = {
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json',
  '.ics': 'text/calendar',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

/**
 * 数据目录可配置 —— 只有 JJJ_DATA_DIR 设了才起作用，否则 public/data 照旧。
 *
 * dev：/data/* 直接从那个目录答，找不到就 404（不回退到 public/data，两份混着就不知道谁是真相）。
 * build：把它整份拷进 dist/data，**先删掉**从 public/ 带过来的那份。
 * TripRepository 接缝因此不用动：浏览器仍 fetch 同一相对路径，只是构建时放进去的是哪份数据变了。
 */
function dataDirPlugin(dir: string | undefined): Plugin {
  let cfg: ResolvedConfig
  return {
    name: 'jjj:data-dir',
    configResolved(c) {
      cfg = c
    },
    configureServer(server) {
      if (!dir) return
      const prefix = `${cfg.base}data/`
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0] ?? ''
        if (!url.startsWith(prefix)) return next()
        const file = join(dir, decodeURIComponent(url.slice(prefix.length)))
        if (!existsSync(file) || statSync(file).isDirectory()) {
          res.statusCode = 404
          res.end()
          return
        }
        res.setHeader('content-type', DATA_MIME[extname(file)] ?? 'application/octet-stream')
        res.end(readFileSync(file))
      })
    },
    closeBundle() {
      if (!dir || cfg.command !== 'build') return
      const out = resolve(cfg.root, cfg.build.outDir, 'data')
      rmSync(out, { recursive: true, force: true })
      cpSync(dir, out, { recursive: true })
    },
  }
}
```

`plugins: [react(), tailwindcss()]` → `plugins: [react(), tailwindcss(), dataDirPlugin(process.env['JJJ_DATA_DIR'] ? resolve(process.env['JJJ_DATA_DIR']) : undefined)]`。

`.gitignore` 在 `dist-check/` 之后加：

```
dist-public/
.public-data/
```

- [ ] **Step 4: 验证「不设就零变化」**

Run: `pnpm typecheck && pnpm data:check && pnpm build && ls apps/web/dist/data`
Expected: 全绿；`dist/data` 仍是 `_broken _demo _example manifest.json seattle-2026-10 space.md`。

- [ ] **Step 5: 验证「设了就换数据」**

```bash
S=/tmp/claude-1000/-home-ubuntu-harley-projects-just-j-journey/0bb7be06-785d-4960-9aff-c57bb591fb0d/scratchpad/datadir
rm -rf $S && mkdir -p $S && cp -r apps/web/public/data/_example $S/kyoto-2026-11 && cp apps/web/public/data/space.md $S/
sed -i 's/^id: example-kyoto-2days/id: kyoto-2026-11/' $S/kyoto-2026-11/plan.md
JJJ_DATA_DIR=$S pnpm data:check && cat $S/manifest.json
JJJ_DATA_DIR=$S pnpm build && ls apps/web/dist/data
```

Expected: data:check 打印 `数据目录 …/datadir`，manifest 只有 `kyoto-2026-11`；`dist/data` 只有 `kyoto-2026-11 manifest.json space.md`（**没有** seattle）。再 `JJJ_DATA_DIR=$S pnpm dev`（另一个端口：`pnpm dev -- --port 5174`）打开首页只见京都；curl `http://localhost:5174/data/seattle-2026-10/plan.md` 得 404。验完 `pnpm build` 一次把 dist 恢复成仓库数据。

- [ ] **Step 6: 交 commit 命令**

```bash
git add tools apps/web/vite.config.ts .gitignore
git commit -m "feature: JJJ_DATA_DIR makes the data directory configurable, tools share one cli helper"
```

---

### Task 5: `sanitize` —— 公开版抹除规则（纯函数）

**Files:**
- Create: `packages/tripmd/src/sanitize.ts`
- Create: `packages/tripmd/test/fixtures/sanitize-full.md`
- Modify: `packages/tripmd/src/index.ts`
- Test: `packages/tripmd/test/sanitize.test.ts`

**Interfaces:**
- Consumes: `detailIndex(days).firstRefDate`（`resolve.ts`）、`timelineDates(t, eventDate).arr`（`transport-dates.ts`）、zod schemas。
- Produces: `type TransportRole = 'arrival' | 'departure' | 'internal' | 'unreferenced'`；`transportRole(firstRefDate: string | undefined, dates: Trip['dates']): TransportRole`；`sanitizeTransport(t: Transport, role: TransportRole, eventDate: string | undefined): Transport`；`blurCoord(c: [number, number]): [number, number]`；`sanitize(trip: Trip): Trip`。

- [ ] **Step 1: 合成 fixture（不含任何真值）**

`packages/tripmd/test/fixtures/sanitize-full.md`：

````markdown
---
id: sanitize-full
title: 抹除测试
destination: Tokyo, Japan
timezone: Asia/Tokyo
start: 2026-11-20
end: 2026-11-22
travelers: 1
currency: JPY
visibility: public
---

# 抹除测试

## 长途

```trip-transports
- what: 去程
  cost: "$900"
  transport: {traveler: 我, mode: flight, carrier: 达美, number: DL7, from: LAX T2, to: HND T3, dep_date: "2026-11-19", dep_time: "08:05", arr_time: "15:30", arr_day_offset: 1, duration: 14h25m, cabin: 经济舱, seat: 36C, baggage: 2 件 · 直挂, refund: 改签 $200 起, price: "$842", stops: [{airport: SEA, arr_time: "10:55", dep_time: "13:35", leg: 2h50m, wait: 2h40m}], legs: [{number: DL7, seat: 36C}, {number: DL167, seat: 22A}], note: 确认号 ABC123}
- what: 新干线
  cost: "¥11220"
  transport: {mode: hsr, carrier: JR 东海, number: のぞみ 1, from: 东京, to: 京都, dep_time: "09:00", arr_time: "11:15", duration: 2h15m, cabin: 指定席, seat: 5A, price: "¥11,220"}
- what: 返程
  transport: {mode: flight, carrier: 联合, number: UA34, from: HND T3, to: SFO, dep_time: "18:30", arr_time: "11:10", arr_date: 2026-11-22, duration: 9h40m, price: "$715", seat: 40K}
- what: 备用巴士
  transport: {mode: bus, carrier: 某巴士公司, number: X99, from: 东京站, to: 成田机场, dep_time: "07:00", arr_time: "08:30", price: "¥3200"}
```

## 住宿

```trip-stays
- what: 山间小屋
  platform: Airbnb
  from: "2026-11-20 18:00"
  to: "2026-11-22 10:00"
  cost: "$120.00"
  room: 独栋
  parking: 含
  breakfast: 不含
  refund: 11/1 前可免费取消
  note: 自助入住
```

## 租车

```trip-rentals
- what: 日产 Note
  platform: Times Car
  from: "2026-11-20 16:30"
  to: "2026-11-22 12:00"
  cost: "$88.40"
  pickup: 羽田机场
  dropoff: 羽田机场
  mileage: 不限
  refund: 提车前 24 小时可免费取消
```

## 地点表

```trip-places
- name: 羽田机场
  en: Haneda Airport
  coord: 35.5494, 139.7798
  category: flight
- name: 山间小屋
  en: 777 Made Up Road
  coord: 35.65432, 139.12345
  category: homestay
  url: https://example.com/listing/1
  gmaps_place_id: ChIJfakefakefake
  note: 门牌在邮箱后面
- name: 京都站
  coord: 34.9858, 135.7588
  category: transit
```

## Day 1 · 2026-11-20

```trip-day
theme: 落地提车进山
```

今天的主线是把车提到、天黑前进山。

### 落地

```trip-event
time: "15:30"
category: flight
place: 羽田机场
detail: 去程
```

### 提车

```trip-event
time: "16:30"
category: drive
place: 羽田机场
detail: 日产 Note
cost: 停车 ¥500
to_next: {mode: drive, minutes: 90}
```

### 入住

```trip-event
time: "18:00"
category: homestay
place: 山间小屋
detail: 山间小屋
```

## Day 2 · 2026-11-21

```trip-day
from_stay: {mode: drive, minutes: 30}
```

### 新干线去京都

```trip-event
time: 09:00–11:15
category: hsr
place: 京都站
detail: 新干线
```

## Day 3 · 2026-11-22

```trip-day
from_stay: {mode: drive, minutes: 90}
```

### 起飞

```trip-event
time: "18:30"
category: flight
place: 羽田机场
detail: 返程
```

## 附录 · 打包清单

```trip-ref
id: packing
```

- 好走的鞋
- 充电线
````

**fixture 里每个值都是编的。** 不许出现真行程（`apps/web/public/data/seattle-2026-10/plan.md`）里的任何坐标、门牌、价格、车型、平台、班次、座位 —— 这个仓库是公开的。`备用巴士` 故意不被任何事件引用（解析器会警告，测试只看 error）。

先确认它本身能解析：写一个临时 `it` 或直接 `pnpm data:check` 不管它（fixtures 不在 data 目录下）；用 Step 2 的第一条测试代替。

- [ ] **Step 2: 写失败测试**

```ts
// packages/tripmd/test/sanitize.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Transport, Trip } from '@jjj/schema'
import { parse } from '../src/parse.ts'
import { serialize } from '../src/serialize.ts'
import { blurCoord, sanitize, sanitizeTransport, transportRole } from '../src/sanitize.ts'

/**
 * 公开版抹除 —— 白名单：只有显式保留的字段能过。
 * fixture 是合成的（工具仓库是公开的，真值不能进测试）。
 */
const md = readFileSync(join(__dirname, 'fixtures/sanitize-full.md'), 'utf8')
const load = (): Trip => {
  const r = parse(md)
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
  return r.trip!
}
const journey = (t: Trip, what: string) => t.journeys.find((j) => j.what === what)!

describe('transportRole', () => {
  const dates = { start: '2026-11-20', end: '2026-11-22' }
  it('Day 1 抵达 · 末日离开 · 中间日行程内部 · 没引用', () => {
    expect(transportRole('2026-11-20', dates)).toBe('arrival')
    expect(transportRole('2026-11-22', dates)).toBe('departure')
    expect(transportRole('2026-11-21', dates)).toBe('internal')
    expect(transportRole(undefined, dates)).toBe('unreferenced')
  })
  it('单日行程：当天既是首日也是末日，按抵达处理', () => {
    expect(transportRole('2026-11-20', { start: '2026-11-20', end: '2026-11-20' })).toBe('arrival')
  })
})

describe('sanitize · 长途', () => {
  it('抵达：只剩到达端 + 乘客 + 方式，到达日期落成显式 arr_date', () => {
    const t = sanitize(load())
    const j = journey(t, '去程')
    expect(j.cost).toBeUndefined()
    const f = j.transports[0]!
    expect(f).toMatchObject({ traveler: '我', mode: 'flight', to: 'HND T3', arrTime: '15:30', arrDate: '2026-11-20' })
    for (const k of ['from', 'depTime', 'depDate', 'carrier', 'number', 'price', 'cabin', 'seat', 'baggage', 'refund', 'note'] as const) {
      expect(f[k], k).toBeUndefined()
    }
    expect(f.stops).toEqual([])
    expect(f.legs).toEqual([])
    expect(f.durationMin).toBeNull()
    expect(f.arrDayOffset).toBe(0)
  })

  it('行程内部移动：两端时刻与地点全留，票面细节全抹', () => {
    const f = journey(sanitize(load()), '新干线').transports[0]!
    expect(f).toMatchObject({ mode: 'hsr', from: '东京', to: '京都', depTime: '09:00', arrTime: '11:15', arrDate: '2026-11-21' })
    expect(f.carrier).toBeUndefined()
    expect(f.number).toBeUndefined()
    expect(f.price).toBeUndefined()
    expect(f.seat).toBeUndefined()
  })

  it('离开：只剩出发端，dep_date 也不留（规范：日期由事件所在天派生）', () => {
    const f = journey(sanitize(load()), '返程').transports[0]!
    expect(f).toMatchObject({ mode: 'flight', from: 'HND T3', depTime: '18:30' })
    expect(f.to).toBeUndefined()
    expect(f.arrTime).toBeUndefined()
    expect(f.arrDate).toBeUndefined()
    expect(f.depDate).toBeUndefined()
    expect(f.price).toBeUndefined()
  })

  it('没被任何事件引用的长途：只剩 traveler / mode，两端都不留', () => {
    const f = journey(sanitize(load()), '备用巴士').transports[0]!
    expect(f.mode).toBe('bus')
    for (const k of ['from', 'to', 'depTime', 'arrTime', 'carrier', 'number', 'price'] as const) {
      expect(f[k], k).toBeUndefined()
    }
  })

  it('事件上灌好的 transports 与 journeys 同步抹（内存里也不能留真值）', () => {
    const t = sanitize(load())
    const ev = t.days[0]!.events.find((e) => e.detailRef === '去程')!
    expect(ev.transports[0]!.price).toBeUndefined()
    expect(ev.transports[0]!.to).toBe('HND T3')
  })

  it('白名单：schema 之外的字段也过不去', () => {
    const t = load()
    const raw = { ...journey(t, '去程').transports[0]!, secret: 'x' } as Transport
    const out = sanitizeTransport(raw, 'arrival', '2026-11-20')
    expect('secret' in out).toBe(false)
  })
})

describe('sanitize · 住宿 / 租车 / 地点', () => {
  it('住宿与租车只抹 cost，其余照留', () => {
    const t = sanitize(load())
    const s = t.stays[0]!
    expect(s.cost).toBeUndefined()
    expect(s).toMatchObject({ platform: 'Airbnb', room: '独栋', parking: '含', breakfast: '不含', refund: '11/1 前可免费取消', note: '自助入住' })
    const r = t.rentals[0]!
    expect(r.cost).toBeUndefined()
    expect(r).toMatchObject({ platform: 'Times Car', mileage: '不限', refund: '提车前 24 小时可免费取消' })
    expect(r.pickupPlaceId).toBe(load().rentals[0]!.pickupPlaceId)
    // 白名单：住宿 / 租车除了 cost 全留 —— 用「原记录删掉 cost」逐字段比对，漏抄一个字段就红
    const { cost: _sc, ...stayRest } = load().stays[0]!
    expect(s).toEqual(stayRest)
    const { cost: _rc, ...rentalRest } = load().rentals[0]!
    expect(r).toEqual(rentalRest)
  })

  it('民宿：坐标模糊到 2 位小数，en / note / url / gmaps_place_id 全删（任何一个都能把模糊废掉）；其他类别原样', () => {
    const before = load()
    const after = sanitize(before)
    const cabin = after.places.find((p) => p.category === 'homestay')!
    expect(cabin.coord).toEqual([139.12, 35.65])
    expect(cabin.nameEn).toBeUndefined()
    expect(cabin.note).toBeUndefined()
    expect(cabin.url).toBeUndefined()
    expect(cabin.gmapsPlaceId).toBeUndefined()
    expect(cabin.geo.query).toBe('山间小屋')
    const airport = after.places.find((p) => p.name === '羽田机场')!
    expect(airport).toEqual(before.places.find((p) => p.name === '羽田机场'))
  })

  it('blurCoord：四舍五入，负数也对', () => {
    expect(blurCoord([139.12345, 35.65432])).toEqual([139.12, 35.65])
    expect(blurCoord([-70.12345, 12.34567])).toEqual([-70.12, 12.35])
  })
})

describe('sanitize · 合法性', () => {
  it('抹完仍是合法 TripMD：serialize 后零错误可解析，且二次往返字节稳定', () => {
    const s = sanitize(load())
    const md2 = serialize(s)
    const again = parse(md2)
    expect(again.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(serialize(again.trip!)).toBe(md2)
    expect(again.trip!.visibility).toBe('public')
  })

  it('事件卡、导语、事件散项 cost、附录一字不动', () => {
    const before = load()
    const after = sanitize(before)
    // fixture 里这三样都真有内容，断言才不是空对空
    expect(before.days[0]!.intro).not.toBe('')
    expect(before.days[0]!.events.some((e) => e.cost)).toBe(true)
    expect(before.reference.length).toBeGreaterThan(0)
    const strip = (t: Trip) => t.days.map((d) => ({ ...d, events: d.events.map((e) => ({ ...e, transports: [] })) }))
    expect(strip(after)).toEqual(strip(before))
    expect(after.reference).toEqual(before.reference)
    expect(after.constraints).toEqual(before.constraints)
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm vitest run packages/tripmd/test/sanitize.test.ts`
Expected: FAIL —— 模块不存在。

- [ ] **Step 4: 实现**

```ts
// packages/tripmd/src/sanitize.ts
import {
  JourneySchema,
  PlaceSchema,
  RentalSchema,
  StaySchema,
  TransportSchema,
  TripSchema,
  type Journey,
  type Place,
  type Rental,
  type Stay,
  type Transport,
  type Trip,
} from '@jjj/schema'
import { detailIndex } from './resolve.ts'
import { timelineDates } from './transport-dates.ts'

/**
 * 公开版抹除 —— 构建期跑一次，纯函数：parse → sanitize → serialize → 再 parse 验收。
 *
 * 规则（spec 第一节，已拍板）：
 * - 只抹**前置块**：长途 / 住宿 / 租车；事件卡、正文、附录、事件散项 cost 一字不动
 * - 长途按**首次引用落在哪一天**判：Day 1 = 抵达（只留到达端）、末日 = 离开（只留出发端）、
 *   中间日 = 行程内部移动（两端全留）；traveler / mode 总是留（多人汇合、画图标）
 * - 住宿 / 租车只抹 cost
 * - 民宿（homestay）坐标模糊到约 1 公里，删 en / note（en 常常就是门牌）
 *
 * **白名单写法**：每个记录都是重新拼出来的，只有显式抄过去的字段能进公开版；
 * schema 以后新增的字段默认被抹（zod parse 还会顺手剥掉 schema 之外的键）。
 */

export type TransportRole = 'arrival' | 'departure' | 'internal' | 'unreferenced'

/** 一条长途在行程里扮演什么 —— firstRefDate 来自 detailIndex（按日期序的首次引用） */
export function transportRole(firstRefDate: string | undefined, dates: Trip['dates']): TransportRole {
  if (firstRefDate === undefined) return 'unreferenced'
  if (firstRefDate <= dates.start) return 'arrival'
  if (firstRefDate >= dates.end) return 'departure'
  return 'internal'
}

export function sanitizeTransport(t: Transport, role: TransportRole, eventDate: string | undefined): Transport {
  const keep: Partial<Transport> = { traveler: t.traveler, mode: t.mode }
  if (role === 'arrival' || role === 'internal') {
    keep.to = t.to
    keep.arrTime = t.arrTime
    // 出发端抹掉之后「钟点回卷」没了锚点，arr_day_offset 也失去参照 ——
    // 把完整版派生出来的到达日期落成显式 arr_date，公开版不用再推
    keep.arrDate = timelineDates(t, eventDate).arr
  }
  if (role === 'departure' || role === 'internal') {
    keep.from = t.from
    keep.depTime = t.depTime
    // dep_date 不留（规范：全部抹掉）—— 出发日就是事件所在那天，公开版由此派生
  }
  return TransportSchema.parse(keep)
}

function sanitizeJourney(j: Journey, role: TransportRole, eventDate: string | undefined): Journey {
  return JourneySchema.parse({
    what: j.what,
    transports: j.transports.map((t) => sanitizeTransport(t, role, eventDate)),
  })
}

// 住宿 / 租车也按白名单重拼：规范说「只抹 cost、其余照留」，但「其余」要逐个点名 ——
// 以后 schema 加了新字段，默认是抹掉而不是发出去，想公开得回到这里加一行
function sanitizeStay(s: Stay): Stay {
  return StaySchema.parse({
    what: s.what,
    platform: s.platform,
    from: s.from,
    to: s.to,
    refund: s.refund,
    note: s.note,
    placeId: s.placeId,
    stars: s.stars,
    room: s.room,
    parking: s.parking,
    breakfast: s.breakfast,
  })
}

function sanitizeRental(r: Rental): Rental {
  return RentalSchema.parse({
    what: r.what,
    platform: r.platform,
    from: r.from,
    to: r.to,
    refund: r.refund,
    note: r.note,
    mileage: r.mileage,
    insurance: r.insurance,
    pickupPlaceId: r.pickupPlaceId,
    dropoffPlaceId: r.dropoffPlaceId,
  })
}

/** 约 1 公里：两位小数。民宿的门口不该出现在公开地图上，但「大概在哪片」对读者有用 */
export function blurCoord(c: [number, number]): [number, number] {
  return [Math.round(c[0] * 100) / 100, Math.round(c[1] * 100) / 100]
}

/**
 * 民宿地点按白名单重拼：坐标模糊后，任何能反查到门口的字段都得走 ——
 * en 常常就是门牌、note 写着怎么找门、url 是房源页、gmaps_place_id 直接指到那栋楼。
 * 其他类别（酒店 / 景点 / 餐厅）是公开商业地址，原样。
 */
function sanitizePlace(p: Place): Place {
  if (p.category !== 'homestay') return p
  return PlaceSchema.parse({
    id: p.id,
    name: p.name,
    coord: p.coord ? blurCoord(p.coord) : null,
    category: p.category,
    tentative: p.tentative,
    geo: { ...p.geo, query: p.name },
  })
}

export function sanitize(trip: Trip): Trip {
  const idx = detailIndex(trip.days)
  const journeys = trip.journeys.map((j) => {
    const date = idx.firstRefDate.get(j.what)
    return sanitizeJourney(j, transportRole(date, trip.dates), date)
  })
  // 首次引用的事件上灌着同一份 transports —— serialize 不写它，但内存里的 Trip 不能留真值
  const byWhat = new Map(journeys.map((j) => [j.what, j.transports]))
  const days = trip.days.map((d) => ({
    ...d,
    events: d.events.map((e) =>
      e.detailRef && e.transports.length > 0 && byWhat.has(e.detailRef)
        ? { ...e, transports: byWhat.get(e.detailRef)! }
        : e,
    ),
  }))
  return TripSchema.parse({
    ...trip,
    journeys,
    stays: trip.stays.map(sanitizeStay),
    rentals: trip.rentals.map(sanitizeRental),
    places: trip.places.map(sanitizePlace),
    days,
  })
}
```

`packages/tripmd/src/index.ts` 加：

```ts
export { sanitize, sanitizeTransport, transportRole, blurCoord, type TransportRole } from './sanitize.ts'
```

- [ ] **Step 5: 跑测试**

Run: `pnpm vitest run packages/tripmd/test/sanitize.test.ts`
Expected: 全部 passed。若「二次往返字节稳定」失败，看 diff：常见原因是 `arrDate` 与出发日相同被 serialize 写成 `arr_date` 又被解析成同值 —— 那是稳定的；真正不稳定的是 `geo`/`id` 这类派生量，不该出现在 md 里。

- [ ] **Step 6: 负向对照（必做，做完改回）**

把 `transportRole` 的 `firstRefDate <= dates.start` 改成 `<`，跑测试：`抵达` 那条必须红（去程被判成 internal，`from` 不再是 undefined）。把 `blurCoord` 的 `100` 改成 `1000`，`民宿` 那条必须红。两处都改回，测试回绿。

- [ ] **Step 7: 交 commit 命令**

```bash
git add packages/tripmd/src/sanitize.ts packages/tripmd/src/index.ts packages/tripmd/test/sanitize.test.ts packages/tripmd/test/fixtures/sanitize-full.md
git commit -m "feature: sanitize strips front-block secrets for the public build"
```

---

### Task 6: `findLeaks` —— 抹净断言（黑名单现算）

**Files:**
- Create: `packages/tripmd/src/leaks.ts`
- Modify: `packages/tripmd/src/index.ts`
- Test: `packages/tripmd/test/leaks.test.ts`

**Interfaces:**
- Consumes: `sanitize` / `serialize` / fixture（Task 5）。
- Produces: `interface Leak { value: string; line: number; inFence: boolean }`；`sensitiveValues(trip: Trip): string[]`；`findLeaks(publicMd: string, source: Trip): Leak[]`。

设计偏差（记进 spec 实现记录）：spec 写的是「以 seattle 真值为黑名单」，但工具仓库是公开的，真值写进测试等于把它们再发一遍。改为**从完整版 Trip 现算黑名单**，测试吃合成 fixture；对真行程的扫描在 `build:public` / `showcase:refresh` 运行时做。结构块（```trip-* 围栏）里的命中是致命错误；正文里的命中只警告 —— 正文按设计不抹，附录预算表里出现票价是 Harley 自己决定要公开的。

- [ ] **Step 1: 写失败测试**

```ts
// packages/tripmd/test/leaks.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from '../src/parse.ts'
import { serialize } from '../src/serialize.ts'
import { sanitize } from '../src/sanitize.ts'
import { findLeaks, sensitiveValues } from '../src/leaks.ts'

const md = readFileSync(join(__dirname, 'fixtures/sanitize-full.md'), 'utf8')
const trip = () => parse(md).trip!

describe('sensitiveValues', () => {
  it('收票价 / 班次 / 座位 / 预订金额 / 民宿 en 与 note 与精确坐标，金额另加裸数字', () => {
    const v = sensitiveValues(trip())
    for (const s of ['$842', '842', 'DL7', 'DL167', '36C', '22A', '$120.00', '120.00', '$88.40', '777 Made Up Road', '门牌在邮箱后面', '35.65432, 139.12345', '确认号 ABC123', 'https://example.com/listing/1', 'ChIJfakefakefake']) {
      expect(v, s).toContain(s)
    }
    // 通用词不进黑名单：正文里合法出现太多
    expect(v).not.toContain('达美')
    expect(v).not.toContain('经济舱')
    // 裸数字只从金额派生：备注里的 "ABC123" 不能长出 "123"
    expect(v).not.toContain('123')
  })
})

describe('findLeaks', () => {
  it('抹过的公开版一处都不该命中', () => {
    const t = trip()
    expect(findLeaks(serialize(sanitize(t)), t)).toEqual([])
  })

  it('没抹的完整版在结构块里命中（inFence）', () => {
    const t = trip()
    const leaks = findLeaks(serialize(t), t)
    expect(leaks.some((l) => l.value === '$842' && l.inFence)).toBe(true)
    expect(leaks.some((l) => l.value === '777 Made Up Road' && l.inFence)).toBe(true)
  })

  it('正文里出现票价：命中但 inFence 为 false（警告级）', () => {
    const t = trip()
    const publicMd = serialize(sanitize(t)) + '\n## 附录 · 预算\n\n```trip-ref\nid: budget\n```\n\n机票 $842，住宿 $120.00。\n'
    const leaks = findLeaks(publicMd, t)
    expect(leaks.length).toBeGreaterThan(0)
    expect(leaks.every((l) => !l.inFence)).toBe(true)
    expect(leaks.map((l) => l.value)).toContain('$842')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run packages/tripmd/test/leaks.test.ts`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 实现**

```ts
// packages/tripmd/src/leaks.ts
import type { Trip } from '@jjj/schema'

/**
 * 抹净断言 —— 拿完整版里**该被抹掉的值**当黑名单，逐个在公开版文本里找。
 *
 * 黑名单从 Trip 现算，不写死任何真值（工具仓库是公开的，真值不能进测试或代码）。
 * 只收足够特异的字段：票价 / 班次号 / 座位 / 预订金额 / 长途备注 / 民宿英文名、备注、精确坐标。
 * carrier、cabin、baggage、refund 这种通用词（「达美」「1 件」）正文里合法出现太多，不进黑名单。
 *
 * 结构块（```trip-* 围栏）里的命中 = sanitize 漏了，致命；正文里的命中只警告 ——
 * 正文按设计不抹，附录预算表里出现票价是作者自己决定要公开的。
 */
export interface Leak {
  value: string
  /** 公开版文本里的 1-based 行号 */
  line: number
  /** 命中发生在 ```trip-* 结构块里 */
  inFence: boolean
}

export function sensitiveValues(trip: Trip): string[] {
  const out = new Set<string>()
  const add = (v: string | undefined): void => {
    const s = v?.trim()
    if (s && s.length >= 3) out.add(s)
  }
  // 金额另加一份裸数字（"$339.42" → "339.42"，"$715" → "715"），免得换个货币写法漏网。
  // **只对金额做**：备注、班次里的数字（"确认号 ABC123" → "123"）到处都能撞上，会把扫描变成噪音
  const addMoney = (v: string | undefined): void => {
    add(v)
    const m = v ? /\d[\d,]*\.\d+|\d{3,}/.exec(v) : null
    if (m && m[0] !== v) out.add(m[0])
  }
  for (const j of trip.journeys) {
    addMoney(j.cost?.raw)
    for (const t of j.transports) {
      addMoney(t.price)
      add(t.number)
      add(t.seat)
      add(t.note)
      for (const l of t.legs) {
        add(l.number)
        add(l.seat)
      }
    }
  }
  for (const r of [...trip.stays, ...trip.rentals]) addMoney(r.cost?.raw)
  for (const p of trip.places) {
    if (p.category !== 'homestay') continue
    add(p.nameEn)
    add(p.note)
    add(p.url)
    add(p.gmapsPlaceId)
    if (p.coord) add(`${p.coord[1]}, ${p.coord[0]}`) // 作者格式：纬度在前
  }
  return [...out]
}

export function findLeaks(publicMd: string, source: Trip): Leak[] {
  const values = sensitiveValues(source)
  const leaks: Leak[] = []
  let inFence = false
  publicMd.split('\n').forEach((text, i) => {
    if (/^\s*```/.test(text)) {
      // 开围栏：只有 trip-* 算结构块；关围栏：任何 ``` 都关
      inFence = inFence ? false : /^\s*```trip-/.test(text)
      return
    }
    for (const v of values) if (text.includes(v)) leaks.push({ value: v, line: i + 1, inFence })
  })
  return leaks
}
```

`packages/tripmd/src/index.ts` 加：

```ts
export { findLeaks, sensitiveValues, type Leak } from './leaks.ts'
```

- [ ] **Step 4: 跑测试 + 负向对照**

Run: `pnpm vitest run packages/tripmd/test/leaks.test.ts`
Expected: 4 passed。负向对照：把 `sanitize.ts` 里 `sanitizeTransport` 的 `keep` 初始值临时加上 `price: t.price`，`抹过的公开版一处都不该命中` 必须红，且 leak 的 `inFence` 为 true；改回。

- [ ] **Step 5: 交 commit 命令**

```bash
git add packages/tripmd/src/leaks.ts packages/tripmd/src/index.ts packages/tripmd/test/leaks.test.ts
git commit -m "feature: leak scan derives its blacklist from the private trip"
```

---

### Task 7: 公开构建下的 UI 连带

**Files:**
- Modify: `apps/web/src/features/itinerary/ticket-parts.tsx:37-72, 125-140`
- Modify: `apps/web/src/features/itinerary/TransportTimeline.tsx:112-143, 297-341`
- Modify: `apps/web/src/features/reference/InfoView.tsx:26, 60`

**Interfaces:**
- Consumes: `PUBLIC_BUILD`（Task 2）。

公开版**不画**「待填」：那是给作者的提醒。抹掉的字段直接不渲染，连它的标签和图标一起消失。

- [ ] **Step 1: SlotText / TermsRow**

`ticket-parts.tsx` import `PUBLIC_BUILD`。`SlotText` 的 `if (value) {…}` 之后、待填槽 return 之前加：

```tsx
  // 公开版：缺就是缺，不画待填 —— 「待填」是给作者的提醒，读者看到只会困惑
  if (PUBLIC_BUILD) return null
```

`TermsRow`：

```tsx
export function TermsRow({ terms }: { terms: { label: string; value?: string }[] }) {
  // 公开版里没值的条款整格不画（标签也不留）；完整版留待填槽
  const shown = PUBLIC_BUILD ? terms.filter((t) => t.value) : terms
  if (shown.length === 0) return null
  …
      {shown.map((t) => (
```

- [ ] **Step 2: TransportTimeline**

import `PUBLIC_BUILD`。`hasCabinRow` / `hasTerms` 改为：

```ts
  // 完整版按 mode 决定要不要留空格位；公开版只画真有值的格
  const showEmpty = !PUBLIC_BUILD
  const hasCabinRow =
    (showEmpty && slots.cabin !== null) || cabinRows.some((r) => r.number || r.cabin || r.seat)
  const hasBag = (showEmpty && slots.bag !== null) || Boolean(flight.baggage)
  const hasRefund = showEmpty || Boolean(flight.refund)
  const hasTerms = hasCabinRow || hasBag || hasRefund
```

头行：全程与预算：

```tsx
        {(flight.durationMin !== null || showEmpty) && (
          <span className="tnum text-graphite">
            {flight.durationMin !== null ? `全程 ${formatDurationCompact(flight.durationMin)}` : '全程 —'}
          </span>
        )}
        {/* 票价钉右上角：订好了是金色金额，没订是等着填的预算槽；公开版没钱这一格 */}
        {(flight.price || showEmpty) && (
          <span className="ml-auto inline-flex items-center gap-1.5">
            {flight.price ? (
              <span className="tnum text-[13px] font-semibold tint-faved">{roundMoneyText(flight.price)}</span>
            ) : (
              <>
                <span className="text-graphite">预算</span>
                <SlotText value={undefined} hint="待填" />
              </>
            )}
          </span>
        )}
```

条款行：托运格条件 `(slots.bag !== null || flight.baggage)` → `hasBag`；退改格外包 `{hasRefund && (…)}`。

- [ ] **Step 3: InfoView**

import `PUBLIC_BUILD`；两处 `<CalendarExport trip={trip} />` → `{!PUBLIC_BUILD && <CalendarExport trip={trip} />}`（公开版不生成 ics，订阅入口是死链接；下载虽然能现场生成，但整组入口是作者的工具，一起藏）。

- [ ] **Step 4: 验证**

Run: `pnpm typecheck && pnpm build`（完整版零变化）。

再 `VITE_PUBLIC=1 pnpm dev -- --port 5174`，打开 `http://localhost:5174/#/trip/_demo/list`：「她」那张 PVG→HND 的票（全部槽位为空）应只剩乘客标签 + 图标 + 一根轴，没有任何虚线框；DL7 那张不变（字段全满）。资料页顶部没有日历三枚 chip。首页无「N 项待订」。截 390px 深浅两套留档。关掉 5174。

- [ ] **Step 5: 交 commit 命令**

```bash
git add apps/web/src/features/itinerary/ticket-parts.tsx apps/web/src/features/itinerary/TransportTimeline.tsx apps/web/src/features/reference/InfoView.tsx
git commit -m "feature: the public build hides author-only slots, badges and calendar export"
```

---

### Task 8: `pnpm build:public`（`tools/publish.ts`）+ `check:built --public`

**Files:**
- Create: `tools/lib/stage-public.ts`
- Create: `tools/publish.ts`
- Modify: `tools/check-built.ts:31-54, 124-134`
- Modify: `package.json`

**Interfaces:**
- Consumes: `sanitize` / `findLeaks` / `buildManifest` / `parseSpace` / `dataDir()` / `cli.ts`。
- Produces: `STAGE_DIR: string`（`apps/web/.public-data`）；`stagePublic(src: string, stage: string): { entries: ManifestEntry[]; skipped: string[] }`；脚本 `build:public`。

- [ ] **Step 1: 暂存函数**

```ts
// tools/lib/stage-public.ts
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildManifest,
  findLeaks,
  formatDiagnostics,
  parse,
  parseSpace,
  sanitize,
  serialize,
  type ManifestEntry,
} from '@jjj/tripmd'
import { bold, die, dim, green, yellow } from './cli.ts'
import { ROOT } from './paths.ts'

/** 公开版的临时数据目录（gitignored）。留在仓库里而不用系统 tmp，方便出问题时直接翻 */
export const STAGE_DIR = join(ROOT, 'apps/web/.public-data')

/**
 * 把数据目录变成公开版数据目录：
 *   visibility: public 的行程 → sanitize → serialize → 再 parse 验收 → 抹净断言 → 写进 stage
 *   geometry.json 原样拷（不重算：民宿坐标模糊后对不上的段由运行时规则回退虚线）
 *   space.md + 头像原样拷；manifest 重生成；**不生成** calendar.ics
 * `_` 前缀目录一律不收。返回入册清单与跳过的目录名。
 */
export function stagePublic(src: string, stage: string): { entries: ManifestEntry[]; skipped: string[] } {
  rmSync(stage, { recursive: true, force: true })
  mkdirSync(stage, { recursive: true })
  const entries: ManifestEntry[] = []
  const skipped: string[] = []

  const dirs = readdirSync(src)
    .filter((d) => !d.startsWith('.') && !d.startsWith('_') && statSync(join(src, d)).isDirectory())
    .sort()
  for (const dir of dirs) {
    const mdPath = join(src, dir, 'plan.md')
    if (!existsSync(mdPath)) continue
    const { trip, diagnostics } = parse(readFileSync(mdPath, 'utf8'))
    if (!trip) die(`${dir} 解析失败：\n${formatDiagnostics(`${dir}/plan.md`, diagnostics)}`)
    if (trip.visibility !== 'public') {
      skipped.push(dir)
      continue
    }

    const md = serialize(sanitize(trip))
    // 解析器是唯一校验器：抹完的 plan.md 必须是合法 TripMD
    const check = parse(md)
    const errors = check.diagnostics.filter((d) => d.severity === 'error')
    if (!check.trip || errors.length > 0) {
      die(`${dir} 抹除后解析不过：\n${formatDiagnostics(`${dir}/plan.md`, errors)}`)
    }
    // 抹净断言：结构块里一个真值都不能留；正文里的命中只提醒（正文按设计不抹）
    const leaks = findLeaks(md, trip)
    const fatal = leaks.filter((l) => l.inFence)
    if (fatal.length > 0) {
      die(`${dir} 公开版结构块里仍有敏感值：${fatal.map((l) => `第 ${l.line} 行「${l.value}」`).join('，')}`)
    }
    for (const l of leaks) {
      console.log(`  ${yellow('⚠')} ${dir} 第 ${l.line} 行正文出现「${l.value}」${dim('—— 正文按设计不抹，确认这是你想公开的')}`)
    }

    mkdirSync(join(stage, dir))
    writeFileSync(join(stage, dir, 'plan.md'), md)
    const geo = join(src, dir, 'geometry.json')
    if (existsSync(geo)) cpSync(geo, join(stage, dir, 'geometry.json'))
    entries.push({ id: dir, visibility: 'public' })
    console.log(`${green('✓')} ${bold(dir)} ${dim('已抹除')}`)
  }

  writeFileSync(join(stage, 'manifest.json'), JSON.stringify(buildManifest(entries), null, 2) + '\n')

  const space = join(src, 'space.md')
  if (existsSync(space)) {
    cpSync(space, join(stage, 'space.md'))
    // 名片引用的文件一起走：头像、打赏二维码（二维码本来就是给别人扫的，公开版照发）
    const parsed = parseSpace(readFileSync(space, 'utf8')).space
    const files = [parsed?.avatar, ...(parsed?.tips.map((t) => t.image) ?? [])].filter((f): f is string => Boolean(f))
    for (const f of files) {
      if (!existsSync(join(src, f))) continue // data:check 已经拦过缺文件，这里只管拷
      mkdirSync(join(stage, f, '..'), { recursive: true })
      cpSync(join(src, f), join(stage, f))
    }
  }
  return { entries, skipped }
}
```

- [ ] **Step 2: CLI**

```ts
#!/usr/bin/env tsx
/**
 * 公开版构建 —— 给别人看的个人空间站。
 *
 *   pnpm build:public                    → apps/web/dist-public
 *   pnpm build:public --base=/repo/      GitHub Pages 项目页要的子路径
 *   pnpm build:public --stage-only       只生成临时数据目录，不构建（check:built --public 用）
 *
 * 做法：数据目录里 visibility: public 的行程过 sanitize，写进 apps/web/.public-data，
 * 再以 JJJ_DATA_DIR 指向它、VITE_PUBLIC=1 跑同一份 vite build。
 * 产物与完整版（pnpm build）是**同一个 SPA**，只是数据换了、缺的字段不再画「待填」。
 */
import { execSync } from 'node:child_process'
import { bold, dim, green, yellow } from './lib/cli.ts'
import { ROOT, dataDir } from './lib/paths.ts'
import { STAGE_DIR, stagePublic } from './lib/stage-public.ts'

const args = process.argv.slice(2)
const stageOnly = args.includes('--stage-only')
const base = args.find((a) => a.startsWith('--base='))
const OUT = 'dist-public'

const src = dataDir()
console.log(dim(`数据目录 ${src} → 公开版暂存 ${STAGE_DIR}`))
const { entries, skipped } = stagePublic(src, STAGE_DIR)
if (skipped.length > 0) console.log(dim(`跳过 ${skipped.length} 份非公开行程：${skipped.join(', ')}`))
if (entries.length === 0) console.log(yellow('没有任何 visibility: public 的行程 —— 公开版会是一个空的个人空间'))
if (stageOnly) process.exit(0)

execSync(`pnpm --filter @jjj/web exec vite build --outDir ${OUT}${base ? ` ${base}` : ''}`, {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, JJJ_DATA_DIR: STAGE_DIR, VITE_PUBLIC: '1' },
})
console.log(`${green('✓')} ${bold(`apps/web/${OUT}`)} ${dim(`${entries.length} 份公开行程`)}`)
```

`package.json` scripts 加（`build` 之后）：

```json
    "build:public": "tsx tools/publish.ts",
```

- [ ] **Step 3: check-built 支持公开版**

`tools/check-built.ts`：

- import `manifestIds` 自 `@jjj/tripmd`，`dataDir` 自 `./lib/paths.ts`，`STAGE_DIR, stagePublic` 自 `./lib/stage-public.ts`。
- 构建之前：

```ts
const isPublic = process.argv.includes('--public')
if (isPublic) {
  console.log(dim('公开版：先生成抹除后的临时数据目录'))
  stagePublic(dataDir(), STAGE_DIR)
}
console.log(dim(`vite build --base=${BASE} → apps/web/dist-check${isPublic ? '（公开版）' : ''}`))
execSync(`pnpm --filter @jjj/web exec vite build --base=${BASE} --outDir dist-check`, {
  cwd: ROOT,
  stdio: ['ignore', 'ignore', 'inherit'],
  env: isPublic ? { ...process.env, JJJ_DATA_DIR: STAGE_DIR, VITE_PUBLIC: '1' } : process.env,
})
```

- 浏览器层：写死的 `seattle-2026-10` 换成产物 manifest 的第一份：

```ts
/** 产物里第一份入册行程 —— 公开版与完整版清单不同，不能写死 */
function firstTripId(): string | null {
  const path = join(OUT, 'data/manifest.json')
  if (!existsSync(path)) return null
  return manifestIds(JSON.parse(readFileSync(path, 'utf8')))[0] ?? null
}
```

`browserPass` 开头：`const tripId = firstTripId(); if (!tripId) { bad('产物 manifest 里没有任何行程，浏览器层无从验起'); return }`，`goto` 的 URL 用 `#/trip/${tripId}/map`。

- 公开版产物里不该有 ics：结构层加一条

```ts
if (isPublic) {
  const ics = readdirSync(join(OUT, 'data'), { recursive: true }).some((f) => String(f).endsWith('.ics'))
  if (ics) bad('公开版产物里有 calendar.ics —— 订阅是作者自己用的，不该发出去')
  else ok('公开版产物里没有 calendar.ics')
}
```

- [ ] **Step 4: 让本仓库有一份 public 行程可验**

`apps/web/public/data/seattle-2026-10/plan.md` frontmatter 末尾加一行 `visibility: public`（仓库本来就是公开的，标 public 不改变任何暴露面；`_showcase` 也要从它生成）。`pnpm data:check` 刷新 manifest。

- [ ] **Step 5: 跑**

Run: `pnpm build:public`
Expected: 打印 `✓ seattle-2026-10 已抹除`，可能有若干 `⚠ … 正文出现「…」` —— 逐条看：附录预算表 / 正文里的票价、班次号命中属预期，**结构块命中会直接 die**，那说明 sanitize 漏了，回 Task 5 修。产物在 `apps/web/dist-public`。

```bash
grep -c "待填\|price:\|cost:" apps/web/.public-data/seattle-2026-10/plan.md   # 期望 0（正文若有「待填」字样另算）
grep -n "^visibility\|trip-transports" -A 6 apps/web/.public-data/seattle-2026-10/plan.md | head -20
ls apps/web/dist-public/data apps/web/dist-public/data/seattle-2026-10
```

Expected：transports 块里每条只剩 `traveler / mode / to / arr_time / arr_date`（去程）或 `from / dep_time`（返程）；`dist-public/data` 只有 `manifest.json seattle-2026-10 space.md`，行程目录下只有 `plan.md geometry.json`。

Run: `pnpm check:built && pnpm check:built --public`
Expected: 两轮都 `✓ 构建产物里的地图正常`；公开版多一条 `✓ 公开版产物里没有 calendar.ics`；浏览器层 URL 走 `seattle-2026-10`。

- [ ] **Step 6: 公开版截图**

`pnpm --filter @jjj/web exec vite preview --outDir dist-public --port 4174`，Playwright 截 390px 深浅两套：首页（名片 + 一张卡，无「待订」）；列表页 Day 1「抵达」卡（两张票各只剩到达时刻 + 机场 + 乘客标签，**没有虚线框**）；Day 5 返程卡（只剩出发端）；住宿卡（无金额）；地图页（民宿针落在 Ashford 附近约 1 公里格点上，进出木屋那几段是虚线）；预算页（只剩事件散项）；资料页（无日历 chip）。肉眼过，异常就修。

- [ ] **Step 7: 交 commit 命令**

```bash
git add tools/lib/stage-public.ts tools/publish.ts tools/check-built.ts package.json apps/web/public/data/seattle-2026-10/plan.md apps/web/public/data/manifest.json
git commit -m "feature: pnpm build:public stages sanitized public trips and builds the same SPA"
```

---

### Task 9: `_showcase` 示范数据 + 测试改吃它

**Files:**
- Create: `tools/showcase.ts`
- Create（生成）: `apps/web/public/data/_showcase/plan.md`、`apps/web/public/data/_showcase/geometry.json`
- Modify: `package.json`
- Modify: `packages/tripmd/test/roundtrip.test.ts:16`
- Modify: `packages/tripmd/test/patch.test.ts:13`
- Modify: `apps/web/src/data/MarkdownTripRepository.ts:25`

**Interfaces:**
- Consumes: `sanitize` / `findLeaks` / `dataDir()` / `cli.ts`。
- Produces: 脚本 `showcase:refresh <dir>`；fixture `_showcase`（id `_showcase`，visibility public）。

`_showcase` 目前保持 `_` 前缀（dev-only、CI 从 dist 删掉），所以第 1 步线上零变化。迁移第 4 步把它改名成不带 `_` 的目录（如 `showcase-seattle-2026-10`，frontmatter id 同步改），工具仓库的 Pages 就变成演示站 —— 那一步只是一次 `git mv` + 一行 id，本计划不做。

- [ ] **Step 1: CLI**

```ts
#!/usr/bin/env tsx
/**
 * 从数据目录里的一份真行程重生成 _showcase —— 抹除后的公开版副本。
 *
 *   pnpm showcase:refresh seattle-2026-10
 *
 * 给 fork 的人看「真实规模的示范」，同时是 sanitize 的回归 fixture
 * （roundtrip / patch 测试吃它，第 4 步删掉真行程后测试不受影响）。
 * 重跑后 git diff 一眼看出抹没抹干净。id 改成 _showcase（目录名 = id 是首页路由的约定）。
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { findLeaks, formatDiagnostics, parse, sanitize, serialize } from '@jjj/tripmd'
import { bold, die, dim, green, yellow } from './lib/cli.ts'
import { ROOT, dataDir } from './lib/paths.ts'

const dir = process.argv[2]
if (!dir) die('用法：pnpm showcase:refresh <行程目录>')
const src = join(dataDir(), dir!)
const out = join(ROOT, 'apps/web/public/data/_showcase')
const mdPath = join(src, 'plan.md')
if (!existsSync(mdPath)) die(`找不到 ${dir}/plan.md`)

const { trip, diagnostics } = parse(readFileSync(mdPath, 'utf8'))
if (!trip) die(formatDiagnostics(`${dir}/plan.md`, diagnostics))

const clean = sanitize(trip!)
clean.id = '_showcase'
clean.subtitle = '公开示范 · 抹除敏感信息后的真实行程'
clean.visibility = 'public'
const md = serialize(clean)

const check = parse(md)
const errors = check.diagnostics.filter((d) => d.severity === 'error')
if (!check.trip || errors.length > 0) die(`抹除后解析不过：\n${formatDiagnostics('_showcase/plan.md', errors)}`)
const leaks = findLeaks(md, trip!)
const fatal = leaks.filter((l) => l.inFence)
if (fatal.length > 0) die(`结构块里仍有敏感值：${fatal.map((l) => `第 ${l.line} 行「${l.value}」`).join('，')}`)
for (const l of leaks) console.log(`${yellow('⚠')} 第 ${l.line} 行正文出现「${l.value}」${dim('—— 正文按设计不抹，确认这是你想公开的')}`)

mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'plan.md'), md)
const geo = join(src, 'geometry.json')
if (existsSync(geo)) cpSync(geo, join(out, 'geometry.json'))
console.log(`${green('✓')} ${bold('_showcase')} ${dim(`← ${dir}，${leaks.length} 处正文命中需过目`)}`)
```

`package.json` scripts 加：

```json
    "showcase:refresh": "tsx tools/showcase.ts",
```

- [ ] **Step 2: 生成并过目**

Run: `pnpm showcase:refresh seattle-2026-10 && pnpm data:check _showcase`
Expected: `✓ _showcase`；data:check 报路线若干条「坐标对不上」（木屋两端）—— 设计内。打开 `apps/web/public/data/_showcase/plan.md` 逐块过目：transports 只剩端点；stays / rentals 无 cost；地点表里木屋 coord 两位小数、无 en / note；正文命中的行逐条看一眼。

- [ ] **Step 3: 测试改吃 `_showcase`**

`roundtrip.test.ts`：`FIXTURES = ['seattle-2026-10', '_example', '_demo', '_showcase']`。
`patch.test.ts` 第 13 行：路径里 `seattle-2026-10` → `_showcase`（`arrival()` 按 category flight、`meal()` 按「午餐」定位，抹除不动事件）。跑一遍：若某条断言依赖 seattle 前置块里的真值（例如既有 transport 的 `number` / `price`、住宿的 `cost`），改成断言 `_showcase` 里仍存在的值（到达端时刻、`what` 名字），不要把真值抄回测试。
`MarkdownTripRepository.ts` 第 25 行：`ids.push('_demo')` → `ids.push('_demo', '_showcase')`，注释补一句「_showcase 是抹除后的示范，本地看公开版长什么样」。

- [ ] **Step 4: 关口**

Run: `pnpm typecheck && pnpm test && pnpm data:check && pnpm build`
Expected: 全绿，`Test Files 25 passed`（roundtrip 多 2 条）。`pnpm dev` 首页多出「西雅图 5 天 4 夜 · 公开示范」一张卡（dev-only）。

- [ ] **Step 5: 交 commit 命令**

```bash
git add tools/showcase.ts package.json apps/web/public/data/_showcase packages/tripmd/test/roundtrip.test.ts packages/tripmd/test/patch.test.ts apps/web/src/data/MarkdownTripRepository.ts
git commit -m "feature: _showcase fixture, the sanitized public copy of the real trip"
```

---

### Task 10: CI 关口、数据仓库工作流模板、发布文档

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Create: `templates/publish.yml`
- Create: `docs/PUBLISHING.md`

- [ ] **Step 1: 本仓库 CI 加关口（仍只发完整版）**

`deploy.yml` 在 `Run tests` 之后、`Build` 之前加：

```yaml
      # 公开版与地图产物的关口 —— 本仓库仍发完整版；公开版由数据仓库发，这里只保证它构得出、抹得净
      - name: Public build (gate only)
        run: pnpm build:public --base=/${{ github.event.repository.name }}/

      # 地图 worker 的历史坑要在两种产物上都重放（无 Chromium 时浏览器层明确报跳过）
      - name: Built-map gate, full and public
        run: pnpm check:built && pnpm check:built --public
```

`Strip dev-only fixtures` 步骤的名字改成 `Strip dev-only fixtures (_demo / _example / _broken / _showcase)`。

- [ ] **Step 2: 数据仓库工作流模板**

```yaml
# templates/publish.yml —— 复制到你的**数据仓库** .github/workflows/publish.yml
#
# 数据仓库布局：
#   trips/space.md            个人空间名片（+ 头像）
#   trips/<trip-id>/plan.md   行程（visibility: public 的进公开版）
#   trips/<trip-id>/geometry.json
#
# 推 main → 拉工具仓库（钉 tag）→ 校验 → 完整版 + 公开版两份产物
#   公开版 → 本仓库的 GitHub Pages（Settings → Pages → Source = GitHub Actions）
#   完整版 → Cloudflare Pages（wrangler 直传；Cloudflare Access 挡在前面）
# 不要完整站的话，删掉最后那一步即可。
name: Publish personal space

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

env:
  # 升级工具 = 改这一行（用工具仓库的 tag）
  JJJ_TOOL_REF: v0.2.0
  JJJ_DATA_DIR: ${{ github.workspace }}/trips

jobs:
  publish:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4

      - name: Check out the tool
        uses: actions/checkout@v4
        with:
          repository: HelloworldHarley/just-j-journey
          ref: ${{ env.JJJ_TOOL_REF }}
          path: tool

      - uses: pnpm/action-setup@v4
        with:
          package_json_file: tool/package.json

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          cache-dependency-path: tool/pnpm-lock.yaml

      - run: pnpm -C tool install --frozen-lockfile

      - name: Validate TripMD and space.md
        run: pnpm -C tool data:check

      # 完整版挂在 Cloudflare Pages 的根路径下
      - name: Build the full site
        run: pnpm -C tool build

      # 公开版挂在 https://<user>.github.io/<repo>/ 下
      - name: Build the public site
        run: pnpm -C tool build:public --base=/${{ github.event.repository.name }}/

      - uses: actions/configure-pages@v5

      - uses: actions/upload-pages-artifact@v3
        with:
          path: tool/apps/web/dist-public

      - id: deployment
        uses: actions/deploy-pages@v4

      # ── 完整版 → Cloudflare Pages（不要完整站就删掉这一步）──
      - name: Deploy the full site to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy tool/apps/web/dist --project-name=${{ vars.CF_PAGES_PROJECT }} --branch=main
```

- [ ] **Step 3: 发布文档**

`docs/PUBLISHING.md`，章节与内容：

1. **三个面** —— 工具仓库（公开、可 fork、只带示范数据）/ 私有数据仓库（`trips/` + `space.md`）/ 两条发布线（公开版 → 数据仓库 GitHub Pages；完整版 → Cloudflare Pages + Access）。一张表列三者各含什么、谁能看。
2. **本地怎么跑** —— `JJJ_DATA_DIR=../journeys/trips pnpm dev`、`pnpm data:check`、`pnpm build`、`pnpm build:public`、`pnpm check:built --public`；`visibility: public` 与 `space.md` 字段表。
3. **抹除规则速查** —— 从 spec 第一节抄表格（长途三类判定 / 住宿租车只抹 cost / 民宿模糊 / ics 不生成 / geometry 不重算 / 正文不抹）；正文里的命中只警告，怎么读 `⚠ 第 N 行正文出现「…」`。
4. **数据仓库怎么建**（迁移第 2 步）—— 私有仓库，名字即公开站 URL 段；目录布局；把 `templates/publish.yml` 复制过去、改 `JJJ_TOOL_REF`；Settings → Pages → Source = GitHub Actions；首次推送。
5. **Cloudflare 四步**（迁移第 3 步，逐条命令）：
   ```bash
   npx wrangler login
   npx wrangler pages project create <name> --production-branch main
   ```
   Zero Trust → Access → Applications → Add → Self-hosted：域名 `<name>.pages.dev`（含 `*.<name>.pages.dev` 预览域）；Policy Allow · Include · Emails（两人邮箱）；Authentication → 只留 One-time PIN；Session duration 30 天。API Token：Create Token → Custom → `Account · Cloudflare Pages · Edit`。数据仓库 Settings → Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`；Variables：`CF_PAGES_PROJECT=<name>`。手机浏览器登一次验证码。
6. **迁移顺序与回退点** —— spec 第三节的五步，每步「做什么 / 验什么 / 停在这里意味着什么」；第 4 步含 `_showcase` 改名与工具仓库 Pages 变演示站的提醒（**对外分享从第 4 步之后开始**）。
7. **验证清单** —— 公开站：首页名片、票面只剩一端、住宿卡无金额、民宿针模糊、无日历 chip、直链 `data/<id>/calendar.ics` 404；完整站：Access 登录页、登录后全量。

- [ ] **Step 4: 本地能跑的部分验一遍**

Run: `pnpm build:public --base=/just-j-journey/ && pnpm check:built --public`
Expected: 绿。模板 yml 用 `npx --yes yaml-lint templates/publish.yml` 或 `node -e "require('yaml').parse(require('fs').readFileSync('templates/publish.yml','utf8'))"`（`yaml` 已是 workspace 依赖，从 `packages/tripmd` 目录跑）确认是合法 YAML。

- [ ] **Step 5: 交 commit 命令**

```bash
git add .github/workflows/deploy.yml templates/publish.yml docs/PUBLISHING.md
git commit -m "chore: public build and built-map gates in CI, data-repo workflow template, publishing guide"
```

---

### Task 11: 文档收尾、全套关口、实现记录

**Files:**
- Modify: `docs/TRIPMD_SPEC.md:60-76`（Frontmatter）+ 新节
- Modify: `docs/AUTHORING_PROMPT.md:23-31`
- Modify: `CLAUDE.md`
- Modify: `docs/HANDOVER.md`
- Modify: `docs/superpowers/specs/2026-09-09-personal-space-sharing-design.md`（加「实现记录」）
- Modify: `.claude-home/memory/jjj-project-state.md`

- [ ] **Step 1: TRIPMD_SPEC**

Frontmatter 代码块 `currency` 之后加：

```yaml
visibility: public           # public 进公开版（抹过敏感信息）；private 只进完整版；缺省 private
```

「校验」一节之前新增：

```markdown
## 个人空间 `space.md`

数据目录根下一份 `space.md`，frontmatter 是名片，正文是自由 Markdown。首页从「行程列表」变成「个人主页」：名片在上，行程卡片在下。没有这份文件时首页显示工具默认头部。

```yaml
---
name: Harley                # 必需
handle: harley              # 可选 · 显示成 @handle
avatar: avatar.jpg          # 可选 · 相对 space.md 的路径
bio: 一句话简介              # 可选
links:                      # 可选
  - {label: 小红书, url: https://…}
tips:                       # 可选 · 打赏入口，有一项就在名片上长出「打赏」按钮
  - {label: 微信, image: tips/wechat.png}     # 二维码图片，相对 space.md
  - {label: Buy Me a Coffee, url: https://…}  # 或一个链接；image / url 二选一
---
自我介绍、怎么读这些攻略、免责声明……
```

## 公开版抹除

`pnpm build:public` 只收 `visibility: public` 的行程，每份过 `sanitize`：长途按首次引用落在哪一天判（首日只留到达端、末日只留出发端、中间日两端全留，其余票面字段全抹）；住宿 / 租车只抹 `cost`；`homestay` 地点坐标模糊到两位小数并删 `en` / `note`；事件卡、正文、附录一字不动；不生成 `calendar.ics`。规则与理由见 `docs/superpowers/specs/2026-09-09-personal-space-sharing-design.md`。
```

- [ ] **Step 2: AUTHORING_PROMPT**

frontmatter 示例 `currency` 之后加 `visibility: private            # 可选 · public 才进公开分享的版本`。

- [ ] **Step 3: CLAUDE.md**

- Commands 块加：
  ```bash
  pnpm build:public [--base=/x/]    # 公开版：public 行程过 sanitize → apps/web/dist-public（VITE_PUBLIC=1）
  pnpm check:built --public         # 同一关口跑公开版产物
  pnpm showcase:refresh <dir>       # 从数据目录里的真行程重生成 _showcase
  JJJ_DATA_DIR=/path/to/trips pnpm dev|data:check|build|build:public   # 数据目录换成别处
  ```
- Architecture 加一段 **Code / data split**：工具仓库只带示范数据；真实行程 + `space.md` 住私有数据仓库，靠 `JJJ_DATA_DIR`（vite 插件 `jjj:data-dir` 在 dev 代答、build 整份拷进 `dist/data`）；`manifest.json` 形状 `{trips:[{id, visibility}]}`；`sanitize` 白名单 + `findLeaks` 现算黑名单；`PUBLIC_BUILD` 是全站唯一读 `VITE_PUBLIC` 的地方；指向 `docs/PUBLISHING.md`。
- Fixtures 行加 `_showcase`（seattle 抹除后的公开版，roundtrip / patch 测试吃它）。
- Backlog 段：编辑模式里程碑 ③ 的写回目标是**数据仓库**；迁移第 2–5 步待 Harley 操作。

- [ ] **Step 4: HANDOVER**

「六、当前状态」新增「本轮（2026-09-09 · 个人空间与分享，迁移第 1 步）」：做了什么（按 Task 列）、测试基线新数字、第 2–5 步在 `docs/PUBLISHING.md`、`_showcase` 第 4 步改名的提醒、Harley 待办（建数据仓库、Cloudflare 四步）。第三节 Fixtures 行补 `_showcase` 与 `space.md`。

- [ ] **Step 5: spec 实现记录**

在 spec 末尾加 `## 实现记录（2026-09-09）`，逐条写偏差与理由：

1. 抹净断言的黑名单**从完整版 Trip 现算**（`sensitiveValues`），不写死 seattle 真值 —— 工具仓库公开，真值不能进测试；结构块命中致命、正文命中只警告（正文按设计不抹）。
2. 没被任何事件引用的长途 → `unreferenced`，只剩 traveler / mode（解析器本来就对它报警告）。
3. 单日行程首日 = 末日，按抵达处理。
4. `arr_date` 在抹除时**落成显式值**（`timelineDates` 派生），因为出发端抹掉后钟点回卷没了锚点。
5. `_showcase` 第 1 步保持 `_` 前缀（dev-only、线上零变化），第 4 步改名成不带 `_` 的目录才变成演示站内容。
6. 示范 `space.md` 的 bio 与旧首页口号一字不差，现有站首页只多出一枚 GitHub 链接。
7. manifest 形状改为对象数组；浏览器侧兼容旧的字符串数组（缓存里可能还有）。
8. `serialize.ts` 导出 `scalar` / `flowMap` 供 `serializeSpace` 复用，不再抄一份引号规则。
9. `tools/lib/cli.ts` / `paths.ts` 收敛了三个 CLI 各抄一份的颜色常量与 ROOT。
11. 民宿地点除了 spec 点名的 `en` / `note`，**`url` 与 `gmaps_place_id` 也抹**（审核发现：房源页和 place id 任何一个都能反查到门口，坐标模糊就白做了）；住宿 / 租车也改成逐字段白名单重拼，新字段默认不发。
12. 按 spec 原文，`dep_date` 在任何角色下都不留（离开端只剩 `from` + `dep_time`，日期由事件所在天派生）。
13. **残余面（不在 v1 范围，需 Harley 知道）**：`trip-constraints` 的 `label` / `note`、事件 `notes` / 正文 / `booking.note`、住宿租车的 `note` / `refund`、`Journey.what`、附录正文都原样进公开版 —— 写确认号、门牌进这些地方就会公开。
14. 合成 fixture 一开始混进了真行程的坐标 / 门牌 / 价格（审核抓出），已全部换成编造值；规则写进 fixture 上方：真行程里的任何值都不能进测试。
15. `findLeaks` 不自己数 ``` —— 直接吃 `lex()` 的 fence token（lexer 本来就分得清 trip-* 与普通代码块、`~~~`、围栏长度），计划里手写的开合翻转被审核指出会在附录里的示例代码块上失步；金额裸数字派生对千分位逗号友好（`"¥11,220"` → `"11,220"` 与 `"11220"`，不是 `"220"`）。
10. **新增需求（Harley，2026-09-09）：打赏。** `space.md` 的 `tips` 列表（`label` + `image` / `url` 二选一）→ 名片上的「打赏」chip → 底部抽屉。同时在 spec 第二节 `space.md` 的 yaml 示例里补 `tips` 两行，并在「已拍板的决定」表加一行「打赏 = 数据，住 space.md；二维码公开版照发」。

- [ ] **Step 6: 记忆**

更新 `.claude-home/memory/jjj-project-state.md`：分享功能第 1 步代码完成（日期 2026-09-09），基线测试数，下一步 = Harley 建数据仓库 + Cloudflare（`docs/PUBLISHING.md`），再之后编辑模式；`_showcase` 第 4 步改名。

- [ ] **Step 7: 全套关口 + 截图**

Run: `pnpm typecheck && pnpm test && pnpm data:check && pnpm build && pnpm build:public && pnpm check:built && pnpm check:built --public`
Expected: 全绿。Playwright 最终一轮：完整版（dev :5173）首页 + seattle Day 1 卡；公开版（`vite preview --outDir dist-public`）首页 + Day 1 卡 + 地图；均 390px × 深浅。对照 spec 第三节「验证」清单逐项打勾。

- [ ] **Step 8: 交 commit 命令（全部）**

```bash
git add docs CLAUDE.md
git commit -m "docs: publishing guide, TripMD visibility and space.md, sharing spec implementation notes"
```

Harley 若要一次提交整轮，改用：

```bash
git add -A
git commit -m "feature: personal space and public sharing build
- visibility frontmatter, space.md profile, configurable JJJ_DATA_DIR
- sanitize whitelist + leak scan, pnpm build:public, _showcase fixture
- public build hides author-only slots; CI gates; data-repo workflow template; publishing guide"
```

---

## 自查记录

**Spec 覆盖：** 第一节抹除规则 → Task 5（长途三类 / 住宿租车 / 民宿 / 事件不动）、Task 6（抹净断言）、Task 7（待填不画）、Task 8（ics 不生成、geometry 不重算）。第二节：visibility → Task 1；space.md → Task 3；JJJ_DATA_DIR → Task 4；两种产物 → Task 8；`_showcase` + `showcase:refresh` → Task 9；工作流模板 → Task 10。第三节：Cloudflare 配置与迁移顺序 → Task 10 文档（Harley 操作）；验证：sanitize 单测 + 负向对照（Task 5）、抹净断言（Task 6/8/9）、parseSpace 单测 + roundtrip（Task 3）、visibility 进 manifest（Task 1/2）、build:public 与 check:built --public 进 CI（Task 10）、截图（Task 8/11）。纯函数清单：sanitize / parseSpace / manifest / blurCoord / findLeaks 各有测试。与编辑模式的接缝 → Task 11 文档。

**类型一致性：** `ManifestEntry {id, visibility}` 在 Task 2/8/9 一致；`stagePublic(src, stage)` 与 `STAGE_DIR` 在 Task 8 定义、check-built 消费；`transportRole(firstRefDate, dates)` 四值枚举在 Task 5 定义与测试一致；`PUBLIC_BUILD` 在 Task 2 定义、Task 7/HomePage 消费；`getSpace()` 在 Task 3 接口与实现一致；`scalar` / `flowMap` 导出在 Task 3 Step 4，`space.ts` 消费。

**占位符：** 无 TBD；每个代码步骤都给了代码。Task 10 Step 3 的文档内容是章节级要求 + 命令，正文由执行者据 spec 写。
