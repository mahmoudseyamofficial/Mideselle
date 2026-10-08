'use client'

import { useState, useTransition } from 'react'
import { ClipboardCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createSellerCheck } from '@/app/actions'
import { INSPECTION_FEE_EGP } from '@/lib/fees'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export function SellerCheckButton({ requestId, triggerType, t }: { requestId: string; triggerType: 'post_rental_return' | 'pre_sale_handover'; t: Dictionary }) {
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState('')
  const [pending, startTransition] = useTransition()
  const label = triggerType === 'pre_sale_handover' ? t.admin.preSale : t.admin.postRental
  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" variant="outline" size="lg" onClick={() => setOpen((value) => !value)}>
        <ClipboardCheck data-icon="inline-start" aria-hidden="true" /> {label}
      </Button>
      {open && (
        <form className="flex w-full max-w-sm flex-col gap-3 rounded-xl border bg-muted/40 p-4" onSubmit={(event) => {
          event.preventDefault()
          startTransition(async () => {
            const result = await createSellerCheck({ requestId, triggerType, details })
            if (result.ok) { toast.success(t.common.done); setOpen(false) } else toast.error(t.auth.unexpected)
          })
        }}>
          <p className="text-sm font-medium">{label}</p>
          <p className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t.admin.checkCost}</span>
            <span className="font-medium">{INSPECTION_FEE_EGP.toLocaleString()} {t.common.egp}</span>
          </p>
          <label className="flex flex-col gap-1 text-sm"><span>{t.admin.checkDetails}</span><textarea value={details} onChange={(event) => setDetails(event.target.value)} className="min-h-20 rounded-md border bg-background px-3 py-2" /></label>
          <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" />}{t.admin.approve}</Button>
        </form>
      )}
    </div>
  )
}

import { resolveDeviceCheck } from '@/app/actions'

export function AdminCheckActions({ checkId, t }: { checkId: string; t: Dictionary }) {
  const action = (decision: 'passed' | 'failed') => resolveDeviceCheck(checkId, decision)
  return <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => action('passed')}>{t.admin.checkPassed}</Button><Button type="button" variant="outline" onClick={() => action('failed')}>{t.admin.checkFailed}</Button></div>
}
