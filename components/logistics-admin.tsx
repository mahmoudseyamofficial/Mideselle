'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, Truck, X } from 'lucide-react'
import { toast } from 'sonner'
import { ActionButton } from '@/components/action-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  advanceShipment,
  bookShipment,
  closeRequestAfterFailedCheck,
  completeRequestAsAdmin,
} from '@/app/actions'
import {
  HUB,
  LOGISTICS_TEXT,
  endsAtHub,
  isFinished,
  nextStatus,
  startsAtHub,
  type ShipmentFull,
  type ShipmentLeg,
} from '@/lib/logistics'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type Locale = 'ar' | 'en'

function messages(t: Dictionary) {
  return {
    successMessage: t.common.done,
    notImplementedMessage: t.common.notImplemented,
    errorMessage: t.auth.unexpected,
  }
}

/** Form to book one leg. The company's own address is filled in on the hub side. */
export function BookShipmentForm({
  requestId,
  leg,
  locale,
  t,
}: {
  requestId: string
  leg: ShipmentLeg
  locale: Locale
  t: Dictionary
}) {
  const tx = LOGISTICS_TEXT[locale]
  const [pending, startTransition] = useTransition()

  const [fromAddress, setFromAddress] = useState(startsAtHub(leg) ? HUB.address : '')
  const [fromPhone, setFromPhone] = useState(startsAtHub(leg) ? HUB.phone : '')
  const [toAddress, setToAddress] = useState(endsAtHub(leg) ? HUB.address : '')
  const [toPhone, setToPhone] = useState(endsAtHub(leg) ? HUB.phone : '')
  const [fee, setFee] = useState('')
  const [tracking, setTracking] = useState('')

  const valid =
    fromAddress.trim() !== '' && fromPhone.trim() !== '' && toAddress.trim() !== '' && toPhone.trim() !== ''

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!valid) return
    startTransition(async () => {
      const result = await bookShipment({
        requestId,
        leg,
        fromAddress,
        fromPhone,
        toAddress,
        toPhone,
        fee: Number(fee) || 0,
        tracking: tracking.trim() || null,
      })
      if (result.ok) toast.success(tx.booked)
      else toast.error(result.error === 'duplicate' ? tx.duplicate : t.auth.unexpected)
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Truck className="size-4" aria-hidden="true" />
        {tx.book[leg]}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`from-address-${requestId}-${leg}`}>{tx.fromAddress}</Label>
          <Input
            id={`from-address-${requestId}-${leg}`}
            value={fromAddress}
            onChange={(e) => setFromAddress(e.target.value)}
            className="h-10 bg-background"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`from-phone-${requestId}-${leg}`}>{tx.fromPhone}</Label>
          <Input
            id={`from-phone-${requestId}-${leg}`}
            type="tel"
            value={fromPhone}
            onChange={(e) => setFromPhone(e.target.value)}
            className="h-10 bg-background"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`to-address-${requestId}-${leg}`}>{tx.toAddress}</Label>
          <Input
            id={`to-address-${requestId}-${leg}`}
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            className="h-10 bg-background"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`to-phone-${requestId}-${leg}`}>{tx.toPhone}</Label>
          <Input
            id={`to-phone-${requestId}-${leg}`}
            type="tel"
            value={toPhone}
            onChange={(e) => setToPhone(e.target.value)}
            className="h-10 bg-background"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`fee-${requestId}-${leg}`}>{tx.fee}</Label>
          <Input
            id={`fee-${requestId}-${leg}`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="h-10 bg-background"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`tracking-${requestId}-${leg}`}>{tx.tracking}</Label>
          <Input
            id={`tracking-${requestId}-${leg}`}
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            className="h-10 bg-background"
          />
        </div>
      </div>

      <Button type="submit" className="w-fit" disabled={!valid || pending}>
        {pending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" />}
        {pending ? tx.booking : tx.submit}
      </Button>
    </form>
  )
}

/** Moves a leg to its next status, or marks it failed. */
export function AdvanceShipmentButtons({
  shipment,
  locale,
  t,
}: {
  shipment: ShipmentFull
  locale: Locale
  t: Dictionary
}) {
  const tx = LOGISTICS_TEXT[locale]
  const m = messages(t)
  if (isFinished(shipment.status)) return null

  const next = nextStatus(shipment.leg, shipment.status)
  if (!next) return null

  const label =
    next === 'picked_up' ? tx.toInTransit : next === 'received_at_hub' ? tx.toReceivedAtHub : tx.toDelivered

  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton
        {...m}
        icon={<Check data-icon="inline-start" aria-hidden="true" />}
        action={() => advanceShipment(shipment.id, next)}
      >
        {label}
      </ActionButton>
      <ActionButton
        {...m}
        variant="outline"
        icon={<X data-icon="inline-start" aria-hidden="true" />}
        action={() => advanceShipment(shipment.id, 'failed')}
      >
        {tx.fail}
      </ActionButton>
    </div>
  )
}

export function CompleteRequestButton({
  requestId,
  locale,
  t,
}: {
  requestId: string
  locale: Locale
  t: Dictionary
}) {
  const tx = LOGISTICS_TEXT[locale]
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm text-muted-foreground text-pretty">{tx.completeHelp}</p>
      <ActionButton
        {...messages(t)}
        icon={<Check data-icon="inline-start" aria-hidden="true" />}
        action={() => completeRequestAsAdmin(requestId)}
      >
        {tx.completeRequest}
      </ActionButton>
    </div>
  )
}

export function CloseRequestButton({
  requestId,
  locale,
  t,
}: {
  requestId: string
  locale: Locale
  t: Dictionary
}) {
  const tx = LOGISTICS_TEXT[locale]
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm text-muted-foreground text-pretty">{tx.closeHelp}</p>
      <ActionButton
        {...messages(t)}
        variant="outline"
        icon={<X data-icon="inline-start" aria-hidden="true" />}
        action={() => closeRequestAfterFailedCheck(requestId)}
      >
        {tx.closeRequest}
      </ActionButton>
    </div>
  )
}