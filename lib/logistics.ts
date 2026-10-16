// lib/logistics.ts
// Shipment types, the status flow, and all texts for the logistics screens
// (kept here so you don't have to touch the main dictionaries).

export type ShipmentLeg =
  | 'seller_to_hub'
  | 'hub_to_buyer'
  | 'hub_to_seller'
  | 'buyer_to_hub'
  | 'seller_to_buyer'

export type ShipmentStatus =
  | 'awaiting_pickup'
  | 'picked_up'
  | 'received_at_hub'
  | 'delivered'
  | 'failed'
  | 'cancelled'

export interface ShipmentLite {
  id: string
  leg: ShipmentLeg
  status: ShipmentStatus
  tracking_number: string | null
  created_at: string
  delivered_at: string | null
}

export interface ShipmentFull extends ShipmentLite {
  provider: string
  fee: number | null
  from_address: string
  from_phone: string
  to_address: string
  to_phone: string
}

// TODO: put your company's real address and phone here.
export const HUB = {
  address: 'New Cairo, Cairo',
  phone: '01017395057',
}

export const startsAtHub = (leg: ShipmentLeg) => leg === 'hub_to_buyer' || leg === 'hub_to_seller'
export const endsAtHub = (leg: ShipmentLeg) => leg === 'seller_to_hub' || leg === 'buyer_to_hub'

/** The normal steps of a leg, in order. */
export function stepsFor(leg: ShipmentLeg): ShipmentStatus[] {
  return endsAtHub(leg)
    ? ['awaiting_pickup', 'picked_up', 'received_at_hub']
    : ['awaiting_pickup', 'picked_up', 'delivered']
}

export function nextStatus(leg: ShipmentLeg, status: ShipmentStatus): ShipmentStatus | null {
  const steps = stepsFor(leg)
  const i = steps.indexOf(status)
  return i >= 0 && i < steps.length - 1 ? steps[i + 1] : null
}

export const isFinished = (status: ShipmentStatus) =>
  status === 'received_at_hub' || status === 'delivered' || status === 'failed' || status === 'cancelled'

type Text = {
  legs: Record<ShipmentLeg, string>
  status: Record<ShipmentStatus, string>
  book: Record<ShipmentLeg, string>
  timelineTitle: string
  trackingNo: string
  tab: string
  empty: string
  seller: string
  buyer: string
  check: string
  fromAddress: string
  fromPhone: string
  toAddress: string
  toPhone: string
  fee: string
  tracking: string
  submit: string
  booking: string
  booked: string
  duplicate: string
  toInTransit: string
  toReceivedAtHub: string
  toDelivered: string
  fail: string
  checkReady: string
  completeRequest: string
  completeHelp: string
  closeRequest: string
  closeHelp: string
}

export const LOGISTICS_TEXT: Record<'ar' | 'en', Text> = {
  en: {
    legs: {
      seller_to_hub: 'Seller → Company',
      hub_to_buyer: 'Company → Buyer',
      hub_to_seller: 'Company → Seller',
      buyer_to_hub: 'Buyer → Company',
      seller_to_buyer: 'Seller → Buyer',
    },
    status: {
      awaiting_pickup: 'Awaiting pickup',
      picked_up: 'In transit',
      received_at_hub: 'Received at the company',
      delivered: 'Delivered',
      failed: 'Delivery failed',
      cancelled: 'Cancelled',
    },
    book: {
      seller_to_hub: 'Book pickup from the seller',
      hub_to_buyer: 'Book delivery to the buyer',
      hub_to_seller: 'Book return to the seller',
      buyer_to_hub: 'Book pickup from the buyer',
      seller_to_buyer: 'Book direct delivery, seller to buyer',
    },
    timelineTitle: 'Delivery',
    trackingNo: 'Tracking',
    tab: 'Logistics',
    empty: 'No requests need shipping right now.',
    seller: 'Seller',
    buyer: 'Buyer',
    check: 'Check',
    fromAddress: 'Pickup address',
    fromPhone: 'Pickup phone',
    toAddress: 'Delivery address',
    toPhone: 'Delivery phone',
    fee: 'Shipping cost (EGP)',
    tracking: 'Tracking number (optional)',
    submit: 'Book shipment',
    booking: 'Booking…',
    booked: 'Shipment booked',
    duplicate: 'This leg is already booked.',
    toInTransit: 'Mark in transit',
    toReceivedAtHub: 'Mark received at the company',
    toDelivered: 'Mark delivered',
    fail: 'Delivery failed',
    checkReady: 'The device is at the company. Record the check result:',
    completeRequest: 'Complete the request',
    completeHelp: 'The device was delivered to the buyer. Completing records the sale in the wallets.',
    closeRequest: 'Close the request (check failed)',
    closeHelp: 'The device is back with the seller. The request will be rejected.',
  },
  ar: {
    legs: {
      seller_to_hub: 'من البائع إلى الشركة',
      hub_to_buyer: 'من الشركة إلى المشتري',
      hub_to_seller: 'من الشركة إلى البائع',
      buyer_to_hub: 'من المشتري إلى الشركة',
      seller_to_buyer: 'من البائع إلى المشتري',
    },
    status: {
      awaiting_pickup: 'بانتظار الاستلام',
      picked_up: 'في الطريق',
      received_at_hub: 'وصل إلى الشركة',
      delivered: 'تم التسليم',
      failed: 'تعذّر التوصيل',
      cancelled: 'أُلغيت',
    },
    book: {
      seller_to_hub: 'حجز استلام الجهاز من البائع',
      hub_to_buyer: 'حجز توصيل الجهاز إلى المشتري',
      hub_to_seller: 'حجز إرجاع الجهاز إلى البائع',
      buyer_to_hub: 'حجز استلام الجهاز من المشتري',
      seller_to_buyer: 'حجز توصيل الجهاز من البائع إلى المشتري',
    },
    timelineTitle: 'التوصيل',
    trackingNo: 'رقم التتبع',
    tab: 'اللوجستيات',
    empty: 'لا توجد طلبات تحتاج إلى شحن حالياً.',
    seller: 'البائع',
    buyer: 'المشتري',
    check: 'الفحص',
    fromAddress: 'عنوان الاستلام',
    fromPhone: 'هاتف الاستلام',
    toAddress: 'عنوان التسليم',
    toPhone: 'هاتف التسليم',
    fee: 'تكلفة الشحن (ج.م)',
    tracking: 'رقم التتبع (اختياري)',
    submit: 'حجز الشحنة',
    booking: 'جارٍ الحجز…',
    booked: 'تم حجز الشحنة',
    duplicate: 'هذه المرحلة محجوزة بالفعل.',
    toInTransit: 'تحديد: في الطريق',
    toReceivedAtHub: 'تأكيد الوصول إلى الشركة',
    toDelivered: 'تأكيد التسليم',
    fail: 'تعذّر التوصيل',
    checkReady: 'الجهاز وصل إلى الشركة. سجّل نتيجة الفحص:',
    completeRequest: 'إتمام الطلب',
    completeHelp: 'تم تسليم الجهاز إلى المشتري. الإتمام يسجّل العملية في المحافظ.',
    closeRequest: 'إغلاق الطلب (فشل الفحص)',
    closeHelp: 'عاد الجهاز إلى البائع. سيتم رفض الطلب.',
  },
}