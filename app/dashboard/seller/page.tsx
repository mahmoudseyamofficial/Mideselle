import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ImageOff, MapPin, MessageSquare, Pencil, Plus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { SellerRequestActions } from '@/components/request-actions'
import { SellerWallet } from '@/components/seller-wallet'
import { requireRole } from '@/lib/auth'
import { formatEgp } from '@/lib/fees'
import { formatDate, formatListingPrice, governorateName } from '@/lib/format'
import { getDictionary } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { ShipmentTimeline } from '@/components/shipment-timeline'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { ShipmentLite } from '@/lib/logistics'
import type { Listing, MarketRequest, WalletTransaction } from '@/lib/types'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary()
  return { title: t.seller.title }
}

type RequestRow = MarketRequest & {
  listing: Pick<
    Listing,
    'id' | 'title' | 'type' | 'price' | 'rent_weekly_price' | 'rent_monthly_price'
  > | null
  buyer: { full_name: string | null; email: string } | null
  validation_documents: { id: string; review_status: string }[]
  shipments: ShipmentLite[]
}

type CheckRow = {
  id: string
  related_request_id: string | null
  trigger_type: string
  status: string
  cost: number | null
  charged_to: string | null
  created_at: string
  listing: { title: string; seller_id: string } | null
}

/** Status text for a request row, from the seller's point of view. */
function requestStatusLabel(r: RequestRow, t: Dictionary) {
  if (r.returned_at) return t.requestStatus.returned
  if (r.status === 'completed' && r.listing) {
    // "completed" means sold, donated or handed over for rent, depending on the listing
    if (r.listing.type === 'sell') return t.seller.completedSell
    if (r.listing.type === 'donate') return t.seller.completedDonate
    return t.seller.completedRent
  }
  return t.requestStatus[r.status as keyof typeof t.requestStatus] ?? r.status
}

export default async function SellerDashboard() {
  const profile = await requireRole('seller', '/dashboard/seller')
  const [{ locale, t }, supabase] = await Promise.all([getDictionary(), createClient()])

  const [listingsRes, requestsRes, balanceRes, transactionsRes, checksRes] = await Promise.all([
    supabase
      .from('listings')
      .select('*')
      .eq('seller_id', profile.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('requests')
      .select(
        '*, listing:listings!inner(id, title, seller_id, type, price, rent_weekly_price, rent_monthly_price), buyer:users!requests_buyer_id_fkey(full_name, email), validation_documents(id, review_status)',
      )
      .eq('listing.seller_id', profile.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('wallet_balances')
      .select('balance')
      .eq('user_id', profile.id)
      .maybeSingle(),
    supabase
      .from('wallet_transactions')
      .select('id, user_id, type, amount, related_request_id, related_check_id, created_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('checks')
      .select('*, listing:listings!inner(title, seller_id)')
      .eq('listing.seller_id', profile.id)
      .order('created_at', { ascending: false }),
  ])

  const listings = (listingsRes.data ?? []) as Listing[]
  if (requestsRes.error) console.error('[seller dashboard] requests query failed:', requestsRes.error.message)
  const baseRequests = (requestsRes.data ?? []) as unknown as Omit<RequestRow, 'shipments'>[]

  // Delivery info is optional: if this query fails, the list of requests still shows
  const { data: shipmentData } = baseRequests.length
    ? await supabase
        .from('shipments')
        .select('id, request_id, leg, status, tracking_number, created_at, delivered_at')
        .in('request_id', baseRequests.map((r) => r.id))
    : { data: [] }
  const shipments = (shipmentData ?? []) as unknown as (ShipmentLite & { request_id: string })[]
  const requests: RequestRow[] = baseRequests.map((r) => ({
    ...r,
    shipments: shipments.filter((s) => s.request_id === r.id),
  }))
  const checks = (checksRes.data ?? []) as unknown as CheckRow[]
  // The checks come newest first, so the first one seen for a request is its latest return check
  const returnCheckByRequest = new Map<string, string>()
  for (const c of checks) {
    if (c.trigger_type === 'post_rental_return' && c.related_request_id && !returnCheckByRequest.has(c.related_request_id)) {
      returnCheckByRequest.set(c.related_request_id, c.status)
    }
  }
  const walletBalance = balanceRes.error ? null : Number(balanceRes.data?.balance ?? 0)
  const walletTransactions = (transactionsRes.data ?? []) as WalletTransaction[]
  const walletHasError = Boolean(balanceRes.error || transactionsRes.error)
  const countByListing = new Map<string, number>()
  for (const r of requests) countByListing.set(r.listing_id, (countByListing.get(r.listing_id) ?? 0) + 1)

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-balance">{t.seller.title}</h1>
          <p className="text-muted-foreground text-pretty">{t.seller.subtitle}</p>
        </div>
        <Link href="/listings/new" className={buttonVariants({ size: 'lg' })}>
          <Plus data-icon="inline-start" aria-hidden="true" />
          {t.seller.newListing}
        </Link>
      </div>

      <SellerWallet
            balance={walletBalance}
            transactions={walletTransactions}
            hasError={walletHasError}
            locale={locale}
            t={t}
            uncoveredFeeCheckIds={checks
              .filter((c) => c.status === 'failed' && c.charged_to === 'buyer')
              .map((c) => c.id)}
          />

      <section aria-labelledby="my-listings" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 id="my-listings" className="text-xl font-semibold">
            {t.seller.listingsHeading}
          </h2>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {listings.length.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en')}
          </span>
        </div>

        {listings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card/50 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ImageOff className="size-5" aria-hidden="true" />
            </span>
            <p className="text-muted-foreground">{t.seller.noListings}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {listings.map((l) => {
              const used = l.availability !== 'available'
              const requestCount = (countByListing.get(l.id) ?? 0).toLocaleString(
                locale === 'ar' ? 'ar-EG' : 'en',
              )
              return (
                <li
                  key={l.id}
                  className="group relative grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 rounded-2xl border bg-card p-3 transition-all hover:border-primary/40 hover:shadow-md sm:grid-cols-[auto_1fr_auto] sm:p-4"
                >
                  {/* Thumbnail */}
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted sm:size-24">
                    {l.photos[0] ? (
                      <Image
                        src={l.photos[0]}
                        alt=""
                        fill
                        sizes="96px"
                        className={cn(
                          'object-cover transition-transform duration-300 group-hover:scale-105',
                          used && 'opacity-60 grayscale',
                        )}
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <ImageOff className="size-6" aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Link
                      href={`/listings/${l.id}`}
                      className="truncate font-semibold transition-colors after:absolute after:inset-0 after:rounded-2xl group-hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {l.title}
                    </Link>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {t.type[l.type]}
                      </span>
                      <span className="font-semibold text-primary">{formatListingPrice(l, locale, t)}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3.5" aria-hidden="true" />
                        {governorateName(l.governorate, locale)}
                      </span>
                    </div>

                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MessageSquare className="size-3.5" aria-hidden="true" />
                      {requestCount} {t.seller.requestsCount}
                    </p>
                  </div>

                  {/* Status badges + edit */}
                  <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:flex-col sm:items-end">
                    <StatusBadge
                      status={l.certification_status}
                      label={t.certification[l.certification_status]}
                    />
                    {used && <StatusBadge status={l.availability} label={t.availability[l.availability]} />}
                    {/* relative z-10 keeps the button clickable above the card's stretched title link */}
                    {l.availability === 'available' && (
                      <Link
                        href={`/listings/${l.id}/edit`}
                        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'relative z-10')}
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                        {t.newListing.editTitle}
                      </Link>
                    )}
                    {/* Rented: editing is locked until the device is returned */}
                    {l.availability === 'rented' && (
                      <>
                        <button
                          type="button"
                          disabled
                          title={t.seller.editLocked}
                          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'relative z-10')}
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                          {t.newListing.editTitle}
                        </button>
                        <span className="text-xs text-muted-foreground sm:text-end">{t.seller.editLocked}</span>
                      </>
                    )}
                    {/* Sold or donated: no edit button at all */}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="incoming" className="flex flex-col gap-4">
        <h2 id="incoming" className="text-xl font-semibold">
          {t.seller.requestsHeading}
        </h2>
        {requests.length === 0 ? (
          <p className="rounded-2xl border border-dashed py-12 text-center text-muted-foreground">
            {t.seller.noRequests}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((r) => {
              const isRent = r.listing?.type === 'rent'

              // What the buyer asked for: only their chosen period, never all options
              const periodText =
                r.rental_period === 'weekly'
                  ? t.listings.weekly
                  : r.rental_period === 'monthly'
                    ? t.listings.monthly
                    : r.rental_period === 'custom'
                      ? `${t.request.moreThanMonth}${r.custom_duration_text ? ` · ${r.custom_duration_text}` : ''}`
                      : null

              // Price for that period. Custom requests have no listed price; show the owner's quote once it exists.
              const priceText =
                !r.listing || r.listing.type === 'donate'
                  ? null
                  : r.rental_period === 'custom'
                    ? r.proposed_price
                      ? formatEgp(r.proposed_price, locale)
                      : null
                    : r.listing.type === 'rent' &&
                        (r.rental_period === 'weekly' || r.rental_period === 'monthly') &&
                        !(r.rental_period === 'weekly' ? r.listing.rent_weekly_price : r.listing.rent_monthly_price)
                      ? null // the owner later removed this period's price; never show "Free" for a rental
                      : formatListingPrice(r.listing, locale, t, r.rental_period)

              return (
                <li key={r.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm text-muted-foreground">
                        {t.seller.for} <span className="font-medium text-foreground">{r.listing?.title}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t.seller.from}{' '}
                        <span className="font-medium text-foreground">
                          {r.buyer?.full_name || r.buyer?.email}
                        </span>{' '}
                        · {formatDate(r.created_at, locale)}
                      </p>
                      {isRent && periodText && (
                        <p className="flex flex-wrap items-center gap-2 pt-0.5 text-sm">
                          <span className="text-muted-foreground">{t.request.rentalPeriod}:</span>
                          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                            {periodText}
                          </span>
                        </p>
                      )}
                      {priceText && <p className="text-sm font-medium">{priceText}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge
                        status={r.status}
                        label={requestStatusLabel(r, t)}
                      />
                      {r.validation_documents.map((d) => (
                        <StatusBadge
                          key={d.id}
                          status={d.review_status}
                          label={`${t.seller.document}: ${t.reviewStatus[d.review_status as keyof typeof t.reviewStatus]}`}
                        />
                      ))}
                    </div>
                  </div>
                  {r.message && (
                    <p className="rounded-xl bg-muted px-3 py-2 text-sm text-pretty">{r.message}</p>
                  )}
                  <ShipmentTimeline shipments={r.shipments ?? []} locale={locale} />
                  <SellerRequestActions
                    requestId={r.id}
                    listingId={r.listing_id}
                    status={r.status}
                    listingType={r.listing?.type}
                    returnedAt={r.returned_at}
                    returnCheck={returnCheckByRequest.get(r.id) ?? null}
                    deviceBack={r.shipments.some((s) => s.leg === 'hub_to_seller' && s.status === 'delivered')}
                    t={t}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="checks" className="flex flex-col gap-4">
        <h2 id="checks" className="text-xl font-semibold">
          {t.seller.checksHeading}
        </h2>
        {checks.length === 0 ? (
          <p className="rounded-2xl border border-dashed py-12 text-center text-muted-foreground">
            {t.seller.noChecks}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {checks.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-card p-4"
              >
                <div className="flex flex-col gap-1">
                  <p className="font-medium">{c.listing?.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.checks.trigger[c.trigger_type as keyof typeof t.checks.trigger] ?? c.trigger_type}
                    {' · '}
                    {formatDate(c.created_at, locale)}
                  </p>
                  {c.cost != null && (
                    <p className="text-sm">
                      {formatEgp(c.cost, locale)}
                      {c.charged_to &&
                        ` · ${t.checks.chargedTo}: ${t.checks.party[c.charged_to as 'buyer' | 'seller']}`}
                    </p>
                  )}
                </div>
                <StatusBadge
                  status={c.status}
                  label={t.checks.status[c.status as keyof typeof t.checks.status] ?? c.status}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}