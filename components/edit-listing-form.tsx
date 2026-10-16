    'use client'

    import { useState, useTransition } from 'react'
    import Link from 'next/link'
    import { useRouter } from 'next/navigation'
    import { toast } from 'sonner'
    import { Loader2 } from 'lucide-react'
    import { Button, buttonVariants } from '@/components/ui/button'
    import { Input } from '@/components/ui/input'
    import { Label } from '@/components/ui/label'
    import { Textarea } from '@/components/ui/textarea'
    import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
    import { updateListing } from '@/app/actions'
    import { cn } from '@/lib/utils'
    import { DEVICE_TYPES, ACTIVE_GOVERNORATES, type DeviceType, type Listing } from '@/lib/types'
    import type { Dictionary, Locale } from '@/lib/i18n/dictionaries'

    export function EditListingForm({
    listing,
    locale,
    t,
    }: {
    listing: Listing
    locale: Locale
    t: Dictionary
    }) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    const n = t.newListing
    const isRent = listing.type === 'rent'
    const isSell = listing.type === 'sell'

    const [title, setTitle] = useState(listing.title)
    const [deviceType, setDeviceType] = useState<DeviceType>(listing.device_type)
    const [condition, setCondition] = useState(listing.condition_description)
    const [governorate, setGovernorate] = useState(listing.governorate)
    const [price, setPrice] = useState(listing.price?.toString() ?? '')
    const [deposit, setDeposit] = useState(listing.deposit?.toString() ?? '0')

    const [offerWeekly, setOfferWeekly] = useState(Boolean(listing.rent_period?.includes('weekly')))
    const [offerMonthly, setOfferMonthly] = useState(Boolean(listing.rent_period?.includes('monthly')))
    const [weeklyPrice, setWeeklyPrice] = useState(listing.rent_weekly_price?.toString() ?? '')
    const [monthlyPrice, setMonthlyPrice] = useState(listing.rent_monthly_price?.toString() ?? '')

    const rentRows = [
        {
        key: 'weekly',
        on: offerWeekly,
        setOn: setOfferWeekly,
        value: weeklyPrice,
        setValue: setWeeklyPrice,
        label: n.weekly,
        priceLabel: n.weeklyPrice,
        },
        {
        key: 'monthly',
        on: offerMonthly,
        setOn: setOfferMonthly,
        value: monthlyPrice,
        setValue: setMonthlyPrice,
        label: n.monthly,
        priceLabel: n.monthlyPrice,
        },
    ]

    const rentOk =
        (offerWeekly || offerMonthly) &&
        (!offerWeekly || Number(weeklyPrice) > 0) &&
        (!offerMonthly || Number(monthlyPrice) > 0) &&
        Number(deposit) >= 0

    const valid =
        title.trim().length > 2 &&
        condition.trim().length > 9 &&
        governorate !== '' &&
        (isRent ? rentOk : isSell ? Number(price) > 0 : true)

    function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!valid) return
        setError(null)

        startTransition(async () => {
        const result = await updateListing({
            id: listing.id,
            title: title.trim(),
            device_type: deviceType,
            condition_description: condition.trim(),
            price: isSell ? Number(price) : null,
            rentPeriods: isRent
            ? [...(offerWeekly ? ['weekly' as const] : []), ...(offerMonthly ? ['monthly' as const] : [])]
            : [],
            rentWeeklyPrice: isRent && offerWeekly ? Number(weeklyPrice) : null,
            rentMonthlyPrice: isRent && offerMonthly ? Number(monthlyPrice) : null,
            deposit: isRent ? Number(deposit) || 0 : null,
            governorate,
        })

        if (result.ok) {
            toast.success(n.saved)
            router.push(`/listings/${listing.id}`)
            router.refresh()
        } else {
            setError(t.auth.unexpected)
        }
        })
    }

    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-5 rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-2">
            <Label htmlFor="title">{n.listingTitle}</Label>
            <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className="h-10"
            />
        </div>

        <div className="flex flex-col gap-2">
            <Label htmlFor="device">{n.deviceType}</Label>
            <NativeSelect
            id="device"
            value={deviceType}
            onChange={(e) => setDeviceType(e.target.value as DeviceType)}
            className="w-full [&_select]:h-10"
            >
            {DEVICE_TYPES.map((d) => (
                <NativeSelectOption key={d} value={d}>
                {t.device[d]}
                </NativeSelectOption>
            ))}
            </NativeSelect>
        </div>

        <div className="flex flex-col gap-2">
            <Label htmlFor="condition">{n.conditionDescription}</Label>
            <Textarea
            id="condition"
            rows={5}
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            maxLength={2000}
            />
        </div>

        {isRent && (
            <div className="flex flex-col gap-3">
            <Label>{n.rentalPeriods}</Label>
            {rentRows.map((r) => (
                <div
                key={r.key}
                className={cn(
                    'flex flex-col gap-3 rounded-xl border p-4 transition-colors',
                    r.on && 'border-primary bg-primary/5',
                )}
                >
                <label className="flex cursor-pointer items-center gap-2 font-medium">
                    <input
                    type="checkbox"
                    checked={r.on}
                    onChange={(e) => r.setOn(e.target.checked)}
                    className="size-4 accent-primary"
                    />
                    {r.label}
                </label>
                {r.on && (
                    <div className="flex flex-col gap-2">
                    <Label htmlFor={`price-${r.key}`}>{r.priceLabel}</Label>
                    <Input
                        id={`price-${r.key}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={r.value}
                        onChange={(e) => r.setValue(e.target.value)}
                        className="h-10 bg-background"
                    />
                    </div>
                )}
                </div>
            ))}

            <div className="flex flex-col gap-2">
                <Label htmlFor="deposit">{t.listings.deposit}</Label>
                <Input
                id="deposit"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                className="h-10"
                />
            </div>
            </div>
        )}

        {isSell && (
            <div className="flex flex-col gap-2">
            <Label htmlFor="price">{n.price}</Label>
            <Input
                id="price"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="h-10"
            />
            </div>
        )}

        <div className="flex flex-col gap-2">
            <Label htmlFor="gov">{n.governorate}</Label>
            <NativeSelect
            id="gov"
            value={governorate}
            onChange={(e) => setGovernorate(e.target.value)}
            className="w-full [&_select]:h-10"
            >
            {ACTIVE_GOVERNORATES.map((g) => (
                <NativeSelectOption key={g.id} value={g.id}>
                {g[locale]}
                </NativeSelectOption>
            ))}
            </NativeSelect>
        </div>

        {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
            </p>
        )}

        <div className="flex justify-between gap-3">
            <Link
            href={`/listings/${listing.id}`}
            className={buttonVariants({ variant: 'outline', size: 'lg', className: 'h-10' })}
            >
            {n.cancel}
            </Link>
            <Button type="submit" size="lg" className="h-10" disabled={!valid || pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {pending ? n.saving : n.save}
            </Button>
        </div>
        </form>
    )
    }