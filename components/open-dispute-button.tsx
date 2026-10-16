'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { openDispute } from '@/app/actions'
import { RENTAL_TEXT } from '@/lib/rental-text'
import type { Locale } from '@/lib/i18n/dictionaries'

type Kind = 'device_not_returned' | 'condition_at_receipt' | 'deduction_contested' | 'other'

export function OpenDisputeButton({ requestId, kind, locale }: { requestId: string; kind: Kind; locale: Locale }) {
  const x = RENTAL_TEXT[locale]
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const res = await openDispute({ requestId, kind, reason: reason.trim() })
      if (res.ok) {
        toast.success(x.done)
        setOpen(false)
        setReason('')
        router.refresh()
      } else {
        toast.error(`${x.failed} (${res.error})`)
      }
    })
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" variant="outline" onClick={() => setOpen((v) => !v)}>
        <AlertTriangle data-icon="inline-start" aria-hidden="true" />
        {x.kinds[kind]}
      </Button>
      {open && (
        <div className="flex w-full max-w-sm flex-col gap-3 rounded-xl border bg-muted/40 p-4">
          <label className="flex flex-col gap-1 text-sm">
            <span>{x.reasonLabel}</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
              className="min-h-24 rounded-md border bg-background px-3 py-2"
            />
          </label>
          <Button type="button" disabled={pending || reason.trim().length < 5} onClick={submit}>
            {pending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" />}
            {x.submit}
          </Button>
        </div>
      )}
    </div>
  )
}