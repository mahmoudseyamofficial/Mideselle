'use server'

// Permissions are enforced by RLS policies and the guard triggers in
// scripts/001_schema.sql. Each action only authenticates the caller, performs
// the Supabase call as that user, and treats "zero rows affected" as a denial
// (RLS filters rows silently instead of raising an error).

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_GOVERNORATES, DEVICE_TYPES } from '@/lib/types'
import type { DeviceType, ListingType, RentPeriod } from '@/lib/types'
import { INSPECTION_FEE_EGP } from '@/lib/fees'

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

export interface CreateListingInput {
  type: ListingType
  title: string
  device_type: DeviceType
  condition_description: string
  photos: string[]
  price: number | null
  rentPeriods: RentPeriod[]
  rentWeeklyPrice: number | null
  rentMonthlyPrice: number | null
  governorate: string
  deposit: number | null
}

async function getAuthedClient() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? { supabase, user } : null
}

function failure(error: { code?: string; message: string } | null, fallback = 'action_failed'): ActionResult {
  if (error?.code === '23505') return { ok: false, error: 'duplicate' }
  if (error?.code === '42501') return { ok: false, error: 'forbidden' }
  console.error('[actions]', error?.code, error?.message)
  return { ok: false, error: fallback }
}

function revalidateMarketplace() {
  revalidatePath('/listings')
  revalidatePath('/listings/[id]', 'page')
  revalidatePath('/dashboard/seller')
  revalidatePath('/dashboard/buyer')
  revalidatePath('/admin')
}

export async function createListing(input: CreateListingInput): Promise<ActionResult> {
  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'invalid_listing' }
  }
  if (
    typeof input.title !== 'string' ||
    typeof input.condition_description !== 'string' ||
    typeof input.governorate !== 'string'
  ) {
    return { ok: false, error: 'invalid_listing' }
  }

  const validTypes: ListingType[] = ['sell', 'rent', 'donate']
  const submittedPeriods = Array.isArray(input.rentPeriods) ? input.rentPeriods : []
  const rentPeriods = (['weekly', 'monthly'] as const).filter((period) =>
    submittedPeriods.includes(period),
  )
  const validPeriodSelection =
    Array.isArray(input.rentPeriods) &&
    rentPeriods.length > 0 &&
    rentPeriods.length === submittedPeriods.length
  const validAmount = (amount: number | null, selected: boolean) =>
    selected
      ? typeof amount === 'number' && Number.isFinite(amount) && amount > 0 && amount <= 99_999_999.99
      : amount === null
  const validRental = input.type === 'rent'
    ? validPeriodSelection &&
      validAmount(input.rentWeeklyPrice, rentPeriods.includes('weekly')) &&
      validAmount(input.rentMonthlyPrice, rentPeriods.includes('monthly'))
    : submittedPeriods.length === 0 &&
      input.rentWeeklyPrice === null &&
      input.rentMonthlyPrice === null
  const validPrice = input.type === 'sell'
    ? validAmount(input.price, true)
    : input.price === null
  const validDeposit = input.type === 'rent'
    ? typeof input.deposit === 'number' &&
      Number.isFinite(input.deposit) &&
      input.deposit >= 0 &&
      input.deposit <= 99_999_999.99
    : input.deposit === null

  if (
    !validTypes.includes(input.type) ||
    input.title.trim().length < 3 ||
    input.title.trim().length > 140 ||
    input.condition_description.trim().length < 10 ||
    input.condition_description.trim().length > 4000 ||
    !Array.isArray(input.photos) ||
    input.photos.length === 0 ||
    input.photos.length > 6 ||
    input.photos.some((photo) => typeof photo !== 'string') ||
    !DEVICE_TYPES.includes(input.device_type) ||
    !ACTIVE_GOVERNORATES.some((governorate) => governorate.id === input.governorate) ||
    !validPrice ||
    !validRental ||
    !validDeposit ||
    !input.governorate.trim()
  ) {
    return { ok: false, error: 'invalid_listing' }
  }

  const { data, error } = await auth.supabase
    .from('listings')
    .insert({
      seller_id: auth.user.id,
      type: input.type,
      title: input.title.trim(),
      device_type: input.device_type,
      condition_description: input.condition_description.trim(),
      photos: input.photos,
      price: input.type === 'sell' ? input.price : null,
      rent_period: input.type === 'rent' ? rentPeriods : null,
      rent_weekly_price: input.type === 'rent' && rentPeriods.includes('weekly')
        ? input.rentWeeklyPrice
        : null,
      rent_monthly_price: input.type === 'rent' && rentPeriods.includes('monthly')
        ? input.rentMonthlyPrice
        : null,
      governorate: input.governorate,
      deposit: input.type === 'rent' ? input.deposit : null,
      certification_status: 'pending',
    })
    .select('id')
    .single()

  if (error || !data) return failure(error)

  revalidatePath('/dashboard/seller')
  revalidatePath('/admin')
  return { ok: true, id: data.id }
}

export async function createRequest(input: {
  listingId: string
  message: string | null
  documentPath: string | null
  rentPeriod: RentPeriod | null
}): Promise<ActionResult> {
  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }
  if (
    !input ||
    typeof input !== 'object' ||
    typeof input.listingId !== 'string' ||
    !input.listingId.trim() ||
    (input.message !== null && typeof input.message !== 'string') ||
    (input.documentPath !== null && typeof input.documentPath !== 'string') ||
    (input.message !== null && input.message.length > 1000)
  ) {
    return { ok: false, error: 'invalid_request' }
  }
  if (input.rentPeriod !== null && input.rentPeriod !== 'weekly' && input.rentPeriod !== 'monthly') {
    return { ok: false, error: 'invalid_rent_period' }
  }

  const { data: request, error } = await auth.supabase
    .from('requests')
    .insert({
      listing_id: input.listingId,
      buyer_id: auth.user.id,
      status: 'pending',
      rent_period: input.rentPeriod,
      message: input.message?.trim() || null,
    })
    .select('id')
    .single()

  if (error || !request) return failure(error)

  if (input.documentPath) {
    const { error: docError } = await auth.supabase
      .from('validation_documents')
      .insert({ request_id: request.id, file_url: input.documentPath })

    if (docError) {
      // Buyers cannot delete requests, so withdraw it to avoid a request missing its required document.
      await auth.supabase.from('requests').update({ status: 'cancelled_by_buyer' }).eq('id', request.id)
      return failure(docError)
    }
  }

  revalidateMarketplace()
  return { ok: true, id: request.id }
}

export async function cancelRequest(requestId: string): Promise<ActionResult> {
  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }

  const { data, error } = await auth.supabase
    .from('requests')
    .update({ status: 'cancelled_by_buyer' })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id')

  if (error) return failure(error)
  if (!data?.length) return { ok: false, error: 'not_allowed' }

  revalidateMarketplace()
  return { ok: true, id: requestId }
}

export async function respondToRequest(
  requestId: string,
  decision: 'accepted' | 'rejected',
): Promise<ActionResult> {
  if (decision !== 'accepted' && decision !== 'rejected') return { ok: false, error: 'invalid_decision' }

  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }

  const { data, error } = await auth.supabase
    .from('requests')
    .update({ status: decision })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id')

  if (error) return failure(error)
  if (!data?.length) return { ok: false, error: 'not_allowed' }

  revalidateMarketplace()
  return { ok: true, id: requestId }
}

export async function completeRequest(requestId: string): Promise<ActionResult> {
  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }

  const { error } = await auth.supabase.rpc('complete_request_with_ledger', {
    p_request_id: requestId,
  })
  if (error) return failure(error, 'not_allowed')

  revalidateMarketplace()
  return { ok: true, id: requestId }
}

export async function reviewListing(
  listingId: string,
  decision: 'certified' | 'rejected',
): Promise<ActionResult> {
  if (decision !== 'certified' && decision !== 'rejected') return { ok: false, error: 'invalid_decision' }

  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }

  const { data, error } = await auth.supabase
    .from('listings')
    .update({ certification_status: decision })
    .eq('id', listingId)
    .select('id')

  if (error) return failure(error)
  if (!data?.length) return { ok: false, error: 'not_allowed' }

  revalidateMarketplace()
  return { ok: true, id: listingId }
}

export async function createSellerCheck(input: { requestId: string; triggerType: 'post_rental_return' | 'pre_sale_handover'; details: string }): Promise<ActionResult> {
  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }
  const { data, error } = await auth.supabase.rpc('create_seller_check', {
    p_request_id: input.requestId,
    p_trigger: input.triggerType,
    p_cost: INSPECTION_FEE_EGP,
    p_details: input.details.trim(),
  })
  if (error || !data) return failure(error, 'not_allowed')
  revalidateMarketplace()
  return { ok: true, id: data as string }
}

export async function resolveDeviceCheck(checkId: string, decision: 'passed' | 'failed'): Promise<ActionResult> {
  if (decision !== 'passed' && decision !== 'failed') return { ok: false, error: 'invalid_decision' }
  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }
  const { error } = await auth.supabase.rpc('resolve_device_check', {
    p_check_id: checkId,
    p_decision: decision,
  })
  if (error) return failure(error, 'not_allowed')
  revalidateMarketplace()
  return { ok: true, id: checkId }
}

export async function reviewDocument(
  documentId: string,
  decision: 'approved' | 'rejected',
): Promise<ActionResult> {
  if (decision !== 'approved' && decision !== 'rejected') return { ok: false, error: 'invalid_decision' }

  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }

  const { data, error } = await auth.supabase
    .from('validation_documents')
    .update({ review_status: decision })
    .eq('id', documentId)
    .select('id')

  if (error) return failure(error)
  if (!data?.length) return { ok: false, error: 'not_allowed' }

  revalidatePath('/admin')
  revalidatePath('/dashboard/buyer')
  return { ok: true, id: documentId }
}
