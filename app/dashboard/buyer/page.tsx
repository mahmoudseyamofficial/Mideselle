import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { BuyerCancelButton } from '@/components/request-actions'
import { requireRole } from '@/lib/auth'
import { formatDate, formatListingPrice, governorateName } from '@/lib/format'
import { getDictionary } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'
import type { Listing, MarketRequest } from '@/lib/types'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary()
  return { title: t.buyer.title }
}

type Row = MarketRequest & {
  listing: Listing | null
  validation_documents: { id: string; review_status: string }[]
}

export default async function BuyerDashboard() {
  const profile = await requireRole('buyer', '/dashboard/buyer')
  const [{ locale, t }, supabase] = await Promise.all([getDictionary(), createClient()])

  const { data } = await supabase
    .from('requests')
    .select('*, listing:listings(*), validation_documents(id, review_status)')
    .eq('buyer_id', profile.id)
    .order('created_at', { ascending: false })
  const requests = (data ?? []) as unknown as Row[]

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
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">
              <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                {r.listing?.photos[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.listing.photos[0]} alt="" className="size-full object-cover" />
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
                    {t.type[r.listing.type]} · {formatListingPrice(r.listing, locale, t, r.rent_period)} ·{' '}
                    {governorateName(r.listing.governorate, locale)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t.buyer.sentOn} {formatDate(r.created_at, locale)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={r.status} label={t.requestStatus[r.status]} />
                {r.validation_documents.map((d) => (
                  <StatusBadge
                    key={d.id}
                    status={d.review_status}
                    label={`${t.buyer.document}: ${t.reviewStatus[d.review_status as keyof typeof t.reviewStatus]}`}
                  />
                ))}
                {r.status === 'pending' && <BuyerCancelButton requestId={r.id} t={t} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
