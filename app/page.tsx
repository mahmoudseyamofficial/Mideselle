import Link from 'next/link'
import { HeartHandshake, ShieldCheck, Users } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { getDictionary } from '@/lib/i18n/server'

export default async function HomePage() {
  const { t } = await getDictionary()
  const trust = [
    { Icon: ShieldCheck, title: t.home.trust1Title, body: t.home.trust1Body },
    { Icon: Users, title: t.home.trust2Title, body: t.home.trust2Body },
    { Icon: HeartHandshake, title: t.home.trust3Title, body: t.home.trust3Body },
  ]
  return (
    <main>
      <section className="relative isolate overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero.jpg"
          alt=""
          className="absolute inset-0 -z-20 size-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-background/80" />
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-24 sm:py-32">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            {t.home.eyebrow}
          </span>
          <h1 className="max-w-2xl text-4xl font-semibold text-balance sm:text-5xl">{t.home.title}</h1>
          <p className="max-w-xl text-lg text-muted-foreground text-pretty">{t.home.subtitle}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/listings" className={buttonVariants({ size: 'lg' })}>
              {t.home.ctaBrowse}
            </Link>
            <Link href="/listings/new" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
              {t.home.ctaList}
            </Link>
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
