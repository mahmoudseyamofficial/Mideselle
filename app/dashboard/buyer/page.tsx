import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { BuyerCancelButton, BuyerProposalActions } from '@/components/request-actions'
import { HandoverButton } from '@/components/handover-dialog'
import { requireRole } from '@/lib/auth'
import { formatEgp } from '@/lib/fees'
import { formatDate, formatListingPrice, governorateName } from '@/lib/format'
import { getDictionary } from '@/lib/i18n/server'
import { RENTAL_TEXT } from '@/lib/rental-text'
import { createClient } from '@/lib/supabase/server'
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries'
import { ShipmentTimeline } from '@/components/shipment-timeline'
import type { ShipmentLite } from '@/lib/logistics'
import type { Listing, MarketRequest } from '@/lib/types'
import Image from 'next/image'
import { DeductionNotice, type Deduction } from '@/components/deduction-notice'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary()
  return { title: t.buyer.title }
}

type Row = MarketRequest & {
  listing: Listing | null
  validation_documents: { id: string; review_status: string }[]
  shipments: ShipmentLite[]
}

/** Status text for a request row, from the buyer's point of view. */
function requestStatusLabel(r: Row, t: Dictionary, locale: Locale) {
  const extra = (RENTAL_TEXT[locale].statusExtra as Record<string, string>)[r.status]
  if (extra) return extra
  if (r.returned_at) return t.requestStatus.returned
  if (r.status === 'completed' && r.listing) {
    if (r.listing.type === 'sell') return t.buyer.completedSell
    if (r.listing.type === 'donate') return t.buyer.completedDonate
    return t.buyer.completedRent
  }
  return t.requestStatus[r.status as keyof typeof t.requestStatus] ?? r.status
}

/** Price text for one request: only the period the buyer chose, never all options. */
function requestPrice(r: Row, listing: Listing, locale: Locale, t: Dictionary) {
  if (r.rental_period === 'custom') {
    const duration = r.custom_duration_text ?? ''
    return r.proposed_price
      ? `${formatEgp(r.proposed_price, locale)} · ${duration}`
      : `${duration} · ${t.request.awaitingPrice}`
  }
  if (
    listing.type === 'rent' &&
    (r.rental_period === 'weekly' || r.rental_period === 'monthly') &&
    !(r.rental_period === 'weekly' ? listing.rent_weekly_price : listing.rent_monthly_price)
  ) {
    return '—'
  }
  return formatListingPrice(listing, locale, t, r.rental_period)
}

export default async function BuyerDashboard() {
  const profile = await requireRole('buyer', '/dashboard/buyer')
  const [{ locale, t }, supabase] = await Promise.all([getDictionary(), createClient()])

  const { data, error } = await supabase
    .from('requests')
    .select('*, listing:listings(*), validation_documents(id, review_status)')
    .eq('buyer_id', profile.id)
    .order('created_at', { ascending: false })
  if (error) console.error('[buyer dashboard] requests query failed:', error.message)
  const baseRequests = (data ?? []) as unknown as Omit<Row, 'shipments'>[]
  const requestIds = baseRequests.map((r) => r.id)

  // Delivery info is optional: if this query fails, the list of requests still shows
  const { data: shipmentData } = requestIds.length
    ? await supabase
        .from('shipments')
        .select('id, request_id, leg, status, tracking_number, created_at, delivered_at')
        .in('request_id', requestIds)
    : { data: [] }
  const shipments = (shipmentData ?? []) as unknown as (ShipmentLite & { request_id: string })[]
  const requests: Row[] = baseRequests.map((r) => ({
    ...r,
    shipments: shipments.filter((s) => s.request_id === r.id),
  }))

  // Which rentals the renter has already confirmed receipt for
  const { data: handoverData } = requestIds.length
    ? await supabase.from('handover_confirmations').select('request_id, party').in('request_id', requestIds)
    : { data: [] }
  const receipts = new Set(
    ((handoverData ?? []) as { request_id: string; party: string }[])
      .filter((h) => h.party === 'buyer_receipt')
      .map((h) => h.request_id),
  )

  const { data: deductionData } = await supabase.rpc('my_pending_deductions')
const deductions = new Map(((deductionData ?? []) as Deduction[]).map((d) => [d.request_id, d]))

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-balance">{t.buyer.title}</h1>
        <p className="text-muted-foreground text-pretty">{t.buyer.subtitle}</p>
      </div>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed py-16 text-center">
          <p className="text-muted-foreground">{t.buyer.empty}</p>
          <Link href="/listings" className={buttonVariants({ size: 'lg' })}>
            {t.buyer.browse}
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((r) => {
            const answerProposal = r.status === 'pending_buyer_acceptance'
            const confirmReceipt =
              r.listing?.type === 'rent' && r.status === 'completed' && !receipts.has(r.id)

            return (
              <li key={r.id} className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">
                <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {r.listing?.photos[0] && (
                    <Image 
                    src={r.listing.photos[0]} 
                    width={1000}
                    height={1000}
                    alt="" 
                    className="size-full object-cover" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {r.listing ? (
                    <Link href={`/listings/${r.listing.id}`} className="truncate font-medium hover:underline">
                      {r.listing.title}
                    </Link>
                  ) : null}
                  {r.listing && (
                    <p className="text-sm text-muted-foreground">
                      {t.type[r.listing.type]} · {requestPrice(r, r.listing, locale, t)} ·{' '}
                      {governorateName(r.listing.governorate, locale)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t.buyer.sentOn} {formatDate(r.created_at, locale)}
                  </p>
                  <ShipmentTimeline shipments={r.shipments ?? []} locale={locale} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={r.status} label={requestStatusLabel(r, t, locale)} />
                  {r.validation_documents.map((d) => (
                    <StatusBadge
                      key={d.id}
                      status={d.review_status}
                      label={`${t.buyer.document}: ${t.reviewStatus[d.review_status as keyof typeof t.reviewStatus]}`}
                    />
                  ))}
                  {r.status === 'pending' && <BuyerCancelButton requestId={r.id} t={t} />}
                </div>

                {(answerProposal || confirmReceipt) && (
                  <div className="flex basis-full flex-wrap items-start gap-2">
                    {answerProposal && <BuyerProposalActions requestId={r.id} t={t} />}
                    {confirmReceipt && <HandoverButton requestId={r.id} party="buyer_receipt" locale={locale} />}
                  </div>
                )}
                {deductions.get(r.id) && <DeductionNotice d={deductions.get(r.id)!} locale={locale} />}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}