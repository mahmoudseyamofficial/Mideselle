import { formatEgp } from './fees'
import { GOVERNORATES, type Listing, type ListingType, type RentPeriod } from './types'
import type { Dictionary, Locale } from './i18n/dictionaries'

export function formatPrice(
  price: number | null,
  type: ListingType,
  locale: Locale,
  t: Dictionary,
) {
  if (type === 'donate' || price === null) return t.listings.free
  const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(price)
  return type === 'rent' ? `${formatted} ${t.listings.perMonth}` : formatted
}

export function formatListingPrice(
  listing: Pick<Listing, 'type' | 'price' | 'rent_weekly_price' | 'rent_monthly_price'>,
  locale: Locale,
  t: Dictionary,
  selectedPeriod?: RentPeriod | null,
) {
  if (listing.type !== 'rent') return formatPrice(listing.price, listing.type, locale, t)

  const prices: Record<RentPeriod, number | null> = {
    weekly: listing.rent_weekly_price,
    monthly: listing.rent_monthly_price,
  }
  const label = (period: RentPeriod) =>
    period === 'weekly' ? t.listings.perWeek : t.listings.perMonth

  if (selectedPeriod) {
    const selectedPrice = prices[selectedPeriod]
    return selectedPrice === null
      ? t.listings.free
      : `${formatEgp(selectedPrice, locale)} ${label(selectedPeriod)}`
  }

  const availableRates = (['weekly', 'monthly'] as const)
    .filter((period) => prices[period] !== null)
    .map((period) => `${formatEgp(prices[period] as number, locale)} ${label(period)}`)

  if (availableRates.length > 0) return availableRates.join(' · ')
  return listing.price === null ? t.listings.free : formatPrice(listing.price, 'rent', locale, t)
}

export function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null
  // Timestamps without an offset are UTC in Postgres; without "Z" browsers parse them as local time.
  const hasZone = /(Z|[+-]\d{2}(:?\d{2})?)$/.test(value)
  const date = new Date(hasZone ? value : `${value.replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value: string | null | undefined, locale: Locale) {
  const date = parseTimestamp(value)
  if (!date) return locale === 'ar' ? 'قيد الانتظار' : 'Pending'
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Cairo',
  }).format(date)
}

export function governorateName(id: string, locale: Locale) {
  const g = GOVERNORATES.find((x) => x.id === id)
  return g ? g[locale] : id
}
