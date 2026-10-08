'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LOCALE_COOKIE, type Locale } from '@/lib/i18n/dictionaries'

export function LocaleToggle({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const next: Locale = locale === 'ar' ? 'en' : 'ar'

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      lang={next}
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
        startTransition(() => router.refresh())
      }}
    >
      <Languages data-icon="inline-start" aria-hidden="true" />
      {label}
    </Button>
  )
}
