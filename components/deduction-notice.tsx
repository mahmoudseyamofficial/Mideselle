    import { OpenDisputeButton } from '@/components/open-dispute-button'
    import { formatEgp } from '@/lib/fees'
    import { RENTAL_TEXT } from '@/lib/rental-text'
    import type { Locale } from '@/lib/i18n/dictionaries'
    import Link from 'next/link'

    export type Deduction = {
    request_id: string
    check_id: string
    repair_cost: number | string
    inspection_fee: number | string | null
    findings: string | null
    evidence_url: string | null
    contest_until: string | null
    contested: boolean
    }

    export function DeductionNotice({ d, locale }: { d: Deduction; locale: Locale }) {
    const x = RENTAL_TEXT[locale]
    const stillOpen = d.contest_until ? new Date(d.contest_until).getTime() > Date.now() : false

    return (
        <div className="flex basis-full flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <p className="font-medium">{x.deductionTitle}</p>
        {d.findings && (
            <p className="text-pretty">
            {x.findings}: {d.findings}
            </p>
        )}
        <p>
            {x.repairCost}: {formatEgp(Number(d.repair_cost), locale)} · {x.inspectionFee}:{' '}
            {formatEgp(Number(d.inspection_fee ?? 0), locale)}
        </p>
        {d.evidence_url && (
            <Link href={d.evidence_url} target="_blank" rel="noopener noreferrer" className="w-fit text-primary hover:underline">
            {x.evidenceLink}
            </Link>
        )}
        {d.contested ? (
            <p className="text-muted-foreground">{x.contestUnderReview}</p>
        ) : stillOpen ? (
            <>
            <p className="text-muted-foreground">
                {x.contestUntil} {new Date(d.contest_until!).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en')}
            </p>
            <OpenDisputeButton requestId={d.request_id} kind="deduction_contested" locale={locale} />
            </>
        ) : (
            <p className="text-muted-foreground">{x.contestClosed}</p>
        )}
        </div>
    )
    }