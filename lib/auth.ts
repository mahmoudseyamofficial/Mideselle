import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile, UserRole } from '@/lib/types'

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .maybeSingle()

  return (data as Profile | null) ?? { id: user.id, email: user.email ?? '', full_name: null, role: null }
}

export async function requireRole(role: UserRole, next: string): Promise<Profile> {
  const profile = await getCurrentProfile()
  if (!profile) redirect(`/login?next=${encodeURIComponent(next)}`)
  if (!profile.role) redirect('/onboarding')
  if (profile.role !== role) redirect(homeForRole(profile.role))
  return profile
}

export function homeForRole(role: UserRole | null) {
  if (role === 'admin') return '/admin'
  if (role === 'seller') return '/dashboard/seller'
  if (role === 'buyer') return '/dashboard/buyer'
  return '/onboarding'
}
