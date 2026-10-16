    import { formatEgp } from '@/lib/fees'
    import { formatDate } from '@/lib/format'
    import { RENTAL_TEXT } from '@/lib/rental-text'
    import { cn } from '@/lib/utils'
    import type { Locale } from '@/lib/i18n/dictionaries'

    export type TxRow = {
    request_id: string
    requested_at: string
    listing_type: 'sell' | 'rent' | 'donate'
    listing_title: string
    seller_email: string
    buyer_email: string
    request_status: string
    base_price: number | string
    commission: number | string
    service_fee: number | string
    deposit_held: number | string
    deposit_returned: number | string
    deposit_deducted: number | string
    inspection_fees: number | string
    platform_revenue: number | string
    }

    const MONEY = [
    'base_price',
    'commission',
    'service_fee',
    'deposit_held',
    'deposit_returned',
    'deposit_deducted',
    'inspection_fees',
    'platform_revenue',
    ] as const
    type MoneyKey = (typeof MONEY)[number]

    const STATUS_TEXT: Record<'ar' | 'en', Record<string, string>> = {
    en: {
        pending: 'Pending',
        accepted: 'Accepted',
        completed: 'Completed',
        rejected: 'Rejected',
        cancelled_by_buyer: 'Cancelled by buyer',
        pending_seller_inspection: 'In inspection',
        pending_owner_price: 'Awaiting price',
        pending_buyer_acceptance: 'Awaiting buyer',
    },
    ar: {
        pending: 'قيد الانتظار',
        accepted: 'مقبول',
        completed: 'مكتمل',
        rejected: 'مرفوض',
        cancelled_by_buyer: 'ألغاه المشتري',
        pending_seller_inspection: 'قيد الفحص',
        pending_owner_price: 'بانتظار السعر',
        pending_buyer_acceptance: 'بانتظار موافقة المشتري',
    },
    }

    const STATUS_TONE: Record<string, string> = {
    completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    accepted: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    rejected: 'bg-red-500/10 text-red-700 dark:text-red-300',
    cancelled_by_buyer: 'bg-muted text-muted-foreground',
    pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    pending_seller_inspection: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    pending_owner_price: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    pending_buyer_acceptance: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    }

    const TYPE_TONE: Record<TxRow['listing_type'], string> = {
    sell: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    rent: 'bg-primary/10 text-primary',
    donate: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    }

    function Chip({ className, children }: { className: string; children: React.ReactNode }) {
    return (
        <span className={cn('inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', className)}>
        {children}
        </span>
    )
    }

    export function AdminTransactions({ rows, locale }: { rows: TxRow[]; locale: Locale }) {
    const x = RENTAL_TEXT[locale]

    if (rows.length === 0) {
        return (
        <p className="rounded-2xl border border-dashed py-14 text-center text-muted-foreground">
            {x.noTransactions}
        </p>
        )
    }

    const total = (k: MoneyKey) => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0)

    // Labels in the same order as MONEY
    const moneyHeads = [
        x.cols.price,
        x.cols.commission,
        x.cols.serviceFee,
        x.cols.depositHeld,
        x.cols.depositReturned,
        x.cols.depositDeducted,
        x.cols.inspection,
        x.cols.revenue,
    ]
    const textHeads = [x.cols.date, x.cols.type, x.cols.device, x.cols.seller, x.cols.buyer, x.cols.status]

    const summary: { key: MoneyKey; label: string; accent?: boolean }[] = [
        { key: 'base_price', label: x.cols.price },
        { key: 'commission', label: x.cols.commission },
        { key: 'service_fee', label: x.cols.serviceFee },
        { key: 'deposit_held', label: x.cols.depositHeld },
        { key: 'platform_revenue', label: x.cols.revenue, accent: true },
    ]

    const money = (v: number) =>
        v === 0 ? <span className="text-muted-foreground/40">—</span> : formatEgp(v, locale)

    return (
        <div className="flex flex-col gap-4">
        {/* Totals at a glance */}
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {summary.map((c) => (
            <div
                key={c.key}
                className={cn('flex flex-col gap-1 rounded-2xl border bg-card p-4', c.accent && 'border-primary/40 bg-primary/5')}
            >
                <dt className="text-xs text-muted-foreground">{c.label}</dt>
                <dd className={cn('text-lg font-semibold tabular-nums', c.accent && 'text-primary')}>
                {formatEgp(total(c.key), locale)}
                </dd>
            </div>
            ))}
        </dl>

        {/* Detailed table */}
        <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-275 border-collapse text-sm">
            <thead>
                <tr className="bg-muted/40 text-xs text-muted-foreground">
                {textHeads.map((h) => (
                    <th key={h} className="px-3 py-3 text-start font-medium whitespace-nowrap">
                    {h}
                    </th>
                ))}
                {moneyHeads.map((h) => (
                    <th key={h} className="px-3 py-3 text-end font-medium whitespace-nowrap">
                    {h}
                    </th>
                ))}
                </tr>
            </thead>
            <tbody className="divide-y">
                {rows.map((r) => (
                <tr key={r.request_id} className="transition-colors hover:bg-muted/30">
                    <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                    {formatDate(r.requested_at, locale)}
                    </td>
                    <td className="px-3 py-3">
                    <Chip className={TYPE_TONE[r.listing_type]}>{x.types[r.listing_type]}</Chip>
                    </td>
                    <td className="min-w-40 px-3 py-3 font-medium">{r.listing_title}</td>
                    <td className="px-3 py-3">
                    <span className="block max-w-52 truncate" title={r.seller_email}>
                        {r.seller_email}
                    </span>
                    </td>
                    <td className="px-3 py-3">
                    <span className="block max-w-52 truncate" title={r.buyer_email}>
                        {r.buyer_email}
                    </span>
                    </td>
                    <td className="px-3 py-3">
                    <Chip className={STATUS_TONE[r.request_status] ?? 'bg-muted text-muted-foreground'}>
                        {STATUS_TEXT[locale][r.request_status] ?? r.request_status}
                    </Chip>
                    </td>
                    {MONEY.map((k) => (
                    <td
                        key={k}
                        className={cn(
                        'px-3 py-3 text-end whitespace-nowrap tabular-nums',
                        k === 'platform_revenue' && 'font-semibold text-primary',
                        )}
                    >
                        {money(Number(r[k] ?? 0))}
                    </td>
                    ))}
                </tr>
                ))}
            </tbody>
            <tfoot>
                <tr className="border-t-2 bg-muted/40 font-semibold">
                <td className="px-3 py-3" colSpan={6}>
                    {x.cols.total}
                </td>
                {MONEY.map((k) => (
                    <td
                    key={k}
                    className={cn(
                        'px-3 py-3 text-end whitespace-nowrap tabular-nums',
                        k === 'platform_revenue' && 'text-primary',
                    )}
                    >
                    {formatEgp(total(k), locale)}
                    </td>
                ))}
                </tr>
            </tfoot>
            </table>
        </div>
        </div>
    )
    }