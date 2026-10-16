'use client'

import { useState, useTransition } from 'react'
import { ClipboardCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createSellerCheck, resolveDeviceCheck } from '@/app/actions'
import { INSPECTION_FEE_EGP } from '@/lib/fees'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export function SellerCheckButton({ requestId, triggerType, t }: { requestId: string; triggerType: 'post_rental_return' | 'pre_sale_handover'; t: Dictionary }) {
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState('')
  const [pending, startTransition] = useTransition()
  const label = triggerType === 'pre_sale_handover' ? t.admin.preSale : t.admin.postRental
  return (
    <div className="flex flex-col items-start gap-2">
      <Button className="flex items-center gap-2 cursor-pointer" type="button" variant="outline" size="lg" onClick={() => setOpen((value) => !value)}>
        <ClipboardCheck data-icon="inline-start" aria-hidden="true" /> {label}
      </Button>
      {open && (
        <form className="flex w-full max-w-sm flex-col gap-3 rounded-xl border bg-muted/40 p-4" onSubmit={(event) => {
          event.preventDefault()
          startTransition(async () => {
            const result = await createSellerCheck({ requestId, triggerType, details })
            if (result.ok) { toast.success(t.common.done); setOpen(false) } else toast.error(`${t.auth.unexpected} (${result.error})`)
          })
        }}>
          <p className="text-sm font-medium">{label}</p>
          <p className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t.admin.checkCost}</span>
            <span className="font-medium">{INSPECTION_FEE_EGP.toLocaleString()} {t.common.egp}</span>
            {/* The fee is charged when the admin records the result, not when the check is requested */}
            <span className="text-xs text-muted-foreground text-pretty">{t.admin.checkFeeNote}</span>
          </p>
          <label className="flex flex-col gap-1 text-sm"><span >{t.admin.checkDetails}</span><textarea value={details} onChange={(event) => setDetails(event.target.value)} required className="min-h-20 max-h-40 rounded-md border bg-background px-3 py-2" /></label>
          <Button type="submit" className="flex items-center gap-2 cursor-pointer" disabled={pending}>{pending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" />}{t.admin.approve}</Button>
        </form>
      )}
    </div>
  )
}

/** Admin: pass or fail a check before a sale. Return checks after a rental use ReturnCheckForm instead. */
export function AdminCheckActions({ checkId, t }: { checkId: string; t: Dictionary }) {
  const [pending, startTransition] = useTransition()
  const run = (decision: 'passed' | 'failed') =>
    startTransition(async () => {
      const result = await resolveDeviceCheck(checkId, decision)
      if (result.ok) toast.success(t.common.done)
      else toast.error(`${t.auth.unexpected} (${result.error})`)
    })

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={pending} onClick={() => run('passed')}>{t.admin.checkPassed}</Button>
      <Button type="button" variant="outline" disabled={pending} onClick={() => run('failed')}>{t.admin.checkFailed}</Button>
    </div>
  )
}