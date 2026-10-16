    'use client'

    import { useState, useTransition } from 'react'
    import { Check, Loader2, X } from 'lucide-react'
    import { toast } from 'sonner'
    import { Button } from '@/components/ui/button'
    import { Input } from '@/components/ui/input'
    import { Label } from '@/components/ui/label'
    import { resolvePostRentalCheck } from '@/app/actions'
    import type { Dictionary } from '@/lib/i18n/dictionaries'

    type Locale = 'ar' | 'en'

    const TEXT = {
    en: {
        passedHelp: 'Passed: the seller is charged the inspection fee and the full deposit goes back to the renter.',
        failedHelp:
        'Failed: the renter has 48 hours to contest. After that, the repair cost is taken from the deposit, then the inspection fee.',
        markPassed: 'Passed',
        markFailed: 'Failed…',
        findings: 'Findings (what was wrong)',
        repairCost: 'Repair cost (EGP)',
        repairHelp: 'Taken from the held deposit. Leave 0 if nothing needs repairing.',
        evidence: 'Evidence link (photo or report)',
        evidenceHelp: 'Required when the repair cost is above 0.',
        submitFailed: 'Record failed result',
        cancel: 'Cancel',
        saved: 'Result recorded',
    },
    ar: {
        passedHelp: 'ناجح: يتحمل البائع رسوم الفحص، وتعود الوديعة كاملة إلى المستأجر.',
        failedHelp:
        'فاشل: للمستأجر ٤٨ ساعة للاعتراض. بعدها تُخصم تكلفة الإصلاح من الوديعة، ثم رسوم الفحص.',
        markPassed: 'ناجح',
        markFailed: 'فاشل…',
        findings: 'نتائج الفحص (ما المشكلة)',
        repairCost: 'تكلفة الإصلاح (جنيه)',
        repairHelp: 'تُخصم من الوديعة المحتجزة. اتركها 0 إن لم يحتج الجهاز إلى إصلاح.',
        evidence: 'رابط الدليل (صورة أو تقرير)',
        evidenceHelp: 'مطلوب عندما تكون تكلفة الإصلاح أكبر من 0.',
        submitFailed: 'تسجيل نتيجة فاشلة',
        cancel: 'إلغاء',
        saved: 'تم تسجيل النتيجة',
    },
    } as const

    /** Admin: result of a check done after a rental. It uses the rental rules for the deposit. */
    export function ReturnCheckForm({
    checkId,
    locale,
    t,
    }: {
    checkId: string
    locale: Locale
    t: Dictionary
    }) {
    const x = TEXT[locale]
    const [pending, startTransition] = useTransition()
    const [failing, setFailing] = useState(false)
    const [findings, setFindings] = useState('')
    const [repairCost, setRepairCost] = useState('0')
    const [evidence, setEvidence] = useState('')

    const repair = Number(repairCost)
    const validFailed =
        findings.trim().length >= 5 &&
        Number.isFinite(repair) &&
        repair >= 0 &&
        (repair === 0 || /^https?:\/\//i.test(evidence.trim()))

    function submit(decision: 'passed' | 'failed') {
        startTransition(async () => {
        const result = await resolvePostRentalCheck({
            checkId,
            decision,
            repairCost: decision === 'failed' ? repair : 0,
            findings: decision === 'failed' ? findings.trim() : '',
            evidenceUrl: decision === 'failed' && evidence.trim() ? evidence.trim() : null,
        })
        if (result.ok) {
            toast.success(x.saved)
            setFailing(false)
        } else {
            toast.error(`${t.auth.unexpected} (${result.error})`)
        }
        })
    }

    if (!failing) {
        return (
        <div className="flex flex-col items-start gap-2">
            <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={pending} onClick={() => submit('passed')}>
                {pending ? (
                <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" />
                ) : (
                <Check data-icon="inline-start" aria-hidden="true" />
                )}
                {x.markPassed}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setFailing(true)}>
                <X data-icon="inline-start" aria-hidden="true" />
                {x.markFailed}
            </Button>
            </div>
            <p className="text-xs text-muted-foreground text-pretty">{x.passedHelp}</p>
            <p className="text-xs text-muted-foreground text-pretty">{x.failedHelp}</p>
        </div>
        )
    }

    return (
        <form
        className="flex w-full max-w-md flex-col gap-3 rounded-xl border bg-muted/40 p-4"
        onSubmit={(e) => {
            e.preventDefault()
            if (validFailed) submit('failed')
        }}
        >
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={`findings-${checkId}`}>{x.findings}</Label>
            <textarea
            id={`findings-${checkId}`}
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            required
            className="min-h-20 max-h-40 rounded-md border bg-background px-3 py-2 text-sm"
            />
        </div>

        <div className="flex flex-col gap-1.5">
            <Label htmlFor={`repair-${checkId}`}>{x.repairCost}</Label>
            <Input
            id={`repair-${checkId}`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={repairCost}
            onChange={(e) => setRepairCost(e.target.value)}
            className="h-10 bg-background"
            />
            <p className="text-xs text-muted-foreground">{x.repairHelp}</p>
        </div>

        <div className="flex flex-col gap-1.5">
            <Label htmlFor={`evidence-${checkId}`}>{x.evidence}</Label>
            <Input
            id={`evidence-${checkId}`}
            type="url"
            inputMode="url"
            placeholder="https://"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            className="h-10 bg-background"
            />
            <p className="text-xs text-muted-foreground">{x.evidenceHelp}</p>
        </div>

        <p className="text-xs text-muted-foreground text-pretty">{x.failedHelp}</p>

        <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!validFailed || pending}>
            {pending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" />}
            {x.submitFailed}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setFailing(false)}>
            {x.cancel}
            </Button>
        </div>
        </form>
    )
    }