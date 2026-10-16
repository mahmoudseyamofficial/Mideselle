export const OWNER_COMMISSION_RATE = 0.08
export const BUYER_SERVICE_FEE_RATE = 0.04
export const INSPECTION_FEE_EGP = 100

/**
 * `deposit` is optional and defaults to 0, so existing callers behave exactly as before.
 * The service fee and owner commission are still based on `price` only;
 * the refundable deposit is added to the buyer's total and never taxed.
 */
export function calculateFees(price: number, deposit = 0) {
  const ownerCommission = Math.round(price * OWNER_COMMISSION_RATE * 100) / 100
  const buyerServiceFee = Math.round(price * BUYER_SERVICE_FEE_RATE * 100) / 100
  const refundableDeposit = Number.isFinite(deposit) && deposit > 0 ? Math.round(deposit * 100) / 100 : 0
  return {
    basePrice: price,
    ownerCommission,
    buyerServiceFee,
    deposit: refundableDeposit,
    ownerEarning: Math.round((price - ownerCommission) * 100) / 100,
    buyerTotal: Math.round((price + buyerServiceFee + refundableDeposit) * 100) / 100,
  }
}

// Whole amounts show without decimals (EGP 1,000); amounts with a fraction keep two (EGP 12.50)
export function formatEgp(amount: number, locale: 'ar' | 'en') {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Paymob capture and wallet settlement will replace these ledger-only entries when payments go live.