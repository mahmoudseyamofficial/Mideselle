import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { SellerRequestActions } from '@/components/request-actions'
import { SellerWallet } from '@/components/seller-wallet'
import { requireRole } from '@/lib/auth'
import { formatDate, formatListingPrice, governorateName } from '@/lib/format'
import { getDictionary } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'
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
}

export default async function SellerDashboard() {
  const profile = await requireRole('seller', '/dashboard/seller')
  const [{ locale, t }, supabase] = await Promise.all([getDictionary(), createClient()])

  const [listingsRes, requestsRes, balanceRes, transactionsRes] = await Promise.all([
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
  ])

  const listings = (listingsRes.data ?? []) as Listing[]
  const requests = (requestsRes.data ?? []) as unknown as RequestRow[]
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
      />

      <section aria-labelledby="my-listings" className="flex flex-col gap-4">
        <h2 id="my-listings" className="text-xl font-semibold">
          {t.seller.listingsHeading}
        </h2>
        {listings.length === 0 ? (
          <p className="rounded-2xl border border-dashed py-12 text-center text-muted-foreground">
            {t.seller.noListings}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {listings.map((l) => {
              const used = l.availability !== 'available'
              return (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4"
                >
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {l.photos[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.photos[0]} alt="" className="size-full object-cover" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link href={`/listings/${l.id}`} className="truncate font-medium hover:underline">
                      {l.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {t.type[l.type]} · {formatListingPrice(l, locale, t)} ·{' '}
                      {governorateName(l.governorate, locale)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(countByListing.get(l.id) ?? 0).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en')}{' '}
                      {t.seller.requestsCount}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge
                      status={l.certification_status}
                      label={t.certification[l.certification_status]}
                    />
                    {used && <StatusBadge status={l.availability} label={t.availability[l.availability]} />}
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
            {requests.map((r) => (
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
                    {r.listing && r.listing.type !== 'donate' && (
                      <p className="text-sm font-medium">
                        {formatListingPrice(r.listing, locale, t, r.rent_period)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={r.status} label={t.requestStatus[r.status]} />
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
                <SellerRequestActions requestId={r.id} status={r.status} listingType={r.listing?.type} t={t} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
