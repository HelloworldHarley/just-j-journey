/**
 * 空状态和错误态。
 * 错误说清楚发生了什么和怎么修，不道歉、不含糊。空状态是一个邀请，不是一句抱歉。
 */
export function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-[13px] text-graphite" role="status">
      载入中…
    </div>
  )
}

export function Problem({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="mx-auto my-8 max-w-3xl rounded-lg border border-[var(--hairline)] px-5 py-4">
      <h2 className="display text-[15px] text-ink">{title}</h2>
      {detail && (
        <pre className="mt-2 whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-graphite">
          {detail}
        </pre>
      )}
    </div>
  )
}
