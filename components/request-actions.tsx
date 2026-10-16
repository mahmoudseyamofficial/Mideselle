'use client'

import { Check, PackageCheck, Undo2, X } from 'lucide-react'
import { ActionButton } from '@/components/action-button'
import { SellerCheckButton } from '@/components/device-check-dialog'
import {
  cancelRequest,
  completeRequest,
  markRentalReturned,
  respondToRequest,
  reviewDocument,
  reviewListing,
} from '@/app/actions'
import type { Dictionary } from '@/lib/i18n/dictionaries'

function messages(t: Dictionary) {
  return {
    successMessage: t.common.done,
    notImplementedMessage: t.common.notImplemented,
    errorMessage: t.auth.unexpected,
  }
}

export function SellerRequestActions({
  requestId,
  status,
  listingType,
  returnedAt,
  returnCheck,
  deviceBack,
  t,
}: {
  requestId: string
  listingId?: string
  status: string
  listingType?: 'sell' | 'rent' | 'donate'
  returnedAt?: string | null
  /** Status of the return check for this rental (pending / passed / failed), or null when none was requested */
  returnCheck?: string | null
  /** True once the company has delivered the device back to the seller */
  deviceBack?: boolean
  t: Dictionary
}) {
  const m = messages(t)

  if (status === 'pending') {
    return (
      <div className="flex flex-wrap gap-2">
        {listingType === 'sell' && <SellerCheckButton requestId={requestId} triggerType="pre_sale_handover" t={t} />}
        <ActionButton {...m} icon={<Check data-icon="inline-start" aria-hidden="true" />} action={() => respondToRequest(requestId, 'accepted')}>
          {t.seller.accept}
        </ActionButton>
        <ActionButton {...m} variant="outline" icon={<X data-icon="inline-start" aria-hidden="true" />} action={() => respondToRequest(requestId, 'rejected')}>
          {t.seller.reject}
        </ActionButton>
      </div>
    )
  }

  if (status === 'accepted') {
    return (
      <div className="flex flex-wrap gap-2">
        <ActionButton {...m} variant="secondary" action={() => completeRequest(requestId)}>
          {listingType === 'rent' ? t.seller.confirmHandover : t.seller.markCompleted}
        </ActionButton>
        {listingType === 'sell' && (
          <SellerCheckButton requestId={requestId} triggerType="pre_sale_handover" t={t} />
        )}
      </div>
    )
  }

  if (status === 'completed' && listingType === 'rent') {
    // Already returned: nothing left to do
    if (returnedAt) {
      return (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <PackageCheck className="size-4" aria-hidden="true" />
          {t.seller.returned}
        </p>
      )
    }

    const hasCheck = Boolean(returnCheck)

    return (
      <div className="flex flex-wrap items-center gap-2">
        {hasCheck ? (
          // A return check was already requested: show where it stands instead of offering it again
          <p className="text-sm text-muted-foreground">
            {t.checks.trigger.post_rental_return}:{' '}
            <span className="font-medium text-foreground">
              {t.checks.status[returnCheck as keyof typeof t.checks.status] ?? returnCheck}
            </span>
          </p>
        ) : (
          <SellerCheckButton requestId={requestId} triggerType="post_rental_return" t={t} />
        )}

        {/* Marks the device as back: the listing becomes available and editable again.
            With a return check, the device has to come back from the company first. */}
        {(!hasCheck || deviceBack) && (
          <ActionButton
            {...m}
            variant="secondary"
            icon={<PackageCheck data-icon="inline-start" aria-hidden="true" />}
            action={() => markRentalReturned(requestId)}
          >
            {t.seller.markReturned}
          </ActionButton>
        )}
      </div>
    )
  }

  return null
}

export function BuyerCancelButton({ requestId, t }: { requestId: string; t: Dictionary }) {
  return (
    <ActionButton
      {...messages(t)}
      variant="outline"
      icon={<Undo2 data-icon="inline-start" aria-hidden="true" />}
      action={() => cancelRequest(requestId)}
    >
      {t.buyer.cancel}
    </ActionButton>
  )
}

export function AdminListingActions({ listingId, t }: { listingId: string; t: Dictionary }) {
  const m = messages(t)
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton {...m} icon={<Check data-icon="inline-start" aria-hidden="true" />} action={() => reviewListing(listingId, 'certified')}>
        {t.admin.approve}
      </ActionButton>
      <ActionButton {...m} variant="outline" icon={<X data-icon="inline-start" aria-hidden="true" />} action={() => reviewListing(listingId, 'rejected')}>
        {t.admin.reject}
      </ActionButton>
    </div>
  )
}

export function AdminDocumentActions({ documentId, t }: { documentId: string; t: Dictionary }) {
  const m = messages(t)
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton {...m} icon={<Check data-icon="inline-start" aria-hidden="true" />} action={() => reviewDocument(documentId, 'approved')}>
        {t.admin.approve}
      </ActionButton>
      <ActionButton {...m} variant="outline" icon={<X data-icon="inline-start" aria-hidden="true" />} action={() => reviewDocument(documentId, 'rejected')}>
        {t.admin.reject}
      </ActionButton>
    </div>
  )
}