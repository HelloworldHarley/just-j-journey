import type { Visibility } from '@jjj/schema'

/**
 * 首页「公开 / 私有」开关的接口契约 —— 浏览器（MarkdownTripRepository）与 dev 服务器
 * （vite 插件 jjj:data）两头共用这一份，路径与请求体的形状只在这里定义。
 * 路径相对 BASE_URL；只有 dev 服务器实现它，线上静态托管没有这个端点。
 */
export const VISIBILITY_ENDPOINT = 'api/visibility'

export interface VisibilityRequest {
  id: string
  visibility: Visibility
}
