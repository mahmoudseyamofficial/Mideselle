'use client'

import { PackagePlus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type Role = 'buyer' | 'seller'

export function RolePicker({
  t,
  value,
  onChange,
}: {
  t: Dictionary['auth']
  value: Role | null
  onChange: (role: Role) => void
}) {
  const options: { id: Role; title: string; body: string; Icon: typeof Search }[] = [
    { id: 'buyer', title: t.roleBuyer, body: t.roleBuyerDesc, Icon: Search },
    { id: 'seller', title: t.roleSeller, body: t.roleSellerDesc, Icon: PackagePlus },
  ]
  return (
    <div role="radiogroup" aria-label={t.chooseRole} className="flex flex-col gap-3">
      {options.map(({ id, title, body, Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={cn(
            'flex items-start gap-3 rounded-xl border bg-card p-4 text-start transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-ring',
            value === id && 'border-primary bg-primary/5 ring-2 ring-primary/30',
          )}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">{title}</span>
            <span className="text-sm text-muted-foreground text-pretty">{body}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
