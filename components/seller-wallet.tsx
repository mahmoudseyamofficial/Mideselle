import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import { formatEgp } from '@/lib/fees'
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries'
import type { WalletTransaction, WalletTransactionType } from '@/lib/types'

const creditTypes: ReadonlySet<WalletTransactionType> = new Set([
  'rental_earning',
  'sale_earning',
  'deposit_returned',
])

export function SellerWallet({
  balance,
  transactions,
  hasError,
  locale,
  t,
}: {
  balance: number | null
  transactions: WalletTransaction[]
  hasError: boolean
  locale: Locale
  t: Dictionary
}) {
  return (
    <section aria-labelledby="seller-wallet-heading">
      <Card>
        <CardHeader>
          <CardTitle id="seller-wallet-heading">{t.seller.walletTitle}</CardTitle>
          <CardDescription>{t.seller.walletSubtitle}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="flex flex-col justify-center gap-2 rounded-xl border bg-muted/40 p-5">
            <p className="text-sm text-muted-foreground">{t.seller.walletBalance}</p>
            <p className="text-3xl font-semibold tabular-nums">
              {balance === null ? '—' : formatEgp(balance, locale)}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {hasError ? t.seller.walletUnavailable : t.seller.walletBalanceNote}
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <h3 className="text-sm font-semibold">{t.seller.walletTransactions}</h3>
            {hasError ? (
              <p role="status" className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                {t.seller.walletUnavailable}
              </p>
            ) : transactions.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                {t.seller.walletEmpty}
              </p>
            ) : (
              <ul className="flex max-h-72 flex-col divide-y overflow-y-auto rounded-xl border">
                {transactions.map((transaction) => {
                  const isCredit = creditTypes.has(transaction.type)
                  const isInformational = transaction.type === 'commission_deducted'
                  const amount = formatEgp(Math.abs(Number(transaction.amount)), locale)
                  const amountLabel = isInformational
                    ? amount
                    : `${isCredit ? '+' : '−'}${amount}`

                  return (
                    <li
                      key={transaction.id}
                      className="flex items-start justify-between gap-4 px-4 py-3"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="text-sm font-medium">
                          {t.seller.walletTypes[transaction.type]}
                        </p>
                        {isInformational && (
                          <p className="text-xs text-muted-foreground">
                            {t.seller.commissionIncluded}
                          </p>
                        )}
                        <time
                          dateTime={transaction.created_at}
                          className="text-xs text-muted-foreground"
                        >
                          {formatDate(transaction.created_at, locale)}
                        </time>
                      </div>
                      <p
                        className={
                          isCredit
                            ? 'shrink-0 text-sm font-semibold tabular-nums text-primary'
                            : 'shrink-0 text-sm font-semibold tabular-nums'
                        }
                      >
                        {amountLabel}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
