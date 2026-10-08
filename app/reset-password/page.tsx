import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthShell } from '@/components/auth/auth-shell'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { getDictionary } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary()
  return { title: t.auth.resetTitle }
}

export default async function ResetPasswordPage() {
  const { t } = await getDictionary()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <AuthShell title={t.auth.resetTitle} subtitle={t.auth.resetSubtitle}>
      {user ? (
        <ResetPasswordForm t={t.auth} />
      ) : (
        <div className="flex flex-col gap-3 text-center">
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {t.auth.resetExpired}
          </p>
          <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            {t.auth.sendReset}
          </Link>
        </div>
      )}
    </AuthShell>
  )
}
