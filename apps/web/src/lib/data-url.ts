/** 数据目录里的相对路径 → 浏览器 URL。头像、打赏二维码都从这里拼，与 MarkdownTripRepository 的 base 同源 */
export function dataUrl(rel: string): string {
  return `${import.meta.env.BASE_URL}data/${rel}`
}
