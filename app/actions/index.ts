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
  console.error('[actions]', error?.code, error?.message)
  return { ok: false, error: `${error?.code ?? 'no_code'}: ${error?.message ?? fallback}` }
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
  rentalPeriod?: RentPeriod | null
  customDurationText?: string | null
}): Promise<ActionResult> {
  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }

  const isCustom = input.rentalPeriod === 'custom'
  if (isCustom && !input.customDurationText?.trim()) {
    return { ok: false, error: 'duration_required' }
  }

  const { data: request, error } = await auth.supabase
    .from('requests')
    .insert({
      listing_id: input.listingId,
      buyer_id: auth.user.id,
      status: isCustom ? 'pending_owner_price' : 'pending',
      message: input.message?.trim() || null,
      rental_period: input.rentalPeriod ?? null,
      custom_duration_text: isCustom ? input.customDurationText!.trim() : null,
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

export async function markReturned(requestId: string): Promise<ActionResult> {
  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }

  const { data, error } = await auth.supabase
    .from('requests')
    .update({ returned_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'completed')
    .is('returned_at', null)
    .select('id')

  if (error) return failure(error)
  if (!data?.length) return { ok: false, error: 'not_allowed' }

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



export async function proposePrice(
  requestId: string,
  price: number,
  days: number,
): Promise<ActionResult> {
  if (!Number.isFinite(price) || price <= 0) return { ok: false, error: 'invalid_price' }
  if (!Number.isInteger(days) || days < 1 || days > 365) return { ok: false, error: 'invalid_days' }

  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }

  const { data, error } = await auth.supabase
    .from('requests')
    .update({ proposed_price: price, rental_days: days, status: 'pending_buyer_acceptance' })
    .eq('id', requestId)
    .eq('status', 'pending_owner_price')
    .select('id')

  if (error) return failure(error)
  if (!data?.length) return { ok: false, error: 'not_allowed' }

  revalidateMarketplace()
  return { ok: true, id: requestId }
}

export async function respondToProposal(
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
    .eq('status', 'pending_buyer_acceptance')
    .select('id')

  if (error) return failure(error)
  if (!data?.length) return { ok: false, error: 'not_allowed' }

  revalidateMarketplace()
  return { ok: true, id: requestId }
}












// Paste this at the bottom of app/actions.ts.
// It uses the imports and helpers already in that file
// (getAuthedClient, failure, revalidateMarketplace, DEVICE_TYPES, ACTIVE_GOVERNORATES,
// and the ListingType / DeviceType / RentPeriod types).

export interface UpdateListingInput {
  id: string
  title: string
  device_type: DeviceType
  condition_description: string
  price: number | null
  rentPeriods: RentPeriod[]
  rentWeeklyPrice: number | null
  rentMonthlyPrice: number | null
  deposit: number | null
  governorate: string
}

export async function updateListing(input: UpdateListingInput): Promise<ActionResult> {
  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }
  if (!input || typeof input !== 'object' || typeof input.id !== 'string') {
    return { ok: false, error: 'invalid_listing' }
  }

  // The listing type cannot be changed here, so read it from the database
  // (and confirm the caller owns the listing).
  const { data: existing } = await auth.supabase
    .from('listings')
    .select('type, availability')
    .eq('id', input.id)
    .eq('seller_id', auth.user.id)
    .maybeSingle()
  if (!existing) return { ok: false, error: 'not_allowed' }
  // Rented, sold or donated devices cannot be edited
  if (existing.availability !== 'available') return { ok: false, error: 'not_editable' }
  const type = existing.type as ListingType

  if (
    typeof input.title !== 'string' ||
    typeof input.condition_description !== 'string' ||
    typeof input.governorate !== 'string'
  ) {
    return { ok: false, error: 'invalid_listing' }
  }

  const submittedPeriods = Array.isArray(input.rentPeriods) ? input.rentPeriods : []
  const rentPeriods = (['weekly', 'monthly'] as const).filter((period) =>
    submittedPeriods.includes(period),
  )
  const validAmount = (amount: number | null, selected: boolean) =>
    selected
      ? typeof amount === 'number' && Number.isFinite(amount) && amount > 0 && amount <= 99_999_999.99
      : amount === null

  const validRental =
    type === 'rent'
      ? rentPeriods.length > 0 &&
        rentPeriods.length === submittedPeriods.length &&
        validAmount(input.rentWeeklyPrice, rentPeriods.includes('weekly')) &&
        validAmount(input.rentMonthlyPrice, rentPeriods.includes('monthly'))
      : submittedPeriods.length === 0 &&
        input.rentWeeklyPrice === null &&
        input.rentMonthlyPrice === null
  const validPrice = type === 'sell' ? validAmount(input.price, true) : input.price === null
  const validDeposit =
    type === 'rent'
      ? typeof input.deposit === 'number' &&
        Number.isFinite(input.deposit) &&
        input.deposit >= 0 &&
        input.deposit <= 99_999_999.99
      : input.deposit === null

  if (
    input.title.trim().length < 3 ||
    input.title.trim().length > 140 ||
    input.condition_description.trim().length < 10 ||
    input.condition_description.trim().length > 4000 ||
    !DEVICE_TYPES.includes(input.device_type) ||
    !ACTIVE_GOVERNORATES.some((governorate) => governorate.id === input.governorate) ||
    !validPrice ||
    !validRental ||
    !validDeposit
  ) {
    return { ok: false, error: 'invalid_listing' }
  }

  // Period list and prices are written in ONE update so the database check on
  // listings (rent_period must match the prices) is never violated halfway.
  const { data, error } = await auth.supabase
    .from('listings')
    .update({
      title: input.title.trim(),
      device_type: input.device_type,
      condition_description: input.condition_description.trim(),
      price: type === 'sell' ? input.price : null,
      rent_period: type === 'rent' ? rentPeriods : null,
      rent_weekly_price:
        type === 'rent' && rentPeriods.includes('weekly') ? input.rentWeeklyPrice : null,
      rent_monthly_price:
        type === 'rent' && rentPeriods.includes('monthly') ? input.rentMonthlyPrice : null,
      deposit: type === 'rent' ? input.deposit : null,
      governorate: input.governorate,
    })
    .eq('id', input.id)
    .eq('seller_id', auth.user.id)
    .select('id')

  if (error) return failure(error)
  if (!data?.length) return { ok: false, error: 'not_allowed' }

  revalidateMarketplace()
  revalidatePath(`/listings/${input.id}`)
  return { ok: true, id: input.id }
}









// Paste this at the bottom of app/actions/index.ts.
// It uses getAuthedClient, failure, revalidateMarketplace and ActionResult already defined there.

export async function markRentalReturned(requestId: string): Promise<ActionResult> {
  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }

  // The database function checks that the caller owns the listing, that the rental
  // is completed and not yet returned, and then sets the listing back to "available".
  const { error } = await auth.supabase.rpc('mark_rental_returned', {
    p_request_id: requestId,
  })
  if (error) return failure(error, 'not_allowed')

  revalidateMarketplace()
  return { ok: true, id: requestId }
}







// Paste this at the bottom of app/actions/index.ts.
// It uses getAuthedClient, failure, revalidateMarketplace, ActionResult and revalidatePath
// that are already defined / imported in that file.

const SHIPMENT_LEGS = [
  'seller_to_hub',
  'hub_to_buyer',
  'hub_to_seller',
  'buyer_to_hub',
  'seller_to_buyer',
] as readonly string[]

const SHIPMENT_NEXT_STATUSES = [
  'picked_up',
  'received_at_hub',
  'delivered',
  'failed',
  'cancelled',
] as readonly string[]

async function isAdminCaller(auth: NonNullable<Awaited<ReturnType<typeof getAuthedClient>>>) {
  const { data } = await auth.supabase.rpc('is_admin')
  return data === true
}

/** Admin books one leg of a delivery (the database checks that the caller is an admin). */
export async function bookShipment(input: {
  requestId: string
  leg: string
  fromAddress: string
  fromPhone: string
  toAddress: string
  toPhone: string
  fee: number
  tracking: string | null
}): Promise<ActionResult> {
  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }

  if (
    !SHIPMENT_LEGS.includes(input.leg) ||
    !Number.isFinite(input.fee) ||
    input.fee < 0 ||
    input.fee > 99_999_999.99
  ) {
    return { ok: false, error: 'invalid_shipment' }
  }

  const { data, error } = await auth.supabase.rpc('admin_book_shipment', {
    p_request_id: input.requestId,
    p_leg: input.leg,
    p_from_address: input.fromAddress,
    p_from_phone: input.fromPhone,
    p_to_address: input.toAddress,
    p_to_phone: input.toPhone,
    p_fee: input.fee,
    p_tracking: input.tracking,
  })
  if (error || !data) return failure(error, 'not_allowed')

  revalidateMarketplace()
  return { ok: true, id: data as string }
}

/** Admin moves a leg to its next status, or marks it failed / cancelled. */
export async function advanceShipment(
  shipmentId: string,
  status: string,
  note?: string,
): Promise<ActionResult> {
  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }
  if (!SHIPMENT_NEXT_STATUSES.includes(status)) return { ok: false, error: 'invalid_shipment' }

  const { error } = await auth.supabase.rpc('admin_advance_shipment', {
    p_shipment_id: shipmentId,
    p_status: status,
    p_note: note ?? null,
  })
  if (error) return failure(error, 'not_allowed')

  revalidateMarketplace()
  return { ok: true, id: shipmentId }
}

/**
 * Admin completes a request after the device reached the buyer.
 * The check flow leaves the request in "pending_seller_inspection", so it is moved back to
 * "accepted" first, which is the status the ledger function expects.
 */
export async function completeRequestAsAdmin(requestId: string): Promise<ActionResult> {
  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }
  if (!(await isAdminCaller(auth))) return { ok: false, error: 'forbidden' }

  const { error: reopenError } = await auth.supabase
    .from('requests')
    .update({ status: 'accepted' })
    .eq('id', requestId)
    .eq('status', 'pending_seller_inspection')
  if (reopenError) return failure(reopenError)

  const { error } = await auth.supabase.rpc('complete_request_with_ledger', {
    p_request_id: requestId,
  })
  if (error) {
    // Put the request back where it was so nothing is left half-done
    await auth.supabase
      .from('requests')
      .update({ status: 'pending_seller_inspection' })
      .eq('id', requestId)
      .eq('status', 'accepted')
    return failure(error, 'not_allowed')
  }

  revalidateMarketplace()
  return { ok: true, id: requestId }
}

/** Admin closes a request whose check failed, once the device is back with the seller. */
export async function closeRequestAfterFailedCheck(requestId: string): Promise<ActionResult> {
  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }
  if (!(await isAdminCaller(auth))) return { ok: false, error: 'forbidden' }

  const { data, error } = await auth.supabase
    .from('requests')
    .update({ status: 'rejected' })
    .eq('id', requestId)
    .in('status', ['pending_seller_inspection', 'accepted'])
    .select('id')
  if (error) return failure(error)
  if (!data?.length) return { ok: false, error: 'not_allowed' }

  revalidateMarketplace()
  return { ok: true, id: requestId }
}





export async function confirmHandover(input: {
  requestId: string
  party: 'seller_handover' | 'buyer_receipt'
  photos: string[]
  conditionOk?: boolean
  note?: string | null
}): Promise<ActionResult> {
  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }

  const { error } = await auth.supabase.rpc('confirm_handover', {
    p_request_id: input.requestId,
    p_party: input.party,
    p_photos: input.photos,
    p_condition_ok: input.conditionOk ?? true,
    p_note: input.note ?? null,
  })
  if (error) return failure(error, 'not_allowed')

  revalidateMarketplace()
  return { ok: true, id: input.requestId }
}

export async function openDispute(input: {
  requestId: string
  kind: 'device_not_returned' | 'condition_at_receipt' | 'deduction_contested' | 'other'
  reason: string
}): Promise<ActionResult> {
  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }

  const { data, error } = await auth.supabase.rpc('open_dispute', {
    p_request_id: input.requestId,
    p_kind: input.kind,
    p_reason: input.reason,
  })
  if (error || !data) return failure(error, 'not_allowed')

  revalidateMarketplace()
  return { ok: true, id: data as string }
}

export async function resolveDispute(
  disputeId: string,
  ownerAmount: number,
  note: string,
): Promise<ActionResult> {
  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }

  const { error } = await auth.supabase.rpc('resolve_dispute', {
    p_dispute_id: disputeId,
    p_owner_amount: ownerAmount,
    p_note: note,
  })
  if (error) return failure(error, 'not_allowed')

  revalidateMarketplace()
  return { ok: true, id: disputeId }
}















// Paste this at the bottom of app/actions/index.ts.
// It uses getAuthedClient, failure, revalidateMarketplace and ActionResult already defined there.

/**
 * Admin records the result of a check done after a rental.
 *  - passed: the owner is charged the inspection fee and the renter gets the whole deposit back.
 *  - failed: a proposal with findings and a repair cost. Nothing moves for 48 hours, then the
 *    scheduled job takes the repair cost from the deposit and the fee from what is left.
 * The database function checks that the caller is an admin.
 */
export async function resolvePostRentalCheck(input: {
  checkId: string
  decision: 'passed' | 'failed'
  repairCost: number
  findings: string
  evidenceUrl: string | null
}): Promise<ActionResult> {
  const auth = await getAuthedClient()
  if (!auth) return { ok: false, error: 'unauthenticated' }

  if (
    (input.decision !== 'passed' && input.decision !== 'failed') ||
    !Number.isFinite(input.repairCost) ||
    input.repairCost < 0 ||
    input.repairCost > 99_999_999.99 ||
    (input.evidenceUrl !== null && !/^https?:\/\/\S+$/i.test(input.evidenceUrl))
  ) {
    return { ok: false, error: 'invalid_check_result' }
  }

  const { error } = await auth.supabase.rpc('resolve_post_rental_check', {
    p_check_id: input.checkId,
    p_decision: input.decision,
    p_repair_cost: input.repairCost,
    p_findings: input.findings,
    p_evidence_url: input.evidenceUrl,
  })
  if (error) return failure(error, 'not_allowed')

  revalidateMarketplace()
  return { ok: true, id: input.checkId }
}