'use client'

import { Button } from '@/components/ui/button'
import { FeeBreakdown } from '@/components/fee-breakdown'
import { useRental } from '@/components/rental-context'
import { formatEgp } from '@/lib/fees'
import type { Dictionary } from '@/lib/i18n/dictionaries'

/** The Weekly / Monthly / More than a month buttons. Place under the title. */
export function RentalPicker({ t }: { t: Dictionary }) {
  const rental = useRental()
  if (!rental) return null
  const { available, period, setPeriod } = rental

  return (
    <div role="radiogroup" aria-label={t.request.rentalPeriod} className="flex flex-wrap gap-2">
      {available.map((p) => (
        <Button
          key={p}
          type="button"
          size="sm"
          role="radio"
          aria-checked={period === p}
          variant={period === p ? 'default' : 'outline'}
          onClick={() => setPeriod(p)}
        >
          {p === 'weekly' ? t.listings.weekly : t.listings.monthly}
        </Button>
      ))}
      <Button
        type="button"
        size="sm"
        role="radio"
        aria-checked={period === 'custom'}
        variant={period === 'custom' ? 'default' : 'outline'}
        onClick={() => setPeriod('custom')}
      >
        {t.request.moreThanMonth}
      </Button>
    </div>
  )
}

/** Headline price + fee breakdown for the selected period. */
export function RentalPrice({
  locale,
  t,
  viewer = 'buyer',
}: {
  locale: 'ar' | 'en'
  t: Dictionary
  /** "seller" shows what the owner receives; "buyer" shows what the renter pays */
  viewer?: 'buyer' | 'seller'
}) {
  const rental = useRental()
  if (!rental) return null
  const { period, price, deposit } = rental

  if (period === 'custom') {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground text-pretty">{t.request.customQuoteNote}</p>
        {deposit > 0 && (
          <p className="text-sm text-muted-foreground">
            {t.listings.deposit}: {formatEgp(deposit, locale)}
          </p>
        )}
      </div>
    )
  }
  if (price === null) return null

  const money = formatEgp(price, locale)

  const isWeekly = period === 'weekly'

  return (
    <div className="flex flex-col gap-4">
      <p className="text-2xl font-semibold text-primary">
        {money}{' '}
        <span className="text-base font-medium">/ {isWeekly ? t.listings.perWeek : t.listings.perMonth}</span>
      </p>
      <FeeBreakdown
        price={price}
        locale={locale}
        t={t}
        periodLabel={isWeekly ? t.listings.weekly : t.listings.monthly}
        deposit={deposit}
        viewer={viewer}
        netLabel={t.seller.walletTypes.rental_earning}
      />
    </div>
  )
}