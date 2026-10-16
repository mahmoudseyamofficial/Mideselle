// lib/request-notifications.ts
// Texts and links for the notifications created by the request triggers.
// Your existing kinds (confirm_receipt, receipt_confirmed) keep using lib/notifications.ts.

import type { Locale } from '@/lib/i18n/dictionaries'

export const REQUEST_NOTIFICATION_KINDS = [
  'request_received',
  'request_accepted',
  'request_rejected',
  'request_cancelled',
] as const

export type RequestNotificationKind = (typeof REQUEST_NOTIFICATION_KINDS)[number]

export function isRequestKind(kind: string): kind is RequestNotificationKind {
  return (REQUEST_NOTIFICATION_KINDS as readonly string[]).includes(kind)
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

export function requestNotificationText(
  locale: Locale,
  kind: RequestNotificationKind,
  data: Record<string, unknown> | null | undefined,
) {
  const d = data ?? {}
  const ar = locale === 'ar'
  const title = str(d.listing_title) ?? (ar ? 'الجهاز' : 'the device')
  const buyer = str(d.buyer_name) ?? (ar ? 'مشتري' : 'A buyer')

  switch (kind) {
    case 'request_received':
      return ar ? `وصل طلب جديد على «${title}» من ${buyer}` : `New request for "${title}" from ${buyer}`
    case 'request_accepted':
      return ar ? `تم قبول طلبك على «${title}»` : `Your request for "${title}" was accepted`
    case 'request_rejected':
      return ar ? `تم رفض طلبك على «${title}»` : `Your request for "${title}" was rejected`
    case 'request_cancelled':
      return ar ? `ألغى ${buyer} طلبه على «${title}»` : `${buyer} cancelled the request for "${title}"`
  }
}

/** Buyers go to their requests; sellers go to their dashboard. */
export function requestNotificationHref(kind: RequestNotificationKind) {
  return kind === 'request_accepted' || kind === 'request_rejected' ? '/dashboard/buyer' : '/dashboard/seller'
}