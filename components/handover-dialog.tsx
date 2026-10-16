    'use client'

    import { useState, useTransition } from 'react'
    import { useRouter } from 'next/navigation'
    import { Camera, Loader2, X } from 'lucide-react'
    import { toast } from 'sonner'
    import { Button } from '@/components/ui/button'
    import { completeRequest, confirmHandover } from '@/app/actions'
    import { createClient } from '@/lib/supabase/client'
    import { RENTAL_TEXT } from '@/lib/rental-text'
    import type { Locale } from '@/lib/i18n/dictionaries'
    import { randomId } from '@/lib/random-id'
    import Image from 'next/image'

    const MAX_PHOTOS = 6
    const MAX_BYTES = 5 * 1024 * 1024

    type Photo = { file: File; preview: string }

    export function HandoverButton({
    requestId,
    party,
    locale,
    }: {
    requestId: string
    party: 'seller_handover' | 'buyer_receipt'
    locale: Locale
    }) {
    const x = RENTAL_TEXT[locale]
    const router = useRouter()
    const isSeller = party === 'seller_handover'
    const [open, setOpen] = useState(false)
    const [photos, setPhotos] = useState<Photo[]>([])
    const [conditionOk, setConditionOk] = useState(true)
    const [note, setNote] = useState('')
    const [pending, startTransition] = useTransition()

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
        if (photos.length === 0) {
        toast.error(x.photosRequired)
        return
        }
        if (!isSeller && !conditionOk && note.trim().length < 5) {
        toast.error(x.describeProblem)
        return
        }

        startTransition(async () => {
        const supabase = createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
            toast.error(x.failed)
            return
        }

        const urls: string[] = []
        for (const { file } of photos) {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
            const path = `${user.id}/handover/${requestId}/${randomId()}-${safeName}`
            const { error } = await supabase.storage.from('listing-photos').upload(path, file)
            if (error) {
            toast.error(`${x.failed} (${error.message})`)
            return
            }
            urls.push(supabase.storage.from('listing-photos').getPublicUrl(path).data.publicUrl)
        }

        const res = await confirmHandover({
            requestId,
            party,
            photos: urls,
            conditionOk: isSeller ? true : conditionOk,
            note: isSeller ? null : note.trim() || null,
        })
        if (!res.ok) {
            toast.error(`${x.failed} (${res.error})`)
            return
        }

        if (isSeller) {
            const done = await completeRequest(requestId)
            if (!done.ok) {
            toast.error(`${x.failed} (${done.error})`)
            router.refresh()
            return
            }
        }

        toast.success(x.done)
        setOpen(false)
        router.refresh()
        })
    }

    return (
        <div className="flex w-full flex-col items-start gap-2">
        <Button type="button" variant={isSeller ? 'secondary' : 'default'} onClick={() => setOpen((v) => !v)}>
            <Camera data-icon="inline-start" aria-hidden="true" />
            {isSeller ? x.handoverButton : x.receiptButton}
        </Button>

        {open && (
            <div className="flex w-full max-w-md flex-col gap-3 rounded-xl border bg-muted/40 p-4">
            <p className="text-sm font-medium">{isSeller ? x.handoverTitle : x.receiptTitle}</p>
            <p className="text-xs text-muted-foreground text-pretty">{isSeller ? x.handoverHelp : x.receiptHelp}</p>

            {photos.length < MAX_PHOTOS && (
                <label className="flex flex-col gap-1 text-sm">
                <span>{x.addPhotos}</span>
                <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                    addPhotos(e.target.files)
                    e.target.value = ''
                    }}
                />
                </label>
            )}

            {photos.length > 0 && (
                <ul className="grid grid-cols-3 gap-2">
                {photos.map((p, i) => (
                    <li key={p.preview} className="relative aspect-square overflow-hidden rounded-lg border">
                    <Image 
                    src={p.preview} 
                    loading='lazy'
                    width={1000}
                    height={1000}
                    alt="" 
                    className="size-full object-cover" />
                    <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        aria-label={x.removePhoto}
                        className="absolute inset-e-1 top-1 flex size-6 items-center justify-center rounded-full bg-background/90 shadow"
                    >
                        <X className="size-3.5" aria-hidden="true" />
                    </button>
                    </li>
                ))}
                </ul>
            )}

            {!isSeller && (
                <>
                <div role="radiogroup" className="flex flex-col gap-2 text-sm">
                    <label className="flex items-center gap-2">
                    <input type="radio" name={`cond-${requestId}`} checked={conditionOk} onChange={() => setConditionOk(true)} className="accent-primary" />
                    {x.working}
                    </label>
                    <label className="flex items-center gap-2">
                    <input type="radio" name={`cond-${requestId}`} checked={!conditionOk} onChange={() => setConditionOk(false)} className="accent-primary" />
                    {x.notWorking}
                    </label>
                </div>
                <label className="flex flex-col gap-1 text-sm">
                    <span>{x.note}</span>
                    <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={1000}
                    className="min-h-20 rounded-md border bg-background px-3 py-2"
                    />
                </label>
                </>
            )}

            <Button type="button" disabled={pending} onClick={submit}>
                {pending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" />}
                {x.confirm}
            </Button>
            </div>
        )}
        </div>
    )
    }