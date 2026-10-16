'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { proposePrice } from '@/app/actions'
import { RENTAL_TEXT } from '@/lib/rental-text'
import type { Locale } from '@/lib/i18n/dictionaries'

export function ProposePriceForm({ requestId, locale }: { requestId: string; locale: Locale }) {
  const x = RENTAL_TEXT[locale]
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [price, setPrice] = useState('')
  const [days, setDays] = useState('')
  const [pending, startTransition] = useTransition()

  const d = Number(days)
  const valid = Number(price) > 0 && Number.isInteger(d) && d >= 1 && d <= 365

  function submit() {
    startTransition(async () => {
      const res = await proposePrice(requestId, Number(price), d)
      if (res.ok) {
        toast.success(x.done)
        setOpen(false)
        router.refresh()
      } else {
        toast.error(`${x.failed} (${res.error})`)
      }
    })
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" onClick={() => setOpen((v) => !v)}>
        {x.proposePrice}
      </Button>
      {open && (
        <div className="flex w-full max-w-sm flex-col gap-3 rounded-xl border bg-muted/40 p-4">
          <label className="flex flex-col gap-1 text-sm">
            <span>{x.proposalPriceLabel}</span>
            <input
              type="number"
              min={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="h-10 rounded-md border bg-background px-3"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{x.proposalDaysLabel}</span>
            <input
              type="number"
              min={1}
              max={365}
              step={1}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="h-10 rounded-md border bg-background px-3"
            />
          </label>
          <Button type="button" disabled={pending || !valid} onClick={submit}>
            {pending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" />}
            {x.proposalSend}
          </Button>
        </div>
      )}
    </div>
  )
}