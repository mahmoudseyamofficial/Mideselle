import type { Metadata } from 'next'
import { NewListingWizard } from '@/components/new-listing-wizard'
import { requireRole } from '@/lib/auth'
import { getDictionary } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary()
  return { title: t.newListing.title }
}

export default async function NewListingPage() {
  const profile = await requireRole('seller', '/listings/new')
  const { locale, t } = await getDictionary()
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-balance">{t.newListing.title}</h1>
        <p className="text-muted-foreground text-pretty">{t.newListing.subtitle}</p>
      </div>
      <NewListingWizard t={t} locale={locale} userId={profile.id} />
    </main>
  )
}
