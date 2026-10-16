import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/status-badge'
import { AdminDocumentActions, AdminListingActions } from '@/components/request-actions'
import { AdminCheckActions } from '@/components/device-check-dialog'
import { AdminTransactions, type TxRow } from '@/components/admin-transactions'
import { RENTAL_TEXT } from '@/lib/rental-text'
import Image from 'next/image'
import { PostRentalCheckForm } from '@/components/post-rental-check-form'
import { ReturnCheckForm } from '@/components/return-check-form'
import {
  AdvanceShipmentButtons,
  BookShipmentForm,
  CloseRequestButton,
  CompleteRequestButton,
} from '@/components/logistics-admin'
import { requireRole } from '@/lib/auth'
import { formatDate, formatListingPrice, governorateName } from '@/lib/format'
import { getDictionary } from '@/lib/i18n/server'
import { LOGISTICS_TEXT, type ShipmentFull, type ShipmentLeg } from '@/lib/logistics'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import type { Listing } from '@/lib/types'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary()
  return { title: t.admin.title }
}

type PendingListing = Listing & { seller: { full_name: string | null; email: string } | null }
type PendingDoc = {
  id: string
  file_url: string
  created_at: string
  request: {
    buyer: { full_name: string | null; email: string } | null
    listing: { id: string; title: string } | null
  } | null
}

type Person = { full_name: string | null; email: string } | null
type CheckLite = {
  id: string
  trigger_type: string
  status: string
  cost: number | null
  details: string | null
  created_at: string
}
type LogisticsRequest = {
  id: string
  status: string
  created_at: string
  listing: { id: string; title: string; type: string; seller: Person } | null
  buyer: Person
  checks: CheckLite[]
  shipments: ShipmentFull[]
}

type Step =
  | { kind: 'book'; leg: ShipmentLeg }
  | { kind: 'advance' } // the buttons sit on the shipment rows
  | { kind: 'check'; checkId: string; returnCheck: boolean }
  | { kind: 'complete' }
  | { kind: 'close' }
  | { kind: 'wait' }

const byNewest = <T extends { created_at: string }>(a: T, b: T) => b.created_at.localeCompare(a.created_at)

/** What the admin has to do next for a request that went through the check flow. */
function nextStep(r: LogisticsRequest): Step {
  const live = (leg: ShipmentLeg) =>
    r.shipments.find((s) => s.leg === leg && s.status !== 'failed' && s.status !== 'cancelled')
  const check = [...r.checks].sort(byNewest)[0]

  // A rental that has come to an end: renter -> company, check, company -> owner
  if (check?.trigger_type === 'post_rental_return') {
    const fromRenter = live('buyer_to_hub')
    const backToOwner = live('hub_to_seller')
    if (!fromRenter) return { kind: 'book', leg: 'buyer_to_hub' }
    if (fromRenter.status !== 'received_at_hub') return { kind: 'advance' }
    if (check.status === 'pending') return { kind: 'check', checkId: check.id, returnCheck: true } 
    if (!backToOwner) return { kind: 'book', leg: 'hub_to_seller' }
    if (backToOwner.status !== 'delivered') return { kind: 'advance' }
    return { kind: 'wait' }
  }

  const toHub = live('seller_to_hub')
  const toBuyer = live('hub_to_buyer')
  const backToSeller = live('hub_to_seller')

  if (!toHub) return { kind: 'book', leg: 'seller_to_hub' }
  if (toHub.status !== 'received_at_hub') return { kind: 'advance' }
  if (!check) return { kind: 'wait' }
  if (check.status === 'pending') return { kind: 'check', checkId: check.id, returnCheck: false }

  if (check.status === 'passed') {
    if (!toBuyer) return { kind: 'book', leg: 'hub_to_buyer' }
    if (toBuyer.status !== 'delivered') return { kind: 'advance' }
    return { kind: 'complete' }
  }

  if (!backToSeller) return { kind: 'book', leg: 'hub_to_seller' }
  if (backToSeller.status !== 'delivered') return { kind: 'advance' }
  return { kind: 'close' }
}

export default async function AdminPage() {
  await requireRole('admin', '/admin')
  const [{ locale, t }, supabase] = await Promise.all([getDictionary(), createClient()])
  const tx = LOGISTICS_TEXT[locale]

  const [listingsRes, docsRes, logisticsRes, txRes] = await Promise.all([
    supabase
      .from('listings')
      .select('*, seller:users!listings_seller_id_fkey(full_name, email)')
      .eq('certification_status', 'pending')
      .order('created_at', { ascending: true }),
    supabase
      .from('validation_documents')
      .select(
        'id, file_url, created_at, request:requests(buyer:users!requests_buyer_id_fkey(full_name, email), listing:listings(id, title))',
      )
      .eq('review_status', 'pending')
      .order('created_at', { ascending: true }),
    supabase
      .from('requests')
      .select(
        'id, status, created_at, listing:listings(id, title, type, seller:users!listings_seller_id_fkey(full_name, email)), buyer:users!requests_buyer_id_fkey(full_name, email), checks(id, trigger_type, status, cost, details, created_at), shipments(id, leg, status, provider, tracking_number, fee, from_address, from_phone, to_address, to_phone, created_at, delivered_at)',
      )
      .in('status', ['accepted', 'pending_seller_inspection', 'completed'])
    .order('created_at', { ascending: true }),
  supabase.rpc('admin_transaction_report'),
])
if (logisticsRes.error) console.error('[admin logistics]', logisticsRes.error.message)

  const listings = (listingsRes.data ?? []) as unknown as PendingListing[]
  const docs = (docsRes.data ?? []) as unknown as PendingDoc[]

    const transactions = (txRes.data ?? []) as unknown as TxRow[]
    const rx = RENTAL_TEXT[locale]
  // Only requests where someone asked for the check service go through the company
const logistics = ((logisticsRes.data ?? []) as unknown as LogisticsRequest[]).filter((r) => {
  if ((r.checks ?? []).length === 0) return false
  if (r.status !== 'completed') return true
  // a finished rental only appears while its return inspection is still in progress
  const hasReturnCheck = r.checks.some((c) => c.trigger_type === 'post_rental_return')
  const backDelivered = r.shipments.some((s) => s.leg === 'hub_to_seller' && s.status === 'delivered')
  return hasReturnCheck && !backDelivered
})

  const signed = await Promise.all(
    docs.map(async (d) => {
      const { data } = await supabase.storage.from('validation-docs').createSignedUrl(d.file_url, 600)
      return data?.signedUrl ?? null
    }),
  )

  const count = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en')
  const name = (p: Person) => p?.full_name || p?.email || '—'

  return (
       <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-balance">{t.admin.title}</h1>
        <p className="text-muted-foreground text-pretty">{t.admin.subtitle}</p>
      </div>

      <Tabs defaultValue="certifications" className="gap-6">
        <TabsList>
          <TabsTrigger value="certifications">
            {t.admin.tabCertifications} ({count(listings.length)})
          </TabsTrigger>
          <TabsTrigger value="documents">
            {t.admin.tabDocuments} ({count(docs.length)})
          </TabsTrigger>
          <TabsTrigger value="logistics">
            {tx.tab} ({count(logistics.length)})
          </TabsTrigger>
            <TabsTrigger value="transactions">
              {rx.adminTransactions} ({count(transactions.length)})
            </TabsTrigger>
        </TabsList>

        <TabsContent value="certifications">
          {listings.length === 0 ? (
            <p className="rounded-2xl border border-dashed py-14 text-center text-muted-foreground">
              {t.admin.emptyCertifications}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {listings.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">
                  <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {l.photos[0] && (
                      <Image  
                      src={l.photos[0]} 
                      width={1000}
                      height={1000}
                      alt="" 
                      loading='lazy'
                      className="size-full object-cover" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link href={`/listings/${l.id}`} className="font-medium hover:underline">
                      {l.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {t.device[l.device_type]} · {t.type[l.type]} · {formatListingPrice(l, locale, t)} ·{' '}
                      {governorateName(l.governorate, locale)}
                    </p>
                    <p className="line-clamp-2 text-sm text-muted-foreground text-pretty">
                      {l.condition_description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.admin.seller}: {l.seller?.full_name || l.seller?.email} · {t.admin.submitted}{' '}
                      {formatDate(l.created_at, locale)}
                    </p>
                  </div>
                  <AdminListingActions listingId={l.id} t={t} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="documents">
          {docs.length === 0 ? (
            <p className="rounded-2xl border border-dashed py-14 text-center text-muted-foreground">
              {t.admin.emptyDocuments}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {docs.map((d, i) => (
                <li key={d.id} className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-sm text-muted-foreground">
                      {t.admin.forListing}{' '}
                      <span className="font-medium text-foreground">{d.request?.listing?.title}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t.admin.buyer}: {d.request?.buyer?.full_name || d.request?.buyer?.email} ·{' '}
                      {t.admin.submitted} {formatDate(d.created_at, locale)}
                    </p>
                    {signed[i] && (
                      <a
                        href={signed[i]!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                      >
                        <ExternalLink className="size-4" aria-hidden="true" />
                        {t.admin.viewDocument}
                      </a>
                    )}
                  </div>
                  <AdminDocumentActions documentId={d.id} t={t} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="logistics">
          {logistics.length === 0 ? (
            <p className="rounded-2xl border border-dashed py-14 text-center text-muted-foreground">
              {tx.empty}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {logistics.map((r) => {
                const step = nextStep(r)
                const check = [...r.checks].sort(byNewest)[0]
                const shipments = [...r.shipments].sort((a, b) => a.created_at.localeCompare(b.created_at))

                return (
                  <li key={r.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        {r.listing ? (
                          <Link href={`/listings/${r.listing.id}`} className="font-medium hover:underline">
                            {r.listing.title}
                          </Link>
                        ) : null}
                        <p className="text-sm text-muted-foreground">
                          {tx.seller}: {name(r.listing?.seller ?? null)} · {tx.buyer}: {name(r.buyer)}
                        </p>
                        {check?.details && (
                          <p className="line-clamp-2 text-sm text-muted-foreground text-pretty">{check.details}</p>
                        )}
                      </div>
                      {check && (
                        <StatusBadge
                          status={check.status}
                          label={`${tx.check}: ${
                            t.checks.status[check.status as keyof typeof t.checks.status] ?? check.status
                          }`}
                        />
                      )}
                    </div>

                    {shipments.length > 0 && (
                      <ul className="flex flex-col gap-3">
                        {shipments.map((s) => (
                          <li key={s.id} className="flex flex-col gap-2 rounded-xl border p-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium">{tx.legs[s.leg]}</span>
                              <span
                                className={cn(
                                  'rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium',
                                  s.status === 'failed' && 'bg-destructive/10 text-destructive',
                                )}
                              >
                                {tx.status[s.status]}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {s.from_address} ({s.from_phone}) → {s.to_address} ({s.to_phone})
                              {s.tracking_number ? ` · ${tx.trackingNo}: ${s.tracking_number}` : ''}
                            </p>
                            <AdvanceShipmentButtons shipment={s} locale={locale} t={t} />
                          </li>
                        ))}
                      </ul>
                    )}

                    {step.kind === 'book' && (
                      <BookShipmentForm
                        key={`${r.id}-${step.leg}`}
                        requestId={r.id}
                        leg={step.leg}
                        locale={locale}
                        t={t}
                      />
                    )}
                      {step.kind === 'check' && (
                        <div className="flex flex-col items-start gap-2">
                          <p className="text-sm text-muted-foreground">{tx.checkReady}</p>
                          {step.returnCheck ? (
                            <ReturnCheckForm checkId={step.checkId} locale={locale} t={t} />
                          ) : (
                            <AdminCheckActions checkId={step.checkId} t={t} />
                          )}
                        </div>
                      )}
                    {step.kind === 'complete' && <CompleteRequestButton requestId={r.id} locale={locale} t={t} />}
                    {step.kind === 'close' && <CloseRequestButton requestId={r.id} locale={locale} t={t} />}
                  </li>
                )
              })}
            </ul>
          )}
        </TabsContent>
          <TabsContent value="transactions">
            <AdminTransactions rows={transactions} locale={locale} />
          </TabsContent>
      </Tabs>
    </main>
  )
}