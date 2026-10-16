import { OWNER_COMMISSION_RATE, calculateFees, formatEgp } from '@/lib/fees'
import type { Dictionary } from '@/lib/i18n/dictionaries'

/**
 * Price box.
 *  - viewer "buyer" (default): price + app service fee (+ refundable deposit) = what the buyer pays.
 *  - viewer "seller": price - app commission = what the owner receives. The deposit is not part of it.
 */
export function FeeBreakdown({
  price,
  locale,
  t,
  periodLabel,
  deposit,
  viewer = 'buyer',
  netLabel,
}: {
  price: number
  locale: 'ar' | 'en'
  t: Dictionary
  periodLabel?: string
  /** Refundable deposit (rentals). Buyer view only: shown under the service fee and added to the total. */
  deposit?: number | null
  viewer?: 'buyer' | 'seller'
  /** Label of the last row in the seller view, for example "Net sale earnings" */
  netLabel?: string
}) {
  const isSeller = viewer === 'seller'
  const fees = calculateFees(price, isSeller ? 0 : (deposit ?? 0))
  const percent = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en', { style: 'percent' }).format(
    OWNER_COMMISSION_RATE,
  )

  return (
    <section
      aria-label={periodLabel ? `${t.request.priceBreakdown}: ${periodLabel}` : t.request.priceBreakdown}
      className="rounded-xl border bg-muted/40 p-4 text-sm"
    >
      <p className="font-medium">
        {t.request.priceBreakdown}{periodLabel ? ` · ${periodLabel}` : ''}
      </p>
      <dl className="mt-2 flex flex-col gap-1.5">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{t.request.basePrice}</dt>
          <dd className="text-end tabular-nums">{formatEgp(fees.basePrice, locale)}</dd>
        </div>

        {isSeller ? (
          <>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                {t.seller.walletTypes.commission_deducted}
              </dt>
              <dd className="text-end tabular-nums">−{formatEgp(fees.ownerCommission, locale)}</dd>
            </div>
            <div className="mt-1 flex justify-between gap-4 border-t pt-2 font-semibold">
              <dt>{netLabel ?? t.seller.walletTypes.sale_earning}</dt>
              <dd className="text-end tabular-nums text-primary">{formatEgp(fees.ownerEarning, locale)}</dd>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t.request.serviceFee}</dt>
              <dd className="text-end tabular-nums">{formatEgp(fees.buyerServiceFee, locale)}</dd>
            </div>
            {fees.deposit > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t.listings.deposit}</dt>
                <dd className="text-end tabular-nums">{formatEgp(fees.deposit, locale)}</dd>
              </div>
            )}
            <div className="mt-1 flex justify-between gap-4 border-t pt-2 font-semibold">
              <dt>{t.request.total}</dt>
              <dd className="text-end tabular-nums">{formatEgp(fees.buyerTotal, locale)}</dd>
            </div>
          </>
        )}
      </dl>
    </section>
  )
}