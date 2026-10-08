import type { ReactNode } from 'react'

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12 sm:py-16">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold text-balance">{title}</h1>
        <p className="text-muted-foreground text-pretty">{subtitle}</p>
      </div>
      <div className="rounded-2xl border bg-card p-6 shadow-sm">{children}</div>
    </main>
  )
}
