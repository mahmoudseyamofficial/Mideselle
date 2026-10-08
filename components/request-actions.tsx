'use client'

import { Check, ClipboardCheck, Undo2, X } from 'lucide-react'
import { ActionButton } from '@/components/action-button'
import { SellerCheckButton } from '@/components/device-check-dialog'
import {
  cancelRequest,
  completeRequest,
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
  t,
}: {
  requestId: string
  status: string
  listingType?: 'sell' | 'rent' | 'donate'
  t: Dictionary
}) {
  const m = messages(t)
  const acceptedInspectionTrigger = listingType === 'rent'
    ? 'post_rental_return'
    : listingType === 'sell'
      ? 'pre_sale_handover'
      : null

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
          {t.seller.markCompleted}
        </ActionButton>
        {acceptedInspectionTrigger && (
          <SellerCheckButton requestId={requestId} triggerType={acceptedInspectionTrigger} t={t} />
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
