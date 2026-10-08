'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RolePicker } from '@/components/auth/role-picker'
import { createClient } from '@/lib/supabase/client'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export function OnboardingForm({
  t,
  initialRole,
}: {
  t: Dictionary['auth']
  initialRole: 'buyer' | 'seller' | null
}) {
  const router = useRouter()
  const [role, setRole] = useState(initialRole)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    if (!role) return
    setPending(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.rpc('set_initial_role', { new_role: role })
    if (error) {
      setError(t.unexpected)
      setPending(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-5">
      <RolePicker t={t} value={role} onChange={setRole} />
      <p className="text-xs text-muted-foreground">{t.roleLocked}</p>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button size="lg" className="h-10" disabled={!role || pending} onClick={confirm}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        {t.continue}
      </Button>
    </div>
  )
}
