import { api, qs } from './api'
import type { CategoryItem, MenuItem, Order, OrderItem, PaymentMethod, Role, StaffUser } from './types'

async function fetchAll<T>(path: string, params: Record<string, string | number | boolean | undefined>): Promise<T[]> {
  const limit = 200
  let offset = 0
  const out: T[] = []
  for (let page = 0; page < 25; page++) {
    const batch = await api.get<T>(`${path}${qs({ ...params, limit, offset })}`)
    out.push(...batch)
    if (batch.length < limit) break
    offset += limit
  }
  return out
}

interface RawMenuItem {
  id: string
  name: string
  categoryRef?: { id: string; name?: string } | null
  priceType: MenuItem['priceType']
  price: number
  active: boolean
  _createdAt?: string
}

function toMenuItem(raw: RawMenuItem): MenuItem {
  return {
    id: raw.id,
    name: raw.name,
    category: raw.categoryRef ? { id: raw.categoryRef.id, name: raw.categoryRef.name ?? '' } : null,
    priceType: raw.priceType,
    price: raw.price,
    active: raw.active,
    _createdAt: raw._createdAt,
  }
}

export const CategoryApi = {
  list: () => api.get<CategoryItem>('/categories?limit=200'),
  create: (name: string) => api.post<CategoryItem>('/categories', { name }),
  update: (id: string, name: string) => api.patch<CategoryItem>(`/categories/${id}`, { name }),
  remove: (id: string) => api.del(`/categories/${id}`),
}

export const MenuApi = {
  list: async () => (await api.get<RawMenuItem>('/menu_items?limit=200')).map(toMenuItem),
  create: async (data: { name: string; category: CategoryItem; priceType: MenuItem['priceType']; price: number; active: boolean }) =>
    toMenuItem(
      await api.post<RawMenuItem>('/menu_items', {
        name: data.name,
        categoryRef: { id: data.category.id },
        priceType: data.priceType,
        price: data.price,
        active: data.active,
      }),
    ),
  update: async (
    id: string,
    data: Partial<{ name: string; category: CategoryItem; priceType: MenuItem['priceType']; price: number; active: boolean }>,
  ) => {
    const body: Record<string, unknown> = { ...data }
    if (data.category) {
      body.categoryRef = { id: data.category.id }
      delete body.category
    }
    return toMenuItem(await api.patch<RawMenuItem>(`/menu_items/${id}`, body))
  },
  remove: (id: string) => api.del(`/menu_items/${id}`),
}

export const OrderApi = {
  listInRange: (fromDate: string, toDate: string) =>
    fetchAll<Order>('/orders', { 'orderDate[gte]': fromDate, 'orderDate[lte]': toDate, sort: '-orderDate' }),
  listRecent: () => api.get<Order>('/orders?orderNumber[gte]=0&sort=-orderNumber&limit=50'),
  create: (data: Omit<Order, 'id'>) => api.post<Order>('/orders', data),
  cancel: (id: string) => api.patch<Order>(`/orders/${id}`, { status: 'cancelled' }),
}

export const OrderItemApi = {
  listByOrder: (orderId: string) => api.get<OrderItem>(`/order_items?order=${orderId}&limit=200`),
  listInRange: (fromDate: string, toDate: string) =>
    fetchAll<OrderItem>('/order_items', { 'orderDate[gte]': fromDate, 'orderDate[lte]': toDate }),
  create: (data: {
    order: { id: string }
    menuItem: { id: string }
    itemName: string
    categoryName: string
    priceType: string
    unitPrice: number
    quantity: number
    lineTotal: number
    orderDate: string
  }) => api.post<OrderItem>('/order_items', data),
}

export const StaffApi = {
  list: () => api.get<StaffUser>('/users?limit=200'),
  create: (data: { name: string; email?: string; phone?: string; password: string; role: Role }) =>
    api.post<StaffUser>('/users', data),
  update: (id: string, data: { name?: string; role?: Role; password?: string }) =>
    api.patch<StaffUser>(`/users/${id}`, data),
  remove: (id: string) => api.del(`/users/${id}`),
}

const ORDER_COUNTER_KEY = 'sb_billing_order_counter'

export function nextOrderNumber(orderDate: string): number {
  const raw = localStorage.getItem(ORDER_COUNTER_KEY)
  const state = raw ? (JSON.parse(raw) as { date: string; seq: number }) : null
  const seq = state && state.date === orderDate ? state.seq + 1 : 1
  localStorage.setItem(ORDER_COUNTER_KEY, JSON.stringify({ date: orderDate, seq }))
  return seq
}

export interface CartLine {
  menuItem: MenuItem
  quantity: number
}

export async function submitOrder(
  cart: CartLine[],
  paymentMethod: PaymentMethod,
  notes: string | undefined,
): Promise<Order> {
  const now = new Date()
  const orderDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const total = cart.reduce((sum, line) => sum + line.menuItem.price * line.quantity, 0)
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0)

  const order = await OrderApi.create({
    orderNumber: nextOrderNumber(orderDate),
    status: 'completed',
    paymentMethod,
    total,
    itemCount,
    orderDate,
    orderDatetime: now.toISOString(),
    notes,
  })

  await Promise.all(
    cart.map((line) =>
      OrderItemApi.create({
        order: { id: order.id },
        menuItem: { id: line.menuItem.id },
        itemName: line.menuItem.name,
        categoryName: line.menuItem.category?.name ?? 'Uncategorized',
        priceType: line.menuItem.priceType,
        unitPrice: line.menuItem.price,
        quantity: line.quantity,
        lineTotal: line.menuItem.price * line.quantity,
        orderDate,
      }),
    ),
  )

  return order
}
