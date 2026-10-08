import Link from 'next/link'
import { HeartHandshake } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { LocaleToggle } from '@/components/locale-toggle'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { getCurrentProfile } from '@/lib/auth'
import { getDictionary } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'

export async function SiteHeader() {
  const [{ locale, t }, profile] = await Promise.all([getDictionary(), getCurrentProfile()])

  const links: { href: string; label: string }[] = [{ href: '/listings', label: t.nav.browse }]
  if (profile?.role === 'seller') {
    links.push({ href: '/dashboard/seller', label: t.nav.myListings })
  }
  if (profile?.role === 'buyer') {
    links.push({ href: '/dashboard/buyer', label: t.nav.myRequests })
  }
  if (profile?.role === 'admin') {
    links.push({ href: '/admin', label: t.nav.admin })
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-foreground">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <HeartHandshake className="size-4" aria-hidden="true" />
          </span>
          <span className="text-lg">{t.brand}</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <LocaleToggle locale={locale} label={t.nav.language} />
          {profile?.role === 'seller' && (
            <Link href="/listings/new" className={cn(buttonVariants({ size: 'lg' }), 'hidden sm:inline-flex')}>
              {t.nav.list}
            </Link>
          )}
          {profile ? (
            <SignOutButton label={t.nav.logout} />
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                {t.nav.login}
              </Link>
              <Link href="/signup" className={buttonVariants({ size: 'sm' })}>
                {t.nav.signup}
              </Link>
            </>
          )}
        </div>
      </div>

      <nav aria-label="Main mobile" className="flex gap-1 overflow-x-auto border-t px-4 py-2 md:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="shrink-0 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {l.label}
          </Link>
        ))}
        {profile?.role === 'seller' && (
          <Link
            href="/listings/new"
            className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-primary hover:bg-muted"
          >
            {t.nav.list}
          </Link>
        )}
      </nav>
    </header>
  )
}
