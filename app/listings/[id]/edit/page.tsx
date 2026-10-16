import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { EditListingForm } from '@/components/edit-listing-form'
import { requireRole } from '@/lib/auth'
import { getDictionary } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'
import type { Listing } from '@/lib/types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary()
  return { title: t.newListing.editTitle }
}

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const profile = await requireRole('seller', `/listings/${id}/edit`)
  const [{ locale, t }, supabase] = await Promise.all([getDictionary(), createClient()])

  // Only the owner can open this page: the query filters on seller_id
  const { data } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .eq('seller_id', profile.id)
    .maybeSingle()
  const listing = (data as Listing | null) ?? null
  if (!listing) notFound()

  // Rented, sold or donated devices cannot be edited (the dashboard hides or disables the button too)
  if (listing.availability !== 'available') redirect(`/listings/${id}`)

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-semibold text-balance">{t.newListing.editTitle}</h1>
      <EditListingForm listing={listing} locale={locale} t={t} />
    </main>
  )
}