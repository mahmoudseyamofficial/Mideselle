    import { formatEgp } from '@/lib/fees'
    import { formatDate } from '@/lib/format'
    import { LOGISTICS_TEXT, type ShipmentLeg, type ShipmentStatus } from '@/lib/logistics'
    import { RENTAL_TEXT } from '@/lib/rental-text'
    import type { Dictionary, Locale } from '@/lib/i18n/dictionaries'

    type Person = { name: string | null; email: string | null } | null

    export type DisputeCase = {
    listing: { id: string; title: string; photos: string[]; deposit: number | null }
    seller: Person
    buyer: Person
    request: { status: string; rental_period: string | null; rental_ends_at: string | null; created_at: string }
    opened_by: 'buyer' | 'seller'
    handover: {
        party: 'seller_handover' | 'buyer_receipt'
        photos: string[]
        condition_ok: boolean
        note: string | null
        confirmed_at: string
    }[]
    checks: {
        id: string
        trigger_type: string
        status: string
        cost: number | null
        details: string | null
        findings: string | null
        repair_cost: number | null
        evidence_url: string | null
        contest_until: string | null
        settled_at: string | null
        created_at: string
    }[]
    shipments: { leg: string; status: string; tracking_number: string | null; delivered_at: string | null }[]
    deposit: { held: number; returned: number; deducted: number }
    }

    function Photos({ title, photos, locale }: { title: string; photos: string[]; locale: Locale }) {
    const x = RENTAL_TEXT[locale]
    return (
        <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{title}</p>
        {photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">{x.noPhotos}</p>
        ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {photos.map((src) => (
                <li key={src} className="aspect-square overflow-hidden rounded-lg border bg-muted">
                <a href={src} target="_blank" rel="noopener noreferrer" aria-label={x.openPhoto}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="size-full object-cover" />
                </a>
                </li>
            ))}
            </ul>
        )}
        </div>
    )
    }

    export function DisputeEvidence({
    data,
    locale,
    t,
    isAdmin,
    }: {
    data: DisputeCase
    locale: Locale
    t: Dictionary
    isAdmin: boolean
    }) {
    const x = RENTAL_TEXT[locale]
    const tx = LOGISTICS_TEXT[locale]
    const handover = data.handover.find((h) => h.party === 'seller_handover')
    const receipt = data.handover.find((h) => h.party === 'buyer_receipt')
    const remaining = Math.max(data.deposit.held - data.deposit.returned - data.deposit.deducted, 0)

    // Names for everyone; email addresses only for the admin
    const person = (p: Person) =>
        !p ? '—' : isAdmin ? [p.name, p.email].filter(Boolean).join(' · ') : (p.name ?? '—')

    return (
        <div className="flex flex-col gap-5 text-sm">
        <div className="grid gap-1 sm:grid-cols-2">
            <p>
            <span className="text-muted-foreground">{x.partyOwner}:</span> {person(data.seller)}
            </p>
            <p>
            <span className="text-muted-foreground">{x.partyRenter}:</span> {person(data.buyer)}
            </p>
            <p>
            <span className="text-muted-foreground">{x.openedBy}:</span>{' '}
            {data.opened_by === 'buyer' ? x.partyRenter : x.partyOwner}
            </p>
            <p>
            <span className="text-muted-foreground">{x.rentalStart}:</span> {formatDate(data.request.created_at, locale)}
            {data.request.rental_ends_at && (
                <>
                {' · '}
                <span className="text-muted-foreground">{x.rentalEnds}:</span>{' '}
                {formatDate(data.request.rental_ends_at, locale)}
                </>
            )}
            </p>
        </div>

        <Photos title={x.advertisedPhotos} photos={data.listing.photos ?? []} locale={locale} />
        <Photos title={x.handoverPhotos} photos={handover?.photos ?? []} locale={locale} />
        <Photos title={x.receiptPhotos} photos={receipt?.photos ?? []} locale={locale} />
        {receipt && (
            <p>
            <span className="text-muted-foreground">{x.receiptCondition}:</span>{' '}
            {receipt.condition_ok ? x.receiptOk : x.receiptProblem}
            {receipt.note ? ` · ${receipt.note}` : ''}
            </p>
        )}

        {data.checks.length > 0 && (
            <div className="flex flex-col gap-2">
            <p className="font-medium">{x.inspectionSection}</p>
            <ul className="flex flex-col gap-2">
                {data.checks.map((c) => (
                <li key={c.id} className="flex flex-col gap-1 rounded-xl border p-3">
                    <p>
                    {t.checks.trigger[c.trigger_type as keyof typeof t.checks.trigger] ?? c.trigger_type}
                    {' · '}
                    {t.checks.status[c.status as keyof typeof t.checks.status] ?? c.status}
                    {' · '}
                    {formatDate(c.created_at, locale)}
                    </p>
                    {c.details && <p className="text-muted-foreground text-pretty">{c.details}</p>}
                    {c.findings && (
                    <p className="text-pretty">
                        {x.findings}: {c.findings}
                    </p>
                    )}
                    {c.status === 'failed' && (
                    <p>
                        {x.repairCost}: {formatEgp(Number(c.repair_cost ?? 0), locale)} · {x.inspectionFee}:{' '}
                        {formatEgp(Number(c.cost ?? 0), locale)}
                    </p>
                    )}
                    {c.evidence_url && (
                    <a href={c.evidence_url} target="_blank" rel="noopener noreferrer" className="w-fit text-primary hover:underline">
                        {x.evidenceLink}
                    </a>
                    )}
                </li>
                ))}
            </ul>
            </div>
        )}

        {data.shipments.length > 0 && (
            <div className="flex flex-col gap-1">
            <p className="font-medium">{x.shipmentsSection}</p>
            {data.shipments.map((s, i) => (
                <p key={i} className="text-muted-foreground">
                {tx.legs[s.leg as ShipmentLeg] ?? s.leg} · {tx.status[s.status as ShipmentStatus] ?? s.status}
                {s.delivered_at ? ` · ${formatDate(s.delivered_at, locale)}` : ''}
                </p>
            ))}
            </div>
        )}

        <div className="flex flex-col gap-1">
            <p className="font-medium">{x.depositSection}</p>
            <p>
            {x.depositHeld}: {formatEgp(data.deposit.held, locale)} · {x.depositReturned}:{' '}
            {formatEgp(data.deposit.returned, locale)} · {x.depositDeducted}: {formatEgp(data.deposit.deducted, locale)}
            </p>
            <p className="font-medium">
            {x.depositRemaining}: {formatEgp(remaining, locale)}
            </p>
        </div>
        </div>
    )
    }