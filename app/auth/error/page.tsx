import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { getDictionary } from '@/lib/i18n/server'

export default async function AuthErrorPage() {
  const { t } = await getDictionary()
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold text-balance">{t.auth.errorTitle}</h1>
      <p className="text-muted-foreground text-pretty">{t.auth.errorBody}</p>
      <Link href="/login" className={buttonVariants({ size: 'lg' })}>
        {t.nav.login}
      </Link>
    </main>
  )
}
