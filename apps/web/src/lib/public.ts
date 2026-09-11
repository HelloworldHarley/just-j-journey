/**
 * 公开构建（`pnpm build:public`，VITE_PUBLIC=1）—— 给别人看的版本。
 * 缺的字段不画「待填」、不画待订数、不提供日历订阅：那些都是给作者的提醒。
 * 全站只在这里读环境变量，组件只认这个布尔值。
 */
export const PUBLIC_BUILD = import.meta.env['VITE_PUBLIC'] === '1'
