import type { ReactNode } from 'react'

/**
 * 「居中正文 + 左侧导航轨」布局。
 *
 * 关键点：**侧栏不占正文的宽度。** 它绝对定位在居中列的左外侧，
 * 用的是本来就空着的页边距。这样列表页、资料页、顶部眉头三者的
 * 正文列宽度严格一致（max-w-3xl），加不加侧栏都不会变。
 *
 * 之前资料页把侧栏塞进内容流里，只好把容器放宽到 max-w-5xl，
 * 于是正文比列表页和眉头都宽 —— 三个页面对不齐。
 *
 * 页边距不够宽时（< xl）侧栏直接不显示，正文照常居中。
 */
export function RailLayout({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4">
      <div className="relative">
        <div className="absolute right-full top-0 hidden h-full w-[10rem] pr-7 xl:block">
          <div className="sticky top-[calc(var(--nav-h)+3.25rem)]">{rail}</div>
        </div>
        {children}
      </div>
    </div>
  )
}
