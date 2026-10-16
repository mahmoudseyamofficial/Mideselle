import type { Locale } from '@/lib/i18n/dictionaries'

const TEXT: Record<Locale, Record<string, string>> = {
    ar: {
    confirm_receipt: 'تم تسليم الجهاز إليك. ارفع صورًا وأكّد استلامه.',
    receipt_reminder: 'تذكير: لم تؤكد استلام الجهاز بعد. تحقق من حالته وأكّد الاستلام.',
    receipt_confirmed: 'أكّد المستأجر استلام الجهاز.',
    inspection_ordered: 'طلب المالك فحص الجهاز بعد الإيجار. يتوقف الاسترداد التلقائي للتأمين حتى انتهاء الفحص.',
    inspection_passed: 'اجتاز الجهاز الفحص.',
    inspection_failed: 'لم يجتز الجهاز الفحص.',
    dispute_opened: 'تم فتح نزاع على أحد الطلبات.',
    dispute_resolved: 'تمت تسوية النزاع.',
    deposit_auto_released: 'تم استرداد التأمين تلقائيًا.',
    deduction_proposed: 'اقتُرح خصم من التأمين بعد فحص الجهاز. راجع التفاصيل ولديك ٤٨ ساعة للاعتراض.', 
    deduction_final: 'تم تنفيذ تسوية التأمين.',
    },
    en: {
    confirm_receipt: 'The device was handed over to you. Upload photos and confirm you received it.',
    receipt_reminder: 'Reminder: you have not confirmed receipt of the device yet. Check its condition and confirm.',
    receipt_confirmed: 'The renter confirmed receipt of the device.',
    inspection_ordered: 'The owner ordered an inspection after the rental. The automatic deposit refund is paused until it finishes.',
    inspection_passed: 'The device passed its inspection.',
    inspection_failed: 'The device failed its inspection.',
    dispute_opened: 'A dispute was opened on a request.',
    dispute_resolved: 'A dispute was resolved.',
    deposit_auto_released: 'The deposit was refunded automatically.',
    deduction_proposed: 'A deduction from your deposit was proposed after the device inspection. Review it; you have 48 hours to contest.', 
    deduction_final: 'The deposit settlement was completed.',
    },
}

export const notificationText = (locale: Locale, kind: string) => TEXT[locale][kind] ?? kind

export function notificationHref(kind: string, role: string) {
  if (kind.startsWith('dispute')) return '/disputes'
  if (role === 'admin') return '/admin'
  return role === 'seller' ? '/dashboard/seller' : '/dashboard/buyer'
}