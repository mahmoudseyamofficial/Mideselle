'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Gift, Handshake, Loader2, Tag, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { createListing } from '@/app/actions'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { uuid } from '@/lib/uuid'
import { DEVICE_TYPES, ACTIVE_GOVERNORATES, type DeviceType, type ListingType } from '@/lib/types'
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries'
import { randomId } from '@/lib/random-id'
import Image from 'next/image'

const MAX_PHOTOS = 6
const MAX_BYTES = 5 * 1024 * 1024

interface Photo {
  file: File
  preview: string
}

export function NewListingWizard({
  t,
  locale,
  userId,
}: {
  t: Dictionary
  locale: Locale
  userId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const [type, setType] = useState<ListingType | null>(null)
  const [title, setTitle] = useState('')
  const [deviceType, setDeviceType] = useState<DeviceType | ''>('')
  const [condition, setCondition] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [price, setPrice] = useState('')
  const [governorate, setGovernorate] = useState('')

  // Rent: the owner can offer weekly, monthly, or both, each with its own price
  const [offerWeekly, setOfferWeekly] = useState(false)
  const [offerMonthly, setOfferMonthly] = useState(true)
  const [weeklyPrice, setWeeklyPrice] = useState('')
  const [monthlyPrice, setMonthlyPrice] = useState('')
  const [deposit, setDeposit] = useState('')

  const n = t.newListing
  const steps = [n.stepType, n.stepDetails, n.stepPhotos, n.stepPrice]

  const typeOptions = [
    { id: 'sell' as const, label: t.type.sell, desc: n.sellDesc, Icon: Tag },
    { id: 'rent' as const, label: t.type.rent, desc: n.rentDesc, Icon: Handshake },
    { id: 'donate' as const, label: t.type.donate, desc: n.donateDesc, Icon: Gift },
  ]

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

  const depositOk = deposit === '' || Number(deposit) >= 0

  const rentOk =
    (offerWeekly || offerMonthly) &&
    (!offerWeekly || Number(weeklyPrice) > 0) &&
    (!offerMonthly || Number(monthlyPrice) > 0) &&
    depositOk

  function canContinue() {
    if (step === 1) return type !== null
    if (step === 2) return title.trim().length > 2 && deviceType !== '' && condition.trim().length > 9
    if (step === 3) return photos.length > 0
    if (governorate === '') return false
    if (type === 'rent') return rentOk
    if (type === 'sell') return Number(price) > 0
    return true
  }

  function addPhotos(files: FileList | null) {
    if (!files) return
    const accepted = Array.from(files)
      .filter((f) => f.type.startsWith('image/') && f.size <= MAX_BYTES)
      .slice(0, MAX_PHOTOS - photos.length)
      .map((file) => ({ file, preview: URL.createObjectURL(file) }))
    setPhotos((p) => [...p, ...accepted])
  }

  function removePhoto(index: number) {
    setPhotos((p) => {
      URL.revokeObjectURL(p[index].preview)
      return p.filter((_, i) => i !== index)
    })
  }

  function submit() {
    if (!type || !deviceType) return
    setError(null)
    startTransition(async () => {
      const supabase = createClient()
      const urls: string[] = []
      for (const { file } of photos) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${userId}/${randomId()}-${safeName}`
        const { error: uploadError } = await supabase.storage.from('listing-photos').upload(path, file)
        if (uploadError) {
          setError(t.auth.unexpected)
          return
        }
        urls.push(supabase.storage.from('listing-photos').getPublicUrl(path).data.publicUrl)
      }

      const isRent = type === 'rent'
      const result = await createListing({
        type,
        title: title.trim(),
        device_type: deviceType,
        condition_description: condition.trim(),
        photos: urls,
        price: type === 'sell' ? Number(price) : null,
        rentPeriods: isRent
          ? [...(offerWeekly ? ['weekly' as const] : []), ...(offerMonthly ? ['monthly' as const] : [])]
          : [],
        rentWeeklyPrice: isRent && offerWeekly ? Number(weeklyPrice) : null,
        rentMonthlyPrice: isRent && offerMonthly ? Number(monthlyPrice) : null,
        governorate,
        deposit: isRent ? Number(deposit) || 0 : null,
      })
      if (result.ok) {
        toast.success(n.submitted)
        router.push('/dashboard/seller')
      } else {
        toast.error(result.error === 'not_implemented' ? t.common.notImplemented : t.auth.unexpected)
      }
    })
  }

  const fmt = (v: number) => v.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en')

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex items-center gap-2" aria-label={`${n.stepOf} ${fmt(step)} ${n.of} ${fmt(4)}`}>
        {steps.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col gap-1.5">
            <span className={cn('h-1.5 rounded-full bg-muted', i < step && 'bg-primary')} />
            <span className={cn('hidden text-xs text-muted-foreground sm:block', i + 1 === step && 'font-medium text-foreground')}>
              {label}
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-5 rounded-2xl border bg-card p-6">
        {step === 1 && (
          <>
            <h2 className="text-lg font-semibold">{n.chooseType}</h2>
            <div role="radiogroup" aria-label={n.chooseType} className="grid gap-3 sm:grid-cols-3">
              {typeOptions.map(({ id, label, desc, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={type === id}
                  onClick={() => setType(id)}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-xl border p-4 text-start transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-ring',
                    type === id && 'border-primary bg-primary/5 ring-2 ring-primary/30',
                  )}
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="font-medium">{label}</span>
                  <span className="text-sm text-muted-foreground text-pretty">{desc}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">{n.listingTitle}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={n.listingTitlePlaceholder}
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
                <NativeSelectOption value="" disabled>
                  {n.deviceType}
                </NativeSelectOption>
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
                placeholder={n.conditionPlaceholder}
                maxLength={2000}
              />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="photos">{n.photos}</Label>
              <p className="text-sm text-muted-foreground">{n.photosHelp}</p>
              {photos.length < MAX_PHOTOS && (
                <Input
                  id="photos"
                  type="file"
                  accept="image/*"
                  multiple
                  className="h-10"
                  onChange={(e) => {
                    addPhotos(e.target.files)
                    e.target.value = ''
                  }}
                />
              )}
            </div>
            {photos.length > 0 && (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {photos.map((p, i) => (
                  <li key={p.preview} className="relative aspect-square overflow-hidden rounded-xl border">
                    <Image 
                        loading='lazy'
                        width={1000}
                        height={1000}
                        src={p.preview}
                        alt="" 
                        className="size-full object-cover" 
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      aria-label={n.removePhoto}
                      className="absolute inset-e-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-background/90 shadow hover:bg-background"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {step === 4 && (
          <>
            {type === 'rent' && (
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

                <div className="flex flex-col gap-2 rounded-xl border p-4">
                  <Label htmlFor="rent-deposit">{n.deposit}</Label>
                  <Input
                    id="rent-deposit"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                    className="h-10 bg-background"
                  />
                  <p className="text-xs text-muted-foreground text-pretty">{n.depositHelp}</p>
                </div>
              </div>
            )}

            {type === 'sell' && (
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

            {type === 'donate' && (
              <p className="rounded-xl bg-muted px-4 py-3 text-sm text-pretty">{n.donationNote}</p>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="gov">{n.governorate}</Label>
              <NativeSelect
                id="gov"
                value={governorate}
                onChange={(e) => setGovernorate(e.target.value)}
                className="w-full [&_select]:h-10"
              >
                <NativeSelectOption value="" disabled>
                  {n.selectGovernorate}
                </NativeSelectOption>
                {ACTIVE_GOVERNORATES.map((g) => (
                  <NativeSelectOption key={g.id} value={g.id}>
                    {g[locale]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="flex justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-10"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1 || pending}
        >
          {n.back}
        </Button>
        {step < 4 ? (
          <Button type="button" size="lg" className="h-10" disabled={!canContinue()} onClick={() => setStep((s) => s + 1)}>
            {n.next}
          </Button>
        ) : (
          <Button type="button" size="lg" className="h-10" disabled={!canContinue() || pending} onClick={submit}>
            {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {pending ? n.uploading : n.submit}
          </Button>
        )}
      </div>
    </div>
  )
}