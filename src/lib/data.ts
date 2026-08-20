import { api, qs } from './api'
import { round2, todayIso } from './format'
import type {
  CategoryItem,
  Employee,
  ExpenseCategory,
  Material,
  MenuItem,
  Order,
  OrderItem,
  OtherExpense,
  PaymentMethod,
  Purchase,
  PurchaseItem,
  Role,
  SalaryPayment,
  StaffUser,
  StockTransaction,
  StockTxnType,
  Vendor,
  VendorPayment,
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
  const total = round2(cart.reduce((sum, line) => sum + line.menuItem.price * line.quantity, 0))
  const itemCount = round2(cart.reduce((sum, line) => sum + line.quantity, 0))

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
        quantity: round2(line.quantity),
        lineTotal: round2(line.menuItem.price * line.quantity),
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

export const VendorPaymentApi = {
  listByPurchase: (purchaseId: string) => api.get<VendorPayment>(`/vendor_payments?purchase=${purchaseId}&limit=200`),
  listByVendor: (vendorId: string) => fetchAll<VendorPayment>('/vendor_payments', { vendor: vendorId }),
  listInRange: (fromDate: string, toDate: string) =>
    fetchAll<VendorPayment>('/vendor_payments', { 'paymentDate[gte]': fromDate, 'paymentDate[lte]': toDate }),
  create: (data: {
    vendor: { id: string }
    purchase: { id: string }
    amount: number
    paymentMethod: PaymentMethod
    paymentDate: string
    notes?: string
  }) => api.post<VendorPayment>('/vendor_payments', data),
}

/**
 * Records a payment against a purchase: POSTs the vendor_payments row, then updates
 * the purchase's amountPaid/balanceDue/paymentStatus. balanceDue is clamped at 0 on
 * overpayment (small-shop tolerance) but amountPaid still reflects the full amount
 * actually received, for reconciliation.
 */
export async function recordVendorPayment(
  purchase: Purchase,
  amount: number,
  opts: { paymentMethod: PaymentMethod; paymentDate?: string; notes?: string },
): Promise<Purchase> {
  const paymentDate = opts.paymentDate ?? todayIso()
  const roundedAmount = round2(amount)
  const newAmountPaid = round2(purchase.amountPaid + roundedAmount)
  const newBalanceDue = round2(Math.max(0, purchase.total - newAmountPaid))
  const paymentStatus: Purchase['paymentStatus'] = newBalanceDue <= 0 ? 'paid' : newAmountPaid > 0 ? 'partial' : 'unpaid'

  await VendorPaymentApi.create({
    vendor: { id: purchase.vendor.id },
    purchase: { id: purchase.id },
    amount: roundedAmount,
    paymentMethod: opts.paymentMethod,
    paymentDate,
    notes: opts.notes,
  })

  const updated = await PurchaseApi.update(purchase.id, {
    amountPaid: newAmountPaid,
    balanceDue: newBalanceDue,
    paymentStatus,
  })

  return { ...purchase, ...updated }
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
 * audit row per line, and bumps each material's currentStock. Starts unpaid unless
 * `initialPayment` is given (e.g. paid the vendor on the spot), in which case a
 * vendor_payments row is written too so payment history stays complete.
 */
export async function submitPurchase(
  vendor: Vendor,
  lines: PurchaseLine[],
  opts: {
    purchaseDate?: string
    dueDate?: string
    notes?: string
    initialPayment?: number
    paymentMethod?: PaymentMethod
  } = {},
): Promise<Purchase> {
  const now = new Date()
  const purchaseDate = opts.purchaseDate ?? todayIso()
  const total = round2(lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0))
  const itemCount = lines.length
  const amountPaid = round2(Math.min(Math.max(0, opts.initialPayment ?? 0), total))
  const balanceDue = round2(total - amountPaid)
  const paymentStatus: Purchase['paymentStatus'] = balanceDue <= 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid'

  const purchase = await PurchaseApi.create({
    purchaseNumber: await nextPurchaseNumber(purchaseDate),
    vendor: { id: vendor.id },
    purchaseDate,
    purchaseDatetime: now.toISOString(),
    total,
    itemCount,
    amountPaid,
    balanceDue,
    paymentStatus,
    dueDate: opts.dueDate,
    notes: opts.notes,
  })

  if (amountPaid > 0) {
    await VendorPaymentApi.create({
      vendor: { id: vendor.id },
      purchase: { id: purchase.id },
      amount: amountPaid,
      paymentMethod: opts.paymentMethod ?? 'cash',
      paymentDate: purchaseDate,
    })
  }

  await Promise.all(
    lines.map((line) =>
      PurchaseItemApi.create({
        purchase: { id: purchase.id },
        material: { id: line.material.id },
        materialName: line.material.name,
        unit: line.material.unit,
        quantity: round2(line.quantity),
        unitPrice: round2(line.unitPrice),
        lineTotal: round2(line.quantity * line.unitPrice),
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
    if (existing) existing.quantity = round2(existing.quantity + line.quantity)
    else quantityByMaterial.set(line.material.id, { material: line.material, quantity: round2(line.quantity) })
  }

  await Promise.all(
    [...quantityByMaterial.values()].map(({ material, quantity }) => {
      const newStock = round2(material.currentStock + quantity)
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
  const roundedQuantity = round2(quantity)
  const newStock = round2(material.currentStock + direction * roundedQuantity)
  const [txn] = await Promise.all([
    StockTransactionApi.create({
      material: { id: material.id },
      type,
      quantity: roundedQuantity,
      balanceAfter: newStock,
      transactionDate: opts.transactionDate ?? todayIso(),
      notes: opts.notes,
    }),
    MaterialApi.update(material.id, { currentStock: newStock }),
  ])
  return txn
}

export const EmployeeApi = {
  list: () => api.get<Employee>('/employees?limit=200'),
  create: (data: { name: string; phone?: string; role?: string; payFrequency: Employee['payFrequency']; payRate: number }) =>
    api.post<Employee>('/employees', { ...data, active: true }),
  update: (
    id: string,
    data: Partial<{ name: string; phone: string; role: string; payFrequency: Employee['payFrequency']; payRate: number; active: boolean }>,
  ) => api.patch<Employee>(`/employees/${id}`, data),
  remove: (id: string) => api.del(`/employees/${id}`),
}

export const SalaryPaymentApi = {
  listByEmployee: (employeeId: string) => fetchAll<SalaryPayment>('/salary_payments', { employee: employeeId }),
  listInRange: (fromDate: string, toDate: string) =>
    fetchAll<SalaryPayment>('/salary_payments', { 'paymentDate[gte]': fromDate, 'paymentDate[lte]': toDate, sort: '-paymentDate' }),
  create: (data: {
    employee: { id: string }
    amount: number
    periodStart: string
    periodEnd: string
    paymentDate: string
    paymentMethod: PaymentMethod
    notes?: string
  }) => api.post<SalaryPayment>('/salary_payments', data),
}

export const OtherExpenseApi = {
  listInRange: (fromDate: string, toDate: string) =>
    fetchAll<OtherExpense>('/other_expenses', { 'expenseDate[gte]': fromDate, 'expenseDate[lte]': toDate, sort: '-expenseDate' }),
  create: (data: {
    category: ExpenseCategory
    amount: number
    expenseDate: string
    paymentMethod: PaymentMethod
    payee?: string
    notes?: string
  }) => api.post<OtherExpense>('/other_expenses', data),
  update: (id: string, data: Partial<Omit<OtherExpense, 'id'>>) => api.patch<OtherExpense>(`/other_expenses/${id}`, data),
  remove: (id: string) => api.del(`/other_expenses/${id}`),
}
