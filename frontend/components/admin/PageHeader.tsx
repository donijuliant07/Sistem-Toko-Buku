import React from "react"

interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-zinc-200/80">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 font-normal leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-2.5 shrink-0">{action}</div>}
    </div>
  )
}
