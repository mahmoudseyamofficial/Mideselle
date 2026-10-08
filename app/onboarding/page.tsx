import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/auth/auth-shell'
import { OnboardingForm } from '@/components/auth/onboarding-form'
import { getCurrentProfile, homeForRole } from '@/lib/auth'
import { getDictionary } from '@/lib/i18n/server'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>
}) {
  const [{ t }, profile, { role }] = await Promise.all([
    getDictionary(),
    getCurrentProfile(),
    searchParams,
  ])
  if (!profile) redirect('/login?next=/onboarding')
  if (profile.role) redirect(homeForRole(profile.role))

  const initialRole = role === 'buyer' || role === 'seller' ? role : null
  return (
    <AuthShell title={t.auth.onboardingTitle} subtitle={t.auth.onboardingSubtitle}>
      <OnboardingForm t={t.auth} initialRole={initialRole} />
    </AuthShell>
  )
}
