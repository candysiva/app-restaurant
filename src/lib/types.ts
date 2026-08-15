export type PriceType = 'fixed' | 'per_kg'
export type Category = 'Tiffin' | 'Batter' | 'Beverages' | 'Others'
export type PaymentMethod = 'cash' | 'upi' | 'card'
export type OrderStatus = 'completed' | 'cancelled'

export interface MenuItem {
  id: string
  name: string
  category: Category
  priceType: PriceType
  price: number
  active: boolean
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
  category?: Category
}

export interface OrderItem {
  id: string
  order: { id: string; orderNumber?: number; orderDate?: string }
  menuItem: OrderItemRef
  itemName: string
  priceType: PriceType
  unitPrice: number
  quantity: number
  lineTotal: number
  orderDate: string
}

export interface AuthUser {
  id: string
  name: string
  email?: string
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
  _createdAt?: string
}
