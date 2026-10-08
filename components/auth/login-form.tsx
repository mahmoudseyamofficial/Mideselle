'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleButton } from '@/components/auth/google-button'
import { PasswordInput } from '@/components/auth/password-input'
import { createClient } from '@/lib/supabase/client'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export function LoginForm({ t, next }: { t: Dictionary['auth']; next: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setPending(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get('email')),
      password: String(form.get('password')),
    })
    if (error) {
      if (error.code === 'email_not_confirmed') setError(t.unconfirmed)
      else if (error.status === 429 || error.code?.startsWith('over_')) setError(t.rateLimited)
      else if (error.code === 'invalid_credentials') setError(t.invalid)
      else setError(t.unexpected)
      setPending(false)
      return
    }
    router.push(next)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-5">
      <GoogleButton label={t.google} next={next} />
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t.or}
        <span className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t.email}</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" className="h-10" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t.password}</Label>
          <PasswordInput
            id="password"
            name="password"
            required
            autoComplete="current-password"
            className="h-10"
            showLabel={t.showPassword}
            hideLabel={t.hidePassword}
          />
          <Link href="/forgot-password" className="self-end text-sm font-medium text-primary hover:underline">
            {t.forgotPassword}
          </Link>
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="h-10" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {t.submitLogin}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {t.noAccount}{' '}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          {t.submitSignup}
        </Link>
      </p>
    </div>
  )
}
