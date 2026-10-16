import { BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Shown only on devices whose engineer check passed. */
export function InspectedBadge({ label, className }: { label: string; className?: string }) {
    return (
        <span
        className={cn(
            'inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-primary/25',
            className,
        )}
        >
        <BadgeCheck className="size-3.5" aria-hidden="true" />
        {label}
        </span>
    )
    }