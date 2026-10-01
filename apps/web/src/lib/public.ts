/**
 * 公开构建（`pnpm build:public` / `pnpm look --public`，VITE_PUBLIC=1）—— 给别人看的版本。
 * 全站只在这里读环境变量，组件只认下面的布尔值与谓词。
 *
 * 两类作者专用的东西公开版不画：
 *   1. **待办**：待订数与「待订」角标、航班空骨架、缺坐标 chip、日历订阅、公开 / 私有开关 —— 各处按 PUBLIC_BUILD 判
 *   2. **空槽**：票面 / 住宿 / 租车卡上缺值的格子。完整版画虚线「待填」提醒作者，公开版缺就是缺，
 *      整格不画（连标签、图标一起）—— 这条规矩只在 showsField 里写一次
 */
export const PUBLIC_BUILD = import.meta.env['VITE_PUBLIC'] === '1'

/** 完整版给缺值留「待填」槽；公开版不留 */
export const SHOW_EMPTY_SLOTS = !PUBLIC_BUILD

/** 这一格画不画：有值总画；没值只有完整版画（待填槽） */
export function showsField(value: string | undefined, showEmpty = SHOW_EMPTY_SLOTS): boolean {
  return Boolean(value) || showEmpty
}

/** 一组「标签 + 值」里要画的那些 —— 容器据此决定整行 / 整栏要不要出现 */
export function shownTerms<T extends { value?: string | undefined }>(terms: readonly T[], showEmpty = SHOW_EMPTY_SLOTS): T[] {
  return terms.filter((t) => showsField(t.value, showEmpty))
}
