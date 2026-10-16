import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { StatusBadge } from '@/components/status-badge'
import { DisputeEvidence, type DisputeCase } from '@/components/dispute-evidence'
import { DisputeResolveForm } from '@/components/dispute-resolve-form'
import { getCurrentProfile } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { getDictionary } from '@/lib/i18n/server'
import { RENTAL_TEXT } from '@/lib/rental-text'
import { createClient } from '@/lib/supabase/server'

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getDictionary()
  return { title: RENTAL_TEXT[locale].disputesTitle }
}

type DisputeRow = {
  id: string
  kind: keyof (typeof RENTAL_TEXT)['en']['kinds']
  reason: string
  status: 'open' | 'resolved'
  resolution_note: string | null
  created_at: string
  request: { id: string; listing: { id: string; title: string } | null } | null
}

export default async function DisputesPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const { locale, t } = await getDictionary()
  const x = RENTAL_TEXT[locale]
  const supabase = await createClient()
  const isAdmin = profile.role === 'admin'

  const { data } = await supabase
    .from('disputes')
    .select('id, kind, reason, status, resolution_note, created_at, request:requests(id, listing:listings(id, title))')
    .order('created_at', { ascending: false })
  const disputes = (data ?? []) as unknown as DisputeRow[]

  const cases = new Map<string, DisputeCase | null>(
    await Promise.all(
      disputes.map(async (d) => {
        const { data: c } = await supabase.rpc('dispute_case', { p_dispute_id: d.id })
        return [d.id, (c as DisputeCase | null) ?? null] as const
      }),
    ),
  )

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-semibold text-balance">{x.disputesTitle}</h1>

      {disputes.length === 0 ? (
        <p className="rounded-2xl border border-dashed py-14 text-center text-muted-foreground">{x.noDisputes}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {disputes.map((d) => {
            const c = cases.get(d.id) ?? null
            const failedCheck = c?.checks.find(
              (k) => k.trigger_type === 'post_rental_return' && k.status === 'failed' && !k.settled_at,
            )
            const remaining = c ? Math.max(c.deposit.held - c.deposit.returned - c.deposit.deducted, 0) : 0
            const feeApplies = d.kind === 'deduction_contested' && Boolean(failedCheck)
            const suggested = feeApplies ? Math.min(Number(failedCheck?.repair_cost ?? 0), remaining) : null

            return (
              <li key={d.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    {d.request?.listing && (
                      <Link href={`/listings/${d.request.listing.id}`} className="font-medium hover:underline">
                        {d.request.listing.title}
                      </Link>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {x.kinds[d.kind]} · {formatDate(d.created_at, locale)}
                    </p>
                  </div>
                  <StatusBadge status={d.status} label={d.status === 'open' ? x.statusOpen : x.statusResolved} />
                </div>

                <p className="rounded-xl bg-muted px-3 py-2 text-sm text-pretty">{d.reason}</p>

                {c && (
                  <details open={d.status === 'open'} className="rounded-xl border p-3">
                    <summary className="cursor-pointer text-sm font-medium">{x.evidenceTitle}</summary>
                    <div className="pt-3">
                      <DisputeEvidence data={c} locale={locale} t={t} isAdmin={isAdmin} />
                    </div>
                  </details>
                )}

                {d.status === 'resolved' && d.resolution_note && (
                  <p className="text-sm text-muted-foreground">
                    {x.resolution}: {d.resolution_note}
                  </p>
                )}
                {d.status === 'open' && isAdmin && (
                  <DisputeResolveForm
                    disputeId={d.id}
                    locale={locale}
                    remaining={remaining}
                    suggested={suggested}
                    feeApplies={feeApplies}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}