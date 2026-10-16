'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { RentPeriod } from '@/lib/types'

type Available = 'weekly' | 'monthly'

interface RentalState {
  /** Periods the owner actually offers with a real price (> 0) */
  available: Available[]
  period: RentPeriod | ''
  setPeriod: (p: RentPeriod) => void
  /** Price for the selected period, or null (custom, or nothing selected) */
  price: number | null
  /** Refundable deposit (0 when the listing has none) */
  deposit: number
  customDuration: string
  setCustomDuration: (v: string) => void
}

const RentalContext = createContext<RentalState | null>(null)

/** Returns null outside a RentalProvider (sell / donate listings) */
export function useRental() {
  return useContext(RentalContext)
}

// Number(null) and Number('') are both 0, so treat 0 / NaN as "no price"
function clean(v: number | string | null | undefined): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function RentalProvider({
  rentPeriods,
  weeklyPrice,
  monthlyPrice,
  deposit,
  children,
}: {
  rentPeriods: RentPeriod[] | null
  weeklyPrice: number | string | null
  monthlyPrice: number | string | null
  deposit?: number | string | null
  children: ReactNode
}) {
  const prices = useMemo(
    () => ({ weekly: clean(weeklyPrice), monthly: clean(monthlyPrice) }),
    [weeklyPrice, monthlyPrice],
  )

  const available = useMemo(
    () =>
      (['weekly', 'monthly'] as const).filter(
        (p) => prices[p] !== null && (!rentPeriods || rentPeriods.includes(p)),
      ),
    [prices, rentPeriods],
  )

  const [period, setPeriod] = useState<RentPeriod | ''>(
    available.includes('monthly') ? 'monthly' : (available[0] ?? ''),
  )
  const [customDuration, setCustomDuration] = useState('')

  const price = period === 'weekly' || period === 'monthly' ? prices[period] : null

  return (
    <RentalContext.Provider
      value={{
        available,
        period,
        setPeriod,
        price,
        deposit: clean(deposit) ?? 0,
        customDuration,
        setCustomDuration,
      }}
    >
      {children}
    </RentalContext.Provider>
  )
}