'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { authRedirect } from '@/lib/supabase/redirect'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export function ForgotPasswordForm({ t }: { t: Dictionary['auth'] }) {
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get('email'))
    setPending(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirect('/reset-password'),
    })
    setPending(false)
    if (error) {
      setError(error.status === 429 || error.code?.startsWith('over_') ? t.rateLimited : t.unexpected)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="size-6" aria-hidden="true" />
        </span>
        <p className="text-lg font-medium text-pretty">{t.resetSent}</p>
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          {t.backToLogin}
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t.email}</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" className="h-10" />
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-10" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        {t.sendReset}
      </Button>
      <Link href="/login" className="text-center text-sm font-medium text-primary hover:underline">
        {t.backToLogin}
      </Link>
    </form>
  )
}
