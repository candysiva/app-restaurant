export type PriceType = 'fixed' | 'per_kg'
export type PaymentMethod = 'cash' | 'upi' | 'card'
export type OrderStatus = 'completed' | 'cancelled'

export interface CategoryItem {
  id: string
  name: string
  sortOrder?: number
}

export interface MenuItem {
  id: string
  name: string
  category: CategoryItem | null
  priceType: PriceType
  price: number
  active: boolean
  /** Preset ₹ amounts for quick per-kg billing (e.g. [20, 50, 100]); only meaningful when priceType is 'per_kg'. */
  presetAmounts?: number[]
  _createdAt?: string
}

export interface Order {
  id: string
  orderNumber: number
  status: OrderStatus
  paymentMethod: PaymentMethod
  total: number
  itemCount: number
  orderDate: string
  orderDatetime: string
  notes?: string
}

export interface OrderItemRef {
  id: string
  name?: string
}

export interface OrderItem {
  id: string
  order: { id: string; orderNumber?: number; orderDate?: string }
  menuItem: OrderItemRef
  itemName: string
  categoryName: string
  priceType: PriceType
  unitPrice: number
  quantity: number
  lineTotal: number
  orderDate: string
}

export type Role = 'owner' | 'staff'

export interface AuthUser {
  id: string
  name: string
  email?: string
  role?: Role
}

export interface AuthResponse {
  jwt: string
  user: AuthUser
}

export interface StaffUser {
  id: string
  name: string
  email?: string
  phone?: string
  username?: string
  role?: Role
  _createdAt?: string
}

/** Missing role = account predates the role field; treat as owner so nobody gets locked out. */
export function isOwner(user: { role?: Role } | null | undefined): boolean {
  return user?.role !== 'staff'
}
