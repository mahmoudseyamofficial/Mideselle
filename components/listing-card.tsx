import Link from 'next/link'
import { ImageOff, MapPin } from 'lucide-react'
import { StatusBadge } from '@/components/status-badge'
import { InspectedBadge } from '@/components/inspected-badge'
import { formatListingPrice, governorateName } from '@/lib/format'
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries'
import type { Listing } from '@/lib/types'
import Image from 'next/image'

export function ListingCard({
  listing,
  locale,
  t,
}: {
  listing: Listing
  locale: Locale
  t: Dictionary
}) {
  const photo = listing.photos[0]
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="relative aspect-4/4 shrink-0 overflow-hidden bg-muted">
        {photo ? (
          <Image
            src={photo}
            alt={listing.title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-fit transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff className="size-8" aria-hidden="true" />
          </div>
        )}
        <span className="absolute inset-s-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium backdrop-blur">
          {t.type[listing.type]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Row 1: device type (reserves space even when empty) */}
        <p className="h-4 text-xs leading-4 text-muted-foreground">
          {listing.device_type ? t.device[listing.device_type] : null}
        </p>

        {/* Row 2: title */}
        <h3 className="line-clamp-2 min-h-6 font-medium text-balance">{listing.title}</h3>

        {/* Rows 3 and 4 stick to the bottom */}
        <div className="mt-auto flex flex-col gap-2 pt-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-primary">
              {formatListingPrice(listing, locale, t)}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden="true" />
              {governorateName(listing.governorate, locale)}
            </span>
          </div>

          {/* Row 4: "Reviewed" (admin approved the listing) and "Inspected" (an engineer check passed) */}
          <div className="flex min-h-7 flex-wrap items-center gap-1.5">
            {listing.certification_status === 'certified' && (
              <StatusBadge status="certified" label={t.listings.certified} className="w-fit" />
            )}
            {listing.last_inspected_at && <InspectedBadge label={t.listings.inspected} />}
          </div>
        </div>
      </div>
    </Link>
  )
}