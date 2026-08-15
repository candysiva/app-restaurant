import { useEffect, useMemo, useState } from 'react'
import { OrderApi, OrderItemApi } from '../lib/data'
import type { Order, OrderItem } from '../lib/types'
import { formatInr, formatQty, formatTime, todayIso, dateIso } from '../lib/format'
import { ApiError } from '../lib/api'
import { CloseIcon } from '../components/icons'
import { useCachedFetch } from '../lib/cache'
import { useConfirm } from '../lib/confirm'

type RangeTab = 'today' | 'week' | 'all'

const EMPTY_ORDERS: Order[] = []

async function fetchOrders(range: RangeTab): Promise<Order[]> {
  if (range === 'all') return OrderApi.listRecent()
  const to = todayIso()
  const from = range === 'today' ? to : dateIso(new Date(Date.now() - 6 * 86400000))
  const data = await OrderApi.listInRange(from, to)
  return data.sort((a, b) => b.orderDatetime.localeCompare(a.orderDatetime))
}

export function Orders() {
  const [range, setRange] = useState<RangeTab>('today')
  const {
    data: rawOrders,
    loading: ordersLoading,
    error: ordersError,
    mutate: mutateOrders,
  } = useCachedFetch(`orders:${range}`, () => fetchOrders(range))
  const [viewing, setViewing] = useState<Order | null>(null)

  const orders = rawOrders ?? EMPTY_ORDERS
  const error = ordersError ? (ordersError instanceof ApiError ? ordersError.message : 'Could not load orders') : null

  const dayTotal = useMemo(
    () => orders.filter((o) => o.status === 'completed').reduce((sum, o) => sum + o.total, 0),
    [orders],
  )

  return (
    <div className="flex min-h-full flex-col bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-neutral-900">Orders</h1>
        <div className="mt-2 flex gap-1.5">
          {(['today', 'week', 'all'] as RangeTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setRange(t)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                range === t ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {t === 'today' ? 'Today' : t === 'week' ? 'Last 7 days' : 'Recent'}
            </button>
          ))}
        </div>
      </header>

      {orders.length > 0 && (
        <div className="flex items-center justify-between bg-brand-50 px-4 py-2.5 text-sm">
          <span className="text-neutral-600">{orders.length} bill{orders.length === 1 ? '' : 's'}</span>
          <span className="font-bold text-brand-700">{formatInr(dayTotal)}</span>
        </div>
      )}

      {error && <p className="m-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {ordersLoading && orders.length === 0 && !error && (
        <p className="p-6 text-center text-sm text-neutral-400">Loading orders…</p>
      )}
      {!ordersLoading && orders.length === 0 && (
        <p className="p-8 text-center text-sm text-neutral-400">No bills in this period.</p>
      )}

      <div className="flex-1 divide-y divide-neutral-100 px-4">
        {orders.map((order) => (
          <button
            key={order.id}
            onClick={() => setViewing(order)}
            className="flex w-full items-center justify-between py-3 text-left"
          >
            <div>
              <p className="font-medium text-neutral-900">
                #{order.orderNumber}{' '}
                <span className="text-xs font-normal text-neutral-400">{formatTime(order.orderDatetime)}</span>
              </p>
              <p className="text-xs text-neutral-500">
                {order.itemCount} item{order.itemCount === 1 ? '' : 's'} · {order.paymentMethod.toUpperCase()}
                {order.status === 'cancelled' && <span className="ml-1.5 text-red-500">· Cancelled</span>}
              </p>
            </div>
            <span className={`font-semibold ${order.status === 'cancelled' ? 'text-neutral-400 line-through' : 'text-neutral-900'}`}>
              {formatInr(order.total)}
            </span>
          </button>
        ))}
      </div>

      {viewing && (
        <OrderDetailSheet
          order={viewing}
          onClose={() => setViewing(null)}
          onCancelled={(updated) => {
            mutateOrders((prev) => (prev ?? []).map((o) => (o.id === updated.id ? updated : o)))
            setViewing(updated)
          }}
        />
      )}
    </div>
  )
}

function OrderDetailSheet({
  order,
  onClose,
  onCancelled,
}: {
  order: Order
  onClose: () => void
  onCancelled: (order: Order) => void
}) {
  const [lines, setLines] = useState<OrderItem[] | null>(null)
  const [busy, setBusy] = useState(false)
  const confirmDialog = useConfirm()

  useEffect(() => {
    OrderItemApi.listByOrder(order.id).then(setLines)
  }, [order.id])

  async function cancelOrder() {
    const ok = await confirmDialog({
      title: `Cancel order #${order.orderNumber}?`,
      message: "This can't be undone.",
      confirmLabel: 'Cancel order',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      const updated = await OrderApi.cancel(order.id)
      onCancelled(updated)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[85dvh] w-full max-w-[480px] md:max-w-[600px] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 p-5 pb-3">
          <div>
            <h2 className="text-base font-bold text-neutral-900">Order #{order.orderNumber}</h2>
            <p className="text-xs text-neutral-500">
              {formatTime(order.orderDatetime)} · {order.paymentMethod.toUpperCase()}
              {order.status === 'cancelled' && <span className="ml-1.5 text-red-500">· Cancelled</span>}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {lines === null && <p className="py-6 text-center text-sm text-neutral-400">Loading…</p>}
          {lines?.map((line) => (
            <div key={line.id} className="flex items-center justify-between border-b border-neutral-50 py-2.5">
              <div>
                <p className="text-sm font-medium text-neutral-900">{line.itemName}</p>
                <p className="text-xs text-neutral-500">
                  {formatQty(line.quantity, line.priceType)} × {formatInr(line.unitPrice)}
                </p>
              </div>
              <span className="text-sm font-semibold text-neutral-900">{formatInr(line.lineTotal)}</span>
            </div>
          ))}
        </div>

        <div className="p-5 pt-3">
          <div className="mb-3 flex justify-between text-base font-bold text-neutral-900">
            <span>Total</span>
            <span>{formatInr(order.total)}</span>
          </div>
          {order.status === 'completed' && (
            <button
              onClick={cancelOrder}
              disabled={busy}
              className="w-full rounded-xl border border-red-200 py-3 font-semibold text-red-600 active:bg-red-50 disabled:opacity-60"
            >
              {busy ? 'Cancelling…' : 'Cancel this order'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
