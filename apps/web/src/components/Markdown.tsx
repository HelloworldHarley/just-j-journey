import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * 行程正文的 Markdown 渲染。
 * 表格一律裹进自己的横向滚动容器 —— 页面本身永远不横向滚动。
 */
export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  if (!children.trim()) return null
  return (
    <div className={`prose-trip ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children: c }) => (
            <div className="table-scroll">
              <table>{c}</table>
            </div>
          ),
          a: ({ children: c, href }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {c}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
