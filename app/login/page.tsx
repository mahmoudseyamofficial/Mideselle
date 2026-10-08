import type { Metadata } from 'next'
import { AuthShell } from '@/components/auth/auth-shell'
import { LoginForm } from '@/components/auth/login-form'
import { getDictionary } from '@/lib/i18n/server'
import { safeNext } from '@/lib/supabase/redirect'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary()
  return { title: t.nav.login }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { t } = await getDictionary()
  const { next } = await searchParams
  return (
    <AuthShell title={t.auth.loginTitle} subtitle={t.auth.loginSubtitle}>
      <LoginForm t={t.auth} next={safeNext(next)} />
    </AuthShell>
  )
}
