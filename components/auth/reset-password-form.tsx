'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/auth/password-input'
import { createClient } from '@/lib/supabase/client'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export function ResetPasswordForm({ t }: { t: Dictionary['auth'] }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const password = String(form.get('password'))
    if (password !== String(form.get('confirm'))) {
      setError(t.passwordsMismatch)
      return
    }
    setPending(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      if (error.code === 'weak_password') setError(t.weakPassword)
      else if (error.status === 429 || error.code?.startsWith('over_')) setError(t.rateLimited)
      else setError(t.unexpected)
      setPending(false)
      return
    }
    setDone(true)
    setTimeout(() => {
      router.push('/dashboard')
      router.refresh()
    }, 1500)
  }

  if (done) {
    return (
      <p role="status" className="rounded-lg bg-primary/10 px-3 py-3 text-center text-sm font-medium text-primary">
        {t.passwordUpdated}
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t.newPassword}</Label>
        <PasswordInput
          id="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="h-10"
          showLabel={t.showPassword}
          hideLabel={t.hidePassword}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">{t.confirmPassword}</Label>
        <PasswordInput
          id="confirm"
          name="confirm"
          required
          minLength={8}
          autoComplete="new-password"
          className="h-10"
          showLabel={t.showPassword}
          hideLabel={t.hidePassword}
        />
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-10" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        {t.updatePassword}
      </Button>
    </form>
  )
}
