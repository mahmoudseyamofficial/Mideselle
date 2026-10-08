'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { authRedirect } from '@/lib/supabase/redirect'

export function GoogleButton({ label, next }: { label: string; next: string }) {
  const [pending, setPending] = useState(false)

  async function signIn() {
    setPending(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authRedirect(next), skipBrowserRedirect: true },
    })
    setPending(false)
    if (error || !data.url) return
    // Google refuses to render inside an iframe (the v0 preview), so leave the frame.
    if (window.self !== window.top) window.open(data.url, '_blank', 'noopener')
    else window.location.assign(data.url)
  }

  return (
    <Button type="button" variant="outline" size="lg" className="h-10 w-full" onClick={signIn} disabled={pending}>
      {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
        <path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-8z" />
        <path fill="#34A853" d="M12 23c3 0 5.4-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1-3.7 1-2.8 0-5.2-1.9-6-4.5H2.4v2.8A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M6 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.4a11 11 0 0 0 0 9.8L6 14.1z" />
        <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.1 1.600l3.100-3.100A11 11 0 0 0 2.400 7.100L6 9.900c.800-2.600 3.200-4.500 6-4.500z" />
      </svg>
      {label}
    </Button>
  )
}
