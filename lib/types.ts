export type UserRole = 'buyer' | 'seller' | 'admin'
export type ListingType = 'sell' | 'rent' | 'donate'
export type RentPeriod = 'weekly' | 'monthly'
export type WalletTransactionType =
  | 'rental_earning'
  | 'sale_earning'
  | 'commission_deducted'
  | 'service_fee_charged'
  | 'inspection_fee_deducted'
  | 'deposit_held'
  | 'deposit_returned'
export type CertificationStatus = 'pending' | 'certified' | 'rejected'
export type Availability = 'available' | 'rented' | 'sold' | 'donated'
export type RequestStatus =
  | 'pending'
  | 'accepted'
  | 'pending_seller_inspection'
  | 'rejected'
  | 'cancelled_by_buyer'
  | 'completed'
export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export type DeviceType =
  | 'wheelchair'
  | 'oxygen_concentrator'
  | 'hospital_bed'
  | 'crutches'
  | 'walker'
  | 'other'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole | null
}

export interface Listing {
  id: string
  seller_id: string
  type: ListingType
  title: string
  device_type: DeviceType
  condition_description: string
  photos: string[]
  price: number | null
  rent_period: RentPeriod[] | null
  rent_weekly_price: number | null
  rent_monthly_price: number | null
  deposit: number | null
  governorate: string
  certification_status: CertificationStatus
  availability: Availability
  created_at: string
}

export interface MarketRequest {
  id: string
  listing_id: string
  buyer_id: string
  status: RequestStatus
  rent_period: RentPeriod | null
  message: string | null
  created_at: string
}

export interface WalletTransaction {
  id: string
  user_id: string | null
  type: WalletTransactionType
  amount: number
  related_request_id: string | null
  related_check_id: string | null
  created_at: string
}

export interface ValidationDocument {
  id: string
  request_id: string
  file_url: string
  review_status: ReviewStatus
  created_at: string
}

export const DEVICE_TYPES: DeviceType[] = [
  'wheelchair',
  'oxygen_concentrator',
  'hospital_bed',
  'crutches',
  'walker',
  'other',
]

export const LISTING_TYPES: ListingType[] = ['sell', 'rent', 'donate']

export interface Governorate {
  id: string // value slug stored in listings.governorate
  en: string
  ar: string
  is_active: boolean // set false to hide from selectors/filters without losing data
}

export const GOVERNORATES: Governorate[] = [
  { id: 'cairo', en: 'Cairo', ar: 'القاهرة', is_active: true },
  { id: 'giza', en: 'Giza', ar: 'الجيزة', is_active: true },
  { id: 'alexandria', en: 'Alexandria', ar: 'الإسكندرية', is_active: true },
  { id: 'qalyubia', en: 'Qalyubia', ar: 'القليوبية', is_active: true },
  { id: 'sharqia', en: 'Sharqia', ar: 'الشرقية', is_active: true },
  { id: 'dakahlia', en: 'Dakahlia', ar: 'الدقهلية', is_active: true },
  { id: 'gharbia', en: 'Gharbia', ar: 'الغربية', is_active: true },
  { id: 'monufia', en: 'Monufia', ar: 'المنوفية', is_active: true },
  { id: 'beheira', en: 'Beheira', ar: 'البحيرة', is_active: true },
  { id: 'kafr_el_sheikh', en: 'Kafr El Sheikh', ar: 'كفر الشيخ', is_active: true },
  { id: 'damietta', en: 'Damietta', ar: 'دمياط', is_active: true },
  { id: 'port_said', en: 'Port Said', ar: 'بورسعيد', is_active: true },
  { id: 'ismailia', en: 'Ismailia', ar: 'الإسماعيلية', is_active: true },
  { id: 'suez', en: 'Suez', ar: 'السويس', is_active: true },
  { id: 'north_sinai', en: 'North Sinai', ar: 'شمال سيناء', is_active: true },
  { id: 'south_sinai', en: 'South Sinai', ar: 'جنوب سيناء', is_active: true },
  { id: 'faiyum', en: 'Faiyum', ar: 'الفيوم', is_active: true },
  { id: 'beni_suef', en: 'Beni Suef', ar: 'بني سويف', is_active: true },
  { id: 'minya', en: 'Minya', ar: 'المنيا', is_active: true },
  { id: 'asyut', en: 'Asyut', ar: 'أسيوط', is_active: true },
  { id: 'sohag', en: 'Sohag', ar: 'سوهاج', is_active: true },
  { id: 'qena', en: 'Qena', ar: 'قنا', is_active: true },
  { id: 'luxor', en: 'Luxor', ar: 'الأقصر', is_active: true },
  { id: 'aswan', en: 'Aswan', ar: 'أسوان', is_active: true },
  { id: 'red_sea', en: 'Red Sea', ar: 'البحر الأحمر', is_active: true },
  { id: 'new_valley', en: 'New Valley', ar: 'الوادي الجديد', is_active: true },
  { id: 'matrouh', en: 'Matrouh', ar: 'مطروح', is_active: true },
]

export const ACTIVE_GOVERNORATES = GOVERNORATES.filter((g) => g.is_active)
