export const OWNER_COMMISSION_RATE = 0.08
export const BUYER_SERVICE_FEE_RATE = 0.04
export const INSPECTION_FEE_EGP = 200

export function calculateFees(price: number) {
  const ownerCommission = Math.round(price * OWNER_COMMISSION_RATE * 100) / 100
  const buyerServiceFee = Math.round(price * BUYER_SERVICE_FEE_RATE * 100) / 100
  return {
    basePrice: price,
    ownerCommission,
    buyerServiceFee,
    ownerEarning: Math.round((price - ownerCommission) * 100) / 100,
    buyerTotal: Math.round((price + buyerServiceFee) * 100) / 100,
  }
}

export function formatEgp(amount: number, locale: 'ar' | 'en') {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 2,
  }).format(amount)
}

// Paymob capture and wallet settlement will replace these ledger-only entries when payments go live.
