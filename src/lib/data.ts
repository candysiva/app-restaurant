import { api, qs } from './api'
import { todayIso } from './format'
import type {
  CategoryItem,
  Material,
  MenuItem,
  Order,
  OrderItem,
  PaymentMethod,
  Purchase,
  PurchaseItem,
  Role,
  StaffUser,
  StockTransaction,
  StockTxnType,
  Vendor,
} from './types'

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
  presetAmounts?: number[]
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
    presetAmounts: raw.presetAmounts ?? [],
    _createdAt: raw._createdAt,
  }
}

export const CategoryApi = {
  list: () => api.get<CategoryItem>('/categories?limit=200'),
  create: (name: string, sortOrder?: number) =>
    api.post<CategoryItem>('/categories', sortOrder === undefined ? { name } : { name, sortOrder }),
  update: (id: string, data: Partial<{ name: string; sortOrder: number }>) =>
    api.patch<CategoryItem>(`/categories/${id}`, data),
  remove: (id: string) => api.del(`/categories/${id}`),
}

export function sortCategories(categories: CategoryItem[]): CategoryItem[] {
  return categories
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
}

export const MenuApi = {
  list: async () => (await api.get<RawMenuItem>('/menu_items?limit=200')).map(toMenuItem),
  create: async (data: {
    name: string
    category: CategoryItem
    priceType: MenuItem['priceType']
    price: number
    active: boolean
    presetAmounts?: number[]
  }) =>
    toMenuItem(
      await api.post<RawMenuItem>('/menu_items', {
        name: data.name,
        categoryRef: { id: data.category.id },
        priceType: data.priceType,
        price: data.price,
        active: data.active,
        presetAmounts: data.presetAmounts ?? [],
      }),
    ),
  update: async (
    id: string,
    data: Partial<{
      name: string
      category: CategoryItem
      priceType: MenuItem['priceType']
      price: number
      active: boolean
      presetAmounts: number[]
    }>,
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

// Reads today's highest order number from the shared backend rather than a local
// counter, so every device/login continues the same sequence instead of each
// starting its own count at 1 (which caused duplicate order numbers across logins).
async function nextOrderNumber(orderDate: string): Promise<number> {
  const todaysOrders = await OrderApi.listInRange(orderDate, orderDate)
  return todaysOrders.reduce((max, o) => Math.max(max, o.orderNumber), 0) + 1
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
    orderNumber: await nextOrderNumber(orderDate),
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

export const VendorApi = {
  list: () => api.get<Vendor>('/vendors?limit=200'),
  create: (data: { name: string; phone?: string; address?: string; notes?: string }) =>
    api.post<Vendor>('/vendors', { ...data, active: true }),
  update: (id: string, data: Partial<{ name: string; phone: string; address: string; notes: string; active: boolean }>) =>
    api.patch<Vendor>(`/vendors/${id}`, data),
  remove: (id: string) => api.del(`/vendors/${id}`),
}

export const MaterialApi = {
  list: () => api.get<Material>('/materials?limit=200'),
  create: (data: { name: string; unit: Material['unit']; minStockThreshold: number }) =>
    api.post<Material>('/materials', { ...data, currentStock: 0, active: true }),
  update: (
    id: string,
    data: Partial<{ name: string; unit: Material['unit']; minStockThreshold: number; currentStock: number; active: boolean }>,
  ) => api.patch<Material>(`/materials/${id}`, data),
  remove: (id: string) => api.del(`/materials/${id}`),
}

export const PurchaseApi = {
  listInRange: (fromDate: string, toDate: string) =>
    fetchAll<Purchase>('/purchases', { 'purchaseDate[gte]': fromDate, 'purchaseDate[lte]': toDate, sort: '-purchaseDate' }),
  listAll: () => fetchAll<Purchase>('/purchases', {}),
  listByVendor: (vendorId: string) => fetchAll<Purchase>('/purchases', { vendor: vendorId }),
  listUnpaid: () => api.get<Purchase>('/purchases?paymentStatus[in]=unpaid,partial&limit=200'),
  create: (data: Omit<Purchase, 'id'>) => api.post<Purchase>('/purchases', data),
  update: (id: string, data: Partial<Purchase>) => api.patch<Purchase>(`/purchases/${id}`, data),
}

export const PurchaseItemApi = {
  listByPurchase: (purchaseId: string) => api.get<PurchaseItem>(`/purchase_items?purchase=${purchaseId}&limit=200`),
  listInRange: (fromDate: string, toDate: string) =>
    fetchAll<PurchaseItem>('/purchase_items', { 'purchaseDate[gte]': fromDate, 'purchaseDate[lte]': toDate }),
  create: (data: {
    purchase: { id: string }
    material: { id: string }
    materialName: string
    unit: string
    quantity: number
    unitPrice: number
    lineTotal: number
    purchaseDate: string
  }) => api.post<PurchaseItem>('/purchase_items', data),
}

export const StockTransactionApi = {
  listByMaterial: (materialId: string) => fetchAll<StockTransaction>('/stock_transactions', { material: materialId }),
  listInRange: (fromDate: string, toDate: string) =>
    fetchAll<StockTransaction>('/stock_transactions', { 'transactionDate[gte]': fromDate, 'transactionDate[lte]': toDate }),
  create: (data: {
    material: { id: string }
    type: StockTxnType
    quantity: number
    balanceAfter: number
    transactionDate: string
    notes?: string
    relatedPurchase?: { id: string }
  }) => api.post<StockTransaction>('/stock_transactions', data),
}

// Same max+1-per-day read pattern as nextOrderNumber, for the same reason
// (every device/login continues one shared sequence instead of its own).
async function nextPurchaseNumber(purchaseDate: string): Promise<number> {
  const todaysPurchases = await PurchaseApi.listInRange(purchaseDate, purchaseDate)
  return todaysPurchases.reduce((max, p) => Math.max(max, p.purchaseNumber), 0) + 1
}

export interface PurchaseLine {
  material: Material
  quantity: number
  unitPrice: number
}

/**
 * Records a vendor purchase: the header, one line item per material (snapshotting
 * name/unit since prices and even material names can change later), a stock_transactions
 * audit row per line, and bumps each material's currentStock. Starts fully unpaid —
 * "pay now at purchase time" lands in Phase 2 alongside vendor_payments.
 */
export async function submitPurchase(
  vendor: Vendor,
  lines: PurchaseLine[],
  opts: { purchaseDate?: string; dueDate?: string; notes?: string } = {},
): Promise<Purchase> {
  const now = new Date()
  const purchaseDate = opts.purchaseDate ?? todayIso()
  const total = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
  const itemCount = lines.length

  const purchase = await PurchaseApi.create({
    purchaseNumber: await nextPurchaseNumber(purchaseDate),
    vendor: { id: vendor.id },
    purchaseDate,
    purchaseDatetime: now.toISOString(),
    total,
    itemCount,
    amountPaid: 0,
    balanceDue: total,
    paymentStatus: 'unpaid',
    dueDate: opts.dueDate,
    notes: opts.notes,
  })

  await Promise.all(
    lines.map((line) =>
      PurchaseItemApi.create({
        purchase: { id: purchase.id },
        material: { id: line.material.id },
        materialName: line.material.name,
        unit: line.material.unit,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.quantity * line.unitPrice,
        purchaseDate,
      }),
    ),
  )

  // Aggregate by material first — a purchase can list the same material on more than
  // one line (e.g. two batches at different prices), and updating currentStock once per
  // raw line in parallel would race: every line reads the same stale currentStock before
  // any PATCH lands, so only the last write survives instead of the lines accumulating.
  const quantityByMaterial = new Map<string, { material: Material; quantity: number }>()
  for (const line of lines) {
    const existing = quantityByMaterial.get(line.material.id)
    if (existing) existing.quantity += line.quantity
    else quantityByMaterial.set(line.material.id, { material: line.material, quantity: line.quantity })
  }

  await Promise.all(
    [...quantityByMaterial.values()].map(({ material, quantity }) => {
      const newStock = material.currentStock + quantity
      return Promise.all([
        StockTransactionApi.create({
          material: { id: material.id },
          type: 'purchase',
          quantity,
          balanceAfter: newStock,
          transactionDate: purchaseDate,
          relatedPurchase: { id: purchase.id },
        }),
        MaterialApi.update(material.id, { currentStock: newStock }),
      ])
    }),
  )

  return purchase
}

/**
 * Logs a manual stock movement (usage/wastage/adjustment) and updates the material's
 * running currentStock. Not clamped at 0 — a negative balance is a useful signal that
 * a purchase was never logged, not something to hide.
 */
export async function logStockTransaction(
  material: Material,
  type: Exclude<StockTxnType, 'purchase'>,
  quantity: number,
  opts: { transactionDate?: string; notes?: string } = {},
): Promise<StockTransaction> {
  const direction = type === 'adjustment_in' ? 1 : -1
  const newStock = material.currentStock + direction * quantity
  const [txn] = await Promise.all([
    StockTransactionApi.create({
      material: { id: material.id },
      type,
      quantity,
      balanceAfter: newStock,
      transactionDate: opts.transactionDate ?? todayIso(),
      notes: opts.notes,
    }),
    MaterialApi.update(material.id, { currentStock: newStock }),
  ])
  return txn
}
