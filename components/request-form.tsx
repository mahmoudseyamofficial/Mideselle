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
import { useRental } from '@/components/rental-context'
import { createRequest } from '@/app/actions'
import { createClient } from '@/lib/supabase/client'
import { uuid } from '@/lib/uuid'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { ListingType, RentPeriod } from '@/lib/types'

const MAX_DOC_BYTES = 5 * 1024 * 1024

export function RequestForm({
  listingId,
  userId,
  listingType,
  price,
  locale,
  t,
}: {
  listingId: string
  userId: string
  listingType: ListingType
  price: number | null
  locale: 'ar' | 'en'
  t: Dictionary
}) {
  // Rent listings: period, price and custom duration come from the shared context
  const rental = useRental()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const isRent = listingType === 'rent'
  const selectedRentPeriod = rental?.period ?? ''
  const customDuration = rental?.customDuration ?? ''
  const isCustom = selectedRentPeriod === 'custom'

  const selectedPrice = isRent ? (rental?.price ?? null) : listingType === 'sell' ? price : null
  const periodLabel =
    selectedRentPeriod === 'weekly'
      ? t.listings.weekly
      : selectedRentPeriod === 'monthly'
        ? t.listings.monthly
        : undefined

  const rentIncomplete =
    isRent && (!selectedRentPeriod || (isCustom ? !customDuration.trim() : selectedPrice === null))

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (rentIncomplete) return

    const form = new FormData(e.currentTarget)
    const file = form.get('document') as File | null
    const message = String(form.get('message') ?? '').trim() || null
    setError(null)

    if (listingType === 'donate' && (!file || file.size === 0)) {
      setError(t.newListing.required)
      return
    }
    if (file && file.size > MAX_DOC_BYTES) {
      setError(t.request.fileTooLarge)
      return
    }

    startTransition(async () => {
      let documentPath: string | null = null
      if (file && file.size > 0) {
        const supabase = createClient()
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${userId}/${uuid()}-${safeName}`
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
        rentalPeriod: isRent ? (selectedRentPeriod as RentPeriod) : null,
        customDurationText: isCustom ? customDuration.trim() : null,
      })
      if (result.ok) {
        toast.success(t.request.sent)
        setSubmitted(true)
      } else {
        if (result.error === 'duplicate') {
          // The database allows one open request per buyer and device
          toast.error(
            locale === 'ar'
              ? 'لديك طلب مفتوح لهذا الجهاز بالفعل. راجع صفحة "طلباتى" أو ألغِ الطلب الحالي أولاً.'
              : 'You already have an open request for this device. Check "My requests", or cancel the current one first.',
          )
        } else {
          toast.error(result.error === 'not_implemented' ? t.common.notImplemented : t.auth.unexpected)
        }
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
          <FeeBreakdown
            price={selectedPrice}
            locale={locale}
            t={t}
            periodLabel={periodLabel}
            deposit={isRent ? rental?.deposit : 0}
          />
        )}
        <Link href="/dashboard/buyer" className={buttonVariants({ variant: 'outline' })}>
          {t.request.viewRequests}
        </Link>
      </section>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {isRent && (
        <div className="flex flex-col gap-2 rounded-xl bg-muted/50 px-4 py-3 text-sm">
          <p>
            <span className="text-muted-foreground">{t.request.rentalPeriod}: </span>
            <span className="font-medium">
              {selectedRentPeriod === 'weekly'
                ? t.listings.weekly
                : selectedRentPeriod === 'monthly'
                  ? t.listings.monthly
                  : selectedRentPeriod === 'custom'
                    ? t.request.moreThanMonth
                    : '—'}
            </span>
          </p>
          {isCustom && (
            <div className="flex flex-col gap-2 pt-1">
              <Label htmlFor="custom-duration">{t.request.customDuration}</Label>
              <Input
                id="custom-duration"
                value={customDuration}
                onChange={(e) => rental?.setCustomDuration(e.target.value)}
                placeholder={t.request.customDurationPlaceholder}
                maxLength={200}
                className="h-10 bg-background"
              />
            </div>
          )}
        </div>
      )}

      {/* Rent listings show the breakdown near the top of the page; sell listings show it here */}
      {!isRent && selectedPrice !== null && (
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

      <Button type="submit" size="lg" className="h-10" disabled={pending || rentIncomplete}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        {t.request.send}
      </Button>
    </form>
  )
}