import Link from 'next/link'
import { ImageOff, MapPin } from 'lucide-react'
import { StatusBadge } from '@/components/status-badge'
import { formatListingPrice, governorateName } from '@/lib/format'
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries'
import type { Listing } from '@/lib/types'

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
      className="group flex flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="relative aspect-[4/3] bg-muted">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={listing.title}
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff className="size-8" aria-hidden="true" />
          </div>
        )}
        <span className="absolute start-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium backdrop-blur">
          {t.type[listing.type]}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs text-muted-foreground">{t.device[listing.device_type]}</p>
        <h3 className="line-clamp-2 font-medium text-balance">{listing.title}</h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="font-semibold text-primary">
            {formatListingPrice(listing, locale, t)}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden="true" />
            {governorateName(listing.governorate, locale)}
          </span>
        </div>
        {listing.certification_status === 'certified' && (
          <div className="flex flex-wrap gap-2">
            <StatusBadge status="certified" label={t.listings.certified} className="w-fit" />
          </div>
        )}
      </div>
    </Link>
  )
}
