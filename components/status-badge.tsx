import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'warning' | 'success' | 'danger' | 'info'

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  warning: 'bg-warning/20 text-warning-foreground dark:text-warning',
  success: 'bg-success/15 text-success',
  danger: 'bg-destructive/12 text-destructive',
  info: 'bg-primary/12 text-primary',
}

const statusTone: Record<string, Tone> = {
  pending: 'warning',
  certified: 'success',
  approved: 'success',
  accepted: 'success',
  completed: 'info',
  rented: 'info',
  sold: 'info',
  donated: 'info',
  available: 'neutral',
  rejected: 'danger',
  cancelled_by_buyer: 'neutral',
}

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string
  label: string
  className?: string
}) {
  const tone = statusTone[status] ?? 'neutral'
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap',
        toneClasses[tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  )
}
