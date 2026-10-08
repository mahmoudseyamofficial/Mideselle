import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { ListingCard } from '@/components/listing-card'
import { createClient } from '@/lib/supabase/server'
import { getDictionary } from '@/lib/i18n/server'
import { DEVICE_TYPES, ACTIVE_GOVERNORATES, GOVERNORATES, LISTING_TYPES, type Listing } from '@/lib/types'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary()
  return { title: t.listings.title, description: t.listings.subtitle }
}

type SearchParams = { governorate?: string; category?: string; type?: string }

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const [{ locale, t }, params, supabase] = await Promise.all([
    getDictionary(),
    searchParams,
    createClient(),
  ])

  let query = supabase
    .from('listings')
    .select('*')
    .eq('certification_status', 'certified')
    .eq('availability', 'available')
    .order('created_at', { ascending: false })

  if (params.governorate && GOVERNORATES.some((g) => g.id === params.governorate)) {
    query = query.eq('governorate', params.governorate)
  }
  if (params.category && DEVICE_TYPES.includes(params.category as never)) {
    query = query.eq('device_type', params.category)
  }
  if (params.type && LISTING_TYPES.includes(params.type as never)) {
    query = query.eq('type', params.type)
  }
  const { data } = await query
  const listings = (data ?? []) as Listing[]
  const hasFilters = Boolean(params.governorate || params.category || params.type)

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-balance">{t.listings.title}</h1>
        <p className="text-muted-foreground text-pretty">{t.listings.subtitle}</p>
      </div>

      <form
        method="get"
        className="grid items-end gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,1fr)_auto]"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="governorate">{t.listings.governorate}</Label>
          <NativeSelect id="governorate" name="governorate" defaultValue={params.governorate ?? ''} className="w-full [&_select]:h-10">
            <NativeSelectOption value="">{t.listings.allGovernorates}</NativeSelectOption>
            {ACTIVE_GOVERNORATES.map((g) => (
              <NativeSelectOption key={g.id} value={g.id}>
                {g[locale]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="category">{t.listings.category}</Label>
          <NativeSelect id="category" name="category" defaultValue={params.category ?? ''} className="w-full [&_select]:h-10">
            <NativeSelectOption value="">{t.listings.allCategories}</NativeSelectOption>
            {DEVICE_TYPES.map((d) => (
              <NativeSelectOption key={d} value={d}>
                {t.device[d]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="type">{t.listings.type}</Label>
          <NativeSelect id="type" name="type" defaultValue={params.type ?? ''} className="w-full [&_select]:h-10">
            <NativeSelectOption value="">{t.listings.allTypes}</NativeSelectOption>
            {LISTING_TYPES.map((x) => (
              <NativeSelectOption key={x} value={x}>
                {t.type[x]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="lg" className="h-10">
            {t.nav.browse}
          </Button>
          {hasFilters && (
            <Link href="/listings" className="inline-flex h-10 items-center px-3 text-sm text-muted-foreground hover:text-foreground">
              {t.listings.clear}
            </Link>
          )}
        </div>
      </form>

      <p className="text-sm text-muted-foreground">
        {listings.length.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en')} {t.listings.results}
      </p>

      {listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-20 text-center text-muted-foreground">
          {t.listings.empty}
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <li key={l.id}>
              <ListingCard listing={l} locale={locale} t={t} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
