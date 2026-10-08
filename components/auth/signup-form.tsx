'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleButton } from '@/components/auth/google-button'
import { RolePicker } from '@/components/auth/role-picker'
import { PasswordInput } from '@/components/auth/password-input'
import { createClient } from '@/lib/supabase/client'
import { authRedirect } from '@/lib/supabase/redirect'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export function SignupForm({ t }: { t: Dictionary['auth'] }) {
  const router = useRouter()
  const [role, setRole] = useState<'buyer' | 'seller' | null>(null)
  const [step, setStep] = useState<1 | 2>(1)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!role) return
    const form = new FormData(e.currentTarget)
    setPending(true)
    setError(null)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: String(form.get('email')),
      password: String(form.get('password')),
      options: {
        emailRedirectTo: authRedirect('/dashboard'),
        data: { role, full_name: String(form.get('full_name')) },
      },
    })
    if (error) {
      if (error.code === 'weak_password') setError(t.weakPassword)
      else if (error.status === 429 || error.code?.startsWith('over_')) setError(t.rateLimited)
      else setError(t.unexpected)
      setPending(false)
      return
    }
    if (data.session) {
      router.push('/dashboard')
      router.refresh()
      return
    }
    setSent(true)
    setPending(false)
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="size-6" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-semibold">{t.checkEmailTitle}</h2>
        <p className="text-muted-foreground text-pretty">{t.checkEmailBody}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {step === 1 ? (
        <>
          <p className="text-sm font-medium">{t.chooseRole}</p>
          <RolePicker t={t} value={role} onChange={setRole} />
          <Button size="lg" className="h-10" disabled={!role} onClick={() => setStep(2)}>
            {t.continue}
          </Button>
        </>
      ) : (
        <>
          <GoogleButton label={t.google} next={`/onboarding?role=${role}`} />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t.or}
            <span className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="full_name">{t.fullName}</Label>
              <Input id="full_name" name="full_name" required autoComplete="name" className="h-10" />
            </div>
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
                minLength={8}
                autoComplete="new-password"
                className="h-10"
                showLabel={t.showPassword}
                hideLabel={t.hidePassword}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t.roleLocked}</p>
            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="lg" className="h-10" onClick={() => setStep(1)}>
                {t.back}
              </Button>
              <Button type="submit" size="lg" className="h-10 flex-1" disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
                {t.submitSignup}
              </Button>
            </div>
          </form>
        </>
      )}
      <p className="text-center text-sm text-muted-foreground">
        {t.haveAccount}{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t.submitLogin}
        </Link>
      </p>
    </div>
  )
}
