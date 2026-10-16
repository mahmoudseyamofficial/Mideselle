'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { resolveDispute } from '@/app/actions'
import { formatEgp } from '@/lib/fees'
import { RENTAL_TEXT } from '@/lib/rental-text'
import type { Locale } from '@/lib/i18n/dictionaries'

export function DisputeResolveForm({
  disputeId,
  locale,
  remaining,
  suggested,
  feeApplies,
}: {
  disputeId: string
  locale: Locale
  remaining: number
  suggested: number | null
  feeApplies: boolean
}) {
  const x = RENTAL_TEXT[locale]
  const router = useRouter()
  const [amount, setAmount] = useState('0')
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  const value = Number(amount)
  const amountOk = Number.isFinite(value) && value >= 0 && value <= remaining
  const noteOk = note.trim().length >= 5
  const settled = remaining <= 0

  function submit() {
    startTransition(async () => {
      const res = await resolveDispute(disputeId, value, note.trim())
      if (res.ok) {
        toast.success(x.done)
        router.refresh()
      } else {
        toast.error(`${x.failed} (${res.error})`)
      }
    })
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-3 rounded-xl border bg-muted/40 p-4">
      <p className="text-sm font-medium">
        {x.depositRemaining}: {formatEgp(remaining, locale)}
      </p>
      {settled && <p className="text-xs text-muted-foreground text-pretty">{x.depositSettledNotice}</p>}

      {suggested !== null && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setAmount(String(suggested))}>
            {x.acceptDeduction} ({formatEgp(suggested, locale)})
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setAmount('0')}>
            {x.rejectDeduction}
          </Button>
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>{x.ownerAmount}</span>
        <input
          type="number"
          min={0}
          max={remaining}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-10 rounded-md border bg-background px-3"
        />
      </label>
      {!amountOk && <p className="text-xs text-destructive">{x.amountTooHigh}</p>}

      {feeApplies && (
        <p className="text-xs text-muted-foreground text-pretty">
          {value > 0 ? x.feeRuleAward : x.feeRuleNone}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>{x.resolutionNote}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          className="min-h-20 rounded-md border bg-background px-3 py-2"
        />
      </label>
      {!noteOk && note.length > 0 && <p className="text-xs text-destructive">{x.noteRequired}</p>}

      <Button type="button" disabled={pending || !amountOk || !noteOk} onClick={submit}>
        {pending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" />}
        {x.resolve}
      </Button>
    </div>
  )
}