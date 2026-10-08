import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdminDocumentActions, AdminListingActions } from '@/components/request-actions'
import { requireRole } from '@/lib/auth'
import { formatDate, formatListingPrice, governorateName } from '@/lib/format'
import { getDictionary } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'
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

export default async function AdminPage() {
  await requireRole('admin', '/admin')
  const [{ locale, t }, supabase] = await Promise.all([getDictionary(), createClient()])

  const [listingsRes, docsRes] = await Promise.all([
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
  ])

  const listings = (listingsRes.data ?? []) as unknown as PendingListing[]
  const docs = (docsRes.data ?? []) as unknown as PendingDoc[]

  const signed = await Promise.all(
    docs.map(async (d) => {
      const { data } = await supabase.storage.from('validation-docs').createSignedUrl(d.file_url, 600)
      return data?.signedUrl ?? null
    }),
  )

  const count = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en')

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10">
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
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.photos[0]} alt="" className="size-full object-cover" />
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
      </Tabs>
    </main>
  )
}
