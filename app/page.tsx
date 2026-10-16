import Link from 'next/link'
import { HeartHandshake, ShieldCheck, Users } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { getCurrentProfile } from '@/lib/auth'
import { getDictionary } from '@/lib/i18n/server'
import Image from 'next/image'

export default async function HomePage() {
  const [{ t }, profile] = await Promise.all([getDictionary(), getCurrentProfile()])

  // Only sellers can list devices, so only they see the button (same rule as the header)
  const canList = profile?.role === 'seller'

  const trust = [
    { Icon: ShieldCheck, title: t.home.trust1Title, body: t.home.trust1Body },
    { Icon: Users, title: t.home.trust2Title, body: t.home.trust2Body },
    { Icon: HeartHandshake, title: t.home.trust3Title, body: t.home.trust3Body },
  ]
  return (
    <main>
      <section className="relative isolate flex min-h-[calc(100svh-4rem)] items-center overflow-hidden">
        <Image
          src="/images/hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-30 object-cover object-center ltr:-scale-x-100"
        />

        {/* Warm dark scrim on the text side only */}
        <div className="absolute inset-0 -z-20 bg-linear-to-r from-stone-950/85 via-stone-950/50 to-transparent rtl:bg-linear-to-l" />

        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <div className="flex max-w-xl flex-col items-start gap-6 text-white">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white ring-1 ring-white/30 backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
              {t.home.eyebrow}
            </span>

            <h1 className="text-4xl font-bold leading-snug text-balance sm:text-6xl sm:leading-snug">
              {t.home.title_1} <br /> {t.home.title_2}
            </h1>

            <p className="max-w-md text-lg leading-relaxed text-white/85 text-pretty">
              {t.home.subtitle}
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/listings"
                className={buttonVariants({ size: 'lg', className: 'shadow-lg shadow-black/30' })}
              >
                {t.home.ctaBrowse}
              </Link>
              {canList && (
                <Link
                  href="/listings/new"
                  className={buttonVariants({
                    size: 'lg',
                    variant: 'outline',
                    className:
                      'border-white/60 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white',
                  })}
                >
                  {t.home.ctaList}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <ul className="grid gap-5 md:grid-cols-3">
          {trust.map(({ Icon, title, body }) => (
            <li key={title} className="flex flex-col gap-3 rounded-2xl border bg-card p-6">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h2 className="font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground text-pretty">{body}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}