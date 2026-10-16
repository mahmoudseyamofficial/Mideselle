    import { cn } from '@/lib/utils'
    import { LOGISTICS_TEXT, stepsFor, type ShipmentLite } from '@/lib/logistics'

    /** Shows each delivery leg of a request with a small progress bar. Renders nothing when there are no shipments. */
    export function ShipmentTimeline({
    shipments,
    locale,
    }: {
    shipments: ShipmentLite[]
    locale: 'ar' | 'en'
    }) {
    const tx = LOGISTICS_TEXT[locale]
    const legs = [...shipments]
        .filter((s) => s.status !== 'cancelled')
        .sort((a, b) => a.created_at.localeCompare(b.created_at))

    if (legs.length === 0) return null

    return (
        <div className="flex flex-col gap-2 rounded-xl bg-muted/50 px-3 py-2.5 text-xs">
        <p className="font-medium">{tx.timelineTitle}</p>
        <ol className="flex flex-col gap-2.5">
            {legs.map((s) => {
            const steps = stepsFor(s.leg)
            const reached = steps.indexOf(s.status)
            const failed = s.status === 'failed'
            return (
                <li key={s.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                    <span>{tx.legs[s.leg]}</span>
                    <span className={cn('text-muted-foreground', failed && 'font-medium text-destructive')}>
                    {tx.status[s.status]}
                    </span>
                </div>
                <div className="flex gap-1" aria-hidden="true">
                    {steps.map((step, i) => (
                    <span
                        key={step}
                        className={cn(
                        'h-1.5 flex-1 rounded-full bg-muted',
                        !failed && i <= reached && 'bg-primary',
                        failed && 'bg-destructive/50',
                        )}
                    />
                    ))}
                </div>
                {s.tracking_number && (
                    <p className="text-muted-foreground">
                    {tx.trackingNo}: {s.tracking_number}
                    </p>
                )}
                </li>
            )
            })}
        </ol>
        </div>
    )
    }