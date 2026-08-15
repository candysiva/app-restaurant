import { api, qs } from './api'
import type { MenuItem, Order, OrderItem, PaymentMethod } from './types'

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

export const MenuApi = {
  list: () => api.get<MenuItem>('/menu_items?limit=200'),
  create: (data: Omit<MenuItem, 'id'>) => api.post<MenuItem>('/menu_items', data),
  update: (id: string, data: Partial<Omit<MenuItem, 'id'>>) => api.patch<MenuItem>(`/menu_items/${id}`, data),
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
    priceType: string
    unitPrice: number
    quantity: number
    lineTotal: number
    orderDate: string
  }) => api.post<OrderItem>('/order_items', data),
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
