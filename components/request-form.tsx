'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { FeeBreakdown } from '@/components/fee-breakdown'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { createRequest } from '@/app/actions'
import { createClient } from '@/lib/supabase/client'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { ListingType, RentPeriod } from '@/lib/types'

const MAX_DOC_BYTES = 5 * 1024 * 1024

export function RequestForm({
  listingId,
  userId,
  listingType,
  price,
  rentPeriods,
  rentWeeklyPrice,
  rentMonthlyPrice,
  locale,
  t,
}: {
  listingId: string
  userId: string
  listingType: ListingType
  price: number | null
  rentPeriods: RentPeriod[] | null
  rentWeeklyPrice: number | null
  rentMonthlyPrice: number | null
  locale: 'ar' | 'en'
  t: Dictionary
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [selectedRentPeriod, setSelectedRentPeriod] = useState<RentPeriod | ''>(() =>
    rentPeriods?.includes('monthly') ? 'monthly' : rentPeriods?.[0] ?? '',
  )
  const selectedPrice = listingType === 'rent'
    ? selectedRentPeriod === 'weekly'
      ? rentWeeklyPrice
      : selectedRentPeriod === 'monthly'
        ? rentMonthlyPrice
        : null
    : listingType === 'sell'
      ? price
      : null
  const periodLabel = selectedRentPeriod === 'weekly'
    ? t.listings.weekly
    : selectedRentPeriod === 'monthly'
      ? t.listings.monthly
      : undefined

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const file = form.get('document') as File | null
    const message = String(form.get('message') ?? '').trim() || null
    setError(null)

    if (listingType === 'donate' && (!file || file.size === 0)) {
      setError(t.newListing.required)
      return
    }
    if (file && file.size > MAX_DOC_BYTES) {
      setError(t.newListing.photosHelp)
      return
    }

    startTransition(async () => {
      let documentPath: string | null = null
      if (file && file.size > 0) {
        const supabase = createClient()
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${userId}/${crypto.randomUUID()}-${safeName}`
        const { error: uploadError } = await supabase.storage.from('validation-docs').upload(path, file)
        if (uploadError) {
          setError(t.auth.unexpected)
          return
        }
        documentPath = path
      }
      const result = await createRequest({
        listingId,
        message,
        documentPath,
        rentPeriod: listingType === 'rent' ? selectedRentPeriod || null : null,
      })
      if (result.ok) {
        toast.success(t.request.sent)
        setSubmitted(true)
      } else {
        toast.error(result.error === 'not_implemented' ? t.common.notImplemented : t.auth.unexpected)
      }
    })
  }

  if (submitted) {
    return (
      <section role="status" aria-live="polite" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">{t.request.sent}</h3>
          <p className="text-sm text-muted-foreground">{t.request.confirmationBody}</p>
        </div>
        {selectedPrice !== null && (
          <FeeBreakdown price={selectedPrice} locale={locale} t={t} periodLabel={periodLabel} />
        )}
        <Link href="/dashboard/buyer" className={buttonVariants({ variant: 'outline' })}>
          {t.request.viewRequests}
        </Link>
      </section>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {listingType === 'rent' && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="rent-period">{t.request.rentalPeriod}</Label>
          <NativeSelect
            id="rent-period"
            value={selectedRentPeriod}
            onChange={(event) => setSelectedRentPeriod(event.target.value as RentPeriod)}
            className="w-full"
            required
          >
            <NativeSelectOption value="" disabled>
              {t.request.rentalPeriod}
            </NativeSelectOption>
            {(rentPeriods ?? []).map((period) => (
              <NativeSelectOption key={period} value={period}>
                {t.listings[period]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      )}
      {selectedPrice !== null && (
        <FeeBreakdown price={selectedPrice} locale={locale} t={t} periodLabel={periodLabel} />
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="message">{t.request.message}</Label>
        <Textarea
          id="message"
          name="message"
          rows={3}
          maxLength={1000}
          placeholder={t.request.messagePlaceholder}
        />
      </div>
      {listingType === 'donate' && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="document">{t.request.docLabel}</Label>
          <Input id="document" name="document" type="file" accept="image/*,application/pdf" required className="h-10" />
          <p className="text-xs text-muted-foreground text-pretty">{t.request.docHelp}</p>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="h-10"
        disabled={pending || (listingType === 'rent' && selectedPrice === null)}
      >
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        {t.request.send}
      </Button>
    </form>
  )
}
