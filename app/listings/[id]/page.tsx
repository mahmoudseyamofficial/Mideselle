import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarDays, MapPin, ShieldCheck } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { RequestForm } from '@/components/request-form'
import { ListingImageGallery } from '@/components/listing-image-gallery'
import { FeeBreakdown } from '@/components/fee-breakdown'
import { SellerCheckButton } from '@/components/device-check-dialog'
import { getCurrentProfile } from '@/lib/auth'
import { formatDate, formatListingPrice, governorateName } from '@/lib/format'
import { formatEgp } from '@/lib/fees'
import { getDictionary } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'
import type { Listing } from '@/lib/types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const getListing = cache(async (id: string) => {
  if (!UUID.test(id)) return null
  const supabase = await createClient()
  const { data } = await supabase.from('listings').select('*').eq('id', id).maybeSingle()
  return (data as Listing | null) ?? null
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const [listing, { t }] = await Promise.all([getListing(id), getDictionary()])
  if (!listing) return { title: t.listings.notFound }

  const description = listing.condition_description.slice(0, 160)
  const image = listing.photos[0]
  return {
    title: listing.title,
    description,
    openGraph: {
      title: listing.title,
      description,
      type: 'website',
      url: `/listings/${listing.id}`,
      images: image ? [{ url: image, alt: listing.title }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: listing.title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [listing, { locale, t }, profile] = await Promise.all([
    getListing(id),
    getDictionary(),
    getCurrentProfile(),
  ])
  if (!listing) notFound()

  const isOwner = profile?.id === listing.seller_id
  const bookable = listing.certification_status === 'certified' && listing.availability === 'available'
  const { data: pendingSellRequest } = isOwner && listing.type === 'sell'
    ? await (await createClient()).from('requests').select('id').eq('listing_id', listing.id).eq('status', 'pending').maybeSingle()
    : { data: null }

  let panel: React.ReactNode
  if (!profile) {
    panel = (
      <Link href={`/login?next=/listings/${listing.id}`} className={buttonVariants({ size: 'lg' })}>
        {t.request.loginToRequest}
      </Link>
    )
  } else if (isOwner) {
    panel = (
      <div className="flex flex-wrap gap-2">
        <Link href={`/listings/${listing.id}/edit`} className={buttonVariants({ size: 'lg' })}>Edit / تعديل</Link>
        <Link href={`/dashboard/seller?listing=${listing.id}`} className={buttonVariants({ variant: 'outline', size: 'lg' })}>View requests / عرض الطلبات</Link>
        {listing.type === 'sell' && pendingSellRequest?.id && (
          <SellerCheckButton requestId={pendingSellRequest.id} triggerType="pre_sale_handover" t={t} />
        )}
      </div>
    )
  } else if (profile.role !== 'buyer') {
    panel = <p className="text-sm text-muted-foreground">{t.request.sellersCannotRequest}</p>
  } else if (!bookable) {
    panel = <p className="text-sm text-muted-foreground">{t.request.unavailable}</p>
  } else {
    panel = (
      <RequestForm
        listingId={listing.id}
        userId={profile.id}
        listingType={listing.type}
        price={listing.price}
        rentPeriods={listing.rent_period}
        rentWeeklyPrice={listing.rent_weekly_price}
        rentMonthlyPrice={listing.rent_monthly_price}
        locale={locale}
        t={t}
      />
    )
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <Link
        href="/listings"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t.listings.backToListings}
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <ListingImageGallery
          photos={listing.photos}
          title={listing.title}
          locale={locale}
          sectionLabel={t.newListing.photos}
        />

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                {t.type[listing.type]}
              </span>
              <span className="text-xs text-muted-foreground">{t.device[listing.device_type]}</span>
              {listing.certification_status === 'certified' && (
                <StatusBadge status="certified" label={t.listings.certified} />
              )}
            </div>
            <h1 className="text-3xl font-semibold text-balance">{listing.title}</h1>
            <p className="text-2xl font-semibold text-primary">
              {formatListingPrice(listing, locale, t)}
            </p>
            {listing.type === 'sell' && listing.price !== null && (
              <FeeBreakdown price={listing.price} locale={locale} t={t} />
            )}
            {listing.type === 'rent' && (
              <div className="grid gap-3 sm:grid-cols-2">
                {(listing.rent_period ?? []).map((period) => {
                  const rentPrice = period === 'weekly'
                    ? listing.rent_weekly_price
                    : listing.rent_monthly_price
                  return rentPrice === null ? null : (
                    <FeeBreakdown
                      key={period}
                      price={rentPrice}
                      locale={locale}
                      t={t}
                      periodLabel={t.listings[period]}
                    />
                  )
                })}
              </div>
            )}
            {listing.type === 'rent' && (listing.deposit ?? 0) > 0 && (
              <p className="text-sm text-muted-foreground">
                {t.listings.deposit}: {formatEgp(listing.deposit as number, locale)}
              </p>
            )}
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <MapPin className="size-4" aria-hidden="true" />
                {governorateName(listing.governorate, locale)}
              </li>
              <li className="flex items-center gap-2">
                <CalendarDays className="size-4" aria-hidden="true" />
                {t.listings.listedOn} {formatDate(listing.created_at, locale)}
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-4" aria-hidden="true" />
                {t.home.trust1Title}
              </li>
            </ul>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="font-medium">{t.listings.condition}</h2>
            <p className="whitespace-pre-line text-muted-foreground text-pretty">
              {listing.condition_description}
            </p>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
            <h2 className="font-medium">{t.request.sendTitle}</h2>
            {profile?.role === 'buyer' && bookable && !isOwner && (
              <p className="text-sm text-muted-foreground text-pretty">{t.request.sendBody}</p>
            )}
            {panel}
          </section>
        </div>
      </div>
    </main>
  )
}
