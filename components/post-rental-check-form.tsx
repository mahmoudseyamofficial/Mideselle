    'use client'

    import { useState, useTransition } from 'react'
    import { useRouter } from 'next/navigation'
    import { Loader2 } from 'lucide-react'
    import { toast } from 'sonner'
    import { Button } from '@/components/ui/button'
    import { resolvePostRentalCheck } from '@/app/actions'
    import { createClient } from '@/lib/supabase/client'
    import { randomId } from '@/lib/random-id'
    import { RENTAL_TEXT } from '@/lib/rental-text'
    import type { Locale } from '@/lib/i18n/dictionaries'

    export function PostRentalCheckForm({ checkId, locale }: { checkId: string; locale: Locale }) {
    const x = RENTAL_TEXT[locale]
    const router = useRouter()
    const [decision, setDecision] = useState<'passed' | 'failed'>('passed')
    const [findings, setFindings] = useState('')
    const [repairCost, setRepairCost] = useState('0')
    const [file, setFile] = useState<File | null>(null)
    const [pending, startTransition] = useTransition()
    const needsFindings = decision === 'failed' && findings.trim().length < 5
    const needsEvidence = decision === 'failed' && Number(repairCost) > 0 && !file

    function submit() {
        startTransition(async () => {
        let evidenceUrl: string | null = null
        if (decision === 'failed' && file) {
            const supabase = createClient()
            const {
            data: { user },
            } = await supabase.auth.getUser()
            if (!user) {
            toast.error(x.failed)
            return
            }
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
            const path = `${user.id}/evidence/${checkId}/${randomId()}-${safeName}`
            const { error } = await supabase.storage.from('listing-photos').upload(path, file)
            if (error) {
            toast.error(`${x.failed} (${error.message})`)
            return
            }
            evidenceUrl = supabase.storage.from('listing-photos').getPublicUrl(path).data.publicUrl
        }

        const res = await resolvePostRentalCheck({
            checkId,
            decision,
            repairCost: decision === 'failed' ? Number(repairCost) || 0 : 0,
            findings: findings.trim() || null,
            evidenceUrl,
        })
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
        <div role="radiogroup" className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
            <input type="radio" name={`dec-${checkId}`} checked={decision === 'passed'} onChange={() => setDecision('passed')} className="accent-primary" />
            {x.checkPassed}
            </label>
            <label className="flex items-center gap-2">
            <input type="radio" name={`dec-${checkId}`} checked={decision === 'failed'} onChange={() => setDecision('failed')} className="accent-primary" />
            {x.checkFailed}
            </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
            <span>{x.findingsLabel}</span>
            <textarea
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            maxLength={2000}
            className="min-h-20 rounded-md border bg-background px-3 py-2"
            />
        </label>

        {decision === 'failed' && (
            <>
            <label className="flex flex-col gap-1 text-sm">
                <span>{x.repairCostLabel}</span>
                <input
                type="number"
                min={0}
                step={1}
                value={repairCost}
                onChange={(e) => setRepairCost(e.target.value)}
                className="h-10 rounded-md border bg-background px-3"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                <span>{x.evidenceLabel}</span>
                <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <span className="text-xs text-muted-foreground">{x.evidenceHelp}</span>
            </label>
            </>
        )}

            {needsFindings && <p className="text-xs text-destructive">{x.findingsRequired}</p>}
                <Button type="button" disabled={pending || needsFindings || needsEvidence} onClick={submit}>
                        {pending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" />}
                {x.confirm}
                </Button>
        </div>
    )
    }