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

export type MaterialUnit = 'kg' | 'g' | 'litre' | 'ml' | 'piece' | 'packet' | 'dozen' | 'bag' | 'bundle'
export type PurchasePaymentStatus = 'unpaid' | 'partial' | 'paid'
export type StockTxnType = 'purchase' | 'usage' | 'wastage' | 'adjustment_in' | 'adjustment_out'

export interface Vendor {
  id: string
  name: string
  phone?: string
  address?: string
  notes?: string
  active: boolean
}

export interface Material {
  id: string
  name: string
  unit: MaterialUnit
  currentStock: number
  minStockThreshold: number
  active: boolean
}

export interface Purchase {
  id: string
  purchaseNumber: number
  vendor: { id: string; name?: string; phone?: string }
  purchaseDate: string
  purchaseDatetime: string
  total: number
  itemCount: number
  amountPaid: number
  balanceDue: number
  paymentStatus: PurchasePaymentStatus
  dueDate?: string
  notes?: string
}

export interface PurchaseItem {
  id: string
  purchase: { id: string; purchaseNumber?: number; purchaseDate?: string }
  material: { id: string; name?: string; unit?: string }
  materialName: string
  unit: string
  quantity: number
  unitPrice: number
  lineTotal: number
  purchaseDate: string
}

export interface StockTransaction {
  id: string
  material: { id: string; name?: string; unit?: string }
  type: StockTxnType
  quantity: number
  balanceAfter: number
  transactionDate: string
  notes?: string
  relatedPurchase?: { id: string; purchaseNumber?: number }
}

export interface VendorPayment {
  id: string
  vendor: { id: string; name?: string }
  purchase: { id: string; purchaseNumber?: number; total?: number; amountPaid?: number; balanceDue?: number }
  amount: number
  paymentMethod: PaymentMethod
  paymentDate: string
  notes?: string
}

export type PayFrequency = 'daily' | 'weekly' | 'monthly'

export interface Employee {
  id: string
  name: string
  phone?: string
  role?: string
  payFrequency: PayFrequency
  payRate: number
  active: boolean
}

export interface SalaryPayment {
  id: string
  employee: { id: string; name?: string; payFrequency?: PayFrequency }
  amount: number
  periodStart: string
  periodEnd: string
  paymentDate: string
  paymentMethod: PaymentMethod
  notes?: string
}

export interface OtherExpense {
  id: string
  category: CategoryItem | null
  amount: number
  expenseDate: string
  paymentMethod: PaymentMethod
  payee?: string
  notes?: string
}
