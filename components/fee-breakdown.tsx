import { calculateFees, formatEgp } from '@/lib/fees'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export function FeeBreakdown({
  price,
  locale,
  t,
  periodLabel,
}: {
  price: number
  locale: 'ar' | 'en'
  t: Dictionary
  periodLabel?: string
}) {
  const fees = calculateFees(price)

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
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{t.request.serviceFee}</dt>
          <dd className="text-end tabular-nums">{formatEgp(fees.buyerServiceFee, locale)}</dd>
        </div>
        <div className="mt-1 flex justify-between gap-4 border-t pt-2 font-semibold">
          <dt>{t.request.total}</dt>
          <dd className="text-end tabular-nums">{formatEgp(fees.buyerTotal, locale)}</dd>
        </div>
      </dl>
    </section>
  )
}
