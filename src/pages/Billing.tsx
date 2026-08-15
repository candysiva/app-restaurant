import { useEffect, useMemo, useState } from 'react'
import { CategoryApi, MenuApi, submitOrder, type CartLine } from '../lib/data'
import type { CategoryItem, MenuItem, PaymentMethod } from '../lib/types'
import { formatInr } from '../lib/format'
import { ApiError } from '../lib/api'
import { CloseIcon, MinusIcon, PlusIcon } from '../components/icons'

const ALL_TAB = 'all'

export function Billing() {
  const [items, setItems] = useState<MenuItem[] | null>(null)
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<string>(ALL_TAB)
  const [cart, setCart] = useState<Record<string, number>>({})
  const [weighing, setWeighing] = useState<MenuItem | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [receipt, setReceipt] = useState<{ orderNumber: number; total: number } | null>(null)

  useEffect(() => {
    Promise.all([MenuApi.list(), CategoryApi.list()])
      .then(([data, cats]) => {
        setItems(data.filter((i) => i.active).sort((a, b) => a.name.localeCompare(b.name)))
        setCategories(cats.sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load menu'))
  }, [])

  const visibleItems = useMemo(
    () => (items ?? []).filter((i) => tab === ALL_TAB || i.category?.id === tab),
    [items, tab],
  )

  const itemsById = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items])

  const cartLines: CartLine[] = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, quantity]) => ({ menuItem: itemsById.get(id)!, quantity }))
        .filter((l) => l.menuItem),
    [cart, itemsById],
  )

  const total = cartLines.reduce((sum, l) => sum + l.menuItem.price * l.quantity, 0)
  const itemCount = cartLines.reduce((sum, l) => sum + l.quantity, 0)

  function addFixed(item: MenuItem) {
    setCart((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + 1 }))
  }

  function setQty(itemId: string, qty: number) {
    setCart((prev) => ({ ...prev, [itemId]: Math.max(0, qty) }))
  }

  function handleTileTap(item: MenuItem) {
    if (item.priceType === 'per_kg') {
      setWeighing(item)
    } else {
      addFixed(item)
    }
  }

  function resetCart() {
    setCart({})
  }

  return (
    <div className="flex min-h-full flex-col bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-neutral-900">New Bill</h1>
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setTab(ALL_TAB)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
              tab === ALL_TAB ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setTab(c.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
                tab === c.id ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="m-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {items === null && !error && <p className="p-6 text-center text-sm text-neutral-400">Loading menu…</p>}
      {items !== null && visibleItems.length === 0 && (
        <p className="p-8 text-center text-sm text-neutral-400">No items in this category yet.</p>
      )}

      <div className="grid flex-1 grid-cols-2 content-start gap-2.5 p-3 pb-28 md:grid-cols-3">
        {visibleItems.map((item) => {
          const qty = cart[item.id] ?? 0
          return (
            <div key={item.id}>
              {item.priceType === 'fixed' ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleTileTap(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleTileTap(item)
                  }}
                  className={`w-full rounded-xl border p-3 text-left active:scale-[0.98] ${
                    qty > 0 ? 'border-brand-600 bg-brand-50' : 'border-neutral-200 bg-white'
                  }`}
                >
                  <p className="text-sm font-semibold leading-tight text-neutral-900">{item.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">{formatInr(item.price)}</p>
                  {qty > 0 ? (
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-white/70">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setQty(item.id, qty - 1)
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700"
                      >
                        <MinusIcon className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-bold text-brand-700">{qty}</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-white">
                        <PlusIcon className="h-4 w-4" />
                      </span>
                    </div>
                  ) : (
                    <div className="mt-2 flex h-7 items-center justify-center rounded-lg bg-neutral-100 text-xs font-medium text-neutral-500">
                      Tap to add
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => handleTileTap(item)}
                  className={`w-full rounded-xl border p-3 text-left active:scale-[0.98] ${
                    qty > 0 ? 'border-brand-600 bg-brand-50' : 'border-neutral-200 bg-white'
                  }`}
                >
                  <p className="text-sm font-semibold leading-tight text-neutral-900">{item.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">{formatInr(item.price)} / kg</p>
                  <div
                    className={`mt-2 flex h-7 items-center justify-center rounded-lg text-xs font-medium ${
                      qty > 0 ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {qty > 0 ? `${qty} kg added` : 'Tap to weigh'}
                  </div>
                </button>
              )}
            </div>
          )
        })}
      </div>

      {itemCount > 0 && (
        <button
          onClick={() => setCheckoutOpen(true)}
          className="fixed bottom-[calc(64px+env(safe-area-inset-bottom))] left-1/2 z-20 flex w-[calc(100%-2rem)] max-w-[448px] -translate-x-1/2 items-center justify-between rounded-2xl bg-brand-700 px-5 py-3.5 text-white shadow-lg active:bg-brand-800"
        >
          <span className="text-sm font-medium">{itemCount} item{itemCount === 1 ? '' : 's'}</span>
          <span className="font-bold">{formatInr(total)} · Checkout</span>
        </button>
      )}

      {weighing && (
        <WeighSheet
          item={weighing}
          initialKg={cart[weighing.id]}
          onClose={() => setWeighing(null)}
          onConfirm={(kg) => {
            setQty(weighing.id, kg)
            setWeighing(null)
          }}
        />
      )}

      {checkoutOpen && (
        <CheckoutSheet
          lines={cartLines}
          total={total}
          onClose={() => setCheckoutOpen(false)}
          onRemoveLine={(id) => setQty(id, 0)}
          onDone={(orderNumber) => {
            setReceipt({ orderNumber, total })
            resetCart()
            setCheckoutOpen(false)
          }}
        />
      )}

      {receipt && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-6">
          <div className="w-full max-w-xs rounded-2xl bg-white p-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl text-green-600">
              ✓
            </div>
            <p className="text-sm text-neutral-500">Bill saved</p>
            <p className="text-2xl font-bold text-neutral-900">Order #{receipt.orderNumber}</p>
            <p className="mt-1 text-lg font-semibold text-brand-700">{formatInr(receipt.total)}</p>
            <button
              onClick={() => setReceipt(null)}
              className="mt-5 w-full rounded-xl bg-brand-700 py-3 font-semibold text-white active:bg-brand-800"
            >
              New bill
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function WeighSheet({
  item,
  initialKg,
  onClose,
  onConfirm,
}: {
  item: MenuItem
  initialKg?: number
  onClose: () => void
  onConfirm: (kg: number) => void
}) {
  const [kg, setKg] = useState(initialKg ? String(initialKg) : '')
  const parsed = Number(kg)
  const valid = kg.trim() !== '' && Number.isFinite(parsed) && parsed > 0

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-[480px] md:max-w-[600px] rounded-t-2xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">{item.name}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-sm text-neutral-500">{formatInr(item.price)} / kg</p>
        <input
          autoFocus
          inputMode="decimal"
          value={kg}
          onChange={(e) => setKg(e.target.value)}
          placeholder="Weight in kg, e.g. 1.5"
          className="input text-lg"
        />
        {valid && <p className="mt-2 text-sm font-medium text-neutral-600">= {formatInr(parsed * item.price)}</p>}
        <button
          disabled={!valid}
          onClick={() => onConfirm(parsed)}
          className="mt-4 w-full rounded-xl bg-brand-700 py-3 font-semibold text-white active:bg-brand-800 disabled:opacity-40"
        >
          Add to bill
        </button>
      </div>
    </div>
  )
}

function CheckoutSheet({
  lines,
  total,
  onClose,
  onRemoveLine,
  onDone,
}: {
  lines: CartLine[]
  total: number
  onClose: () => void
  onRemoveLine: (menuItemId: string) => void
  onDone: (orderNumber: number) => void
}) {
  const [payment, setPayment] = useState<PaymentMethod>('cash')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      const order = await submitOrder(lines, payment, undefined)
      onDone(order.orderNumber)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the bill. Please try again.')
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
          <h2 className="text-base font-bold text-neutral-900">Confirm bill</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {lines.map((line) => (
            <div key={line.menuItem.id} className="flex items-center justify-between border-b border-neutral-50 py-2.5">
              <div>
                <p className="text-sm font-medium text-neutral-900">{line.menuItem.name}</p>
                <p className="text-xs text-neutral-500">
                  {line.quantity}
                  {line.menuItem.priceType === 'per_kg' ? ' kg' : ' ×'} {formatInr(line.menuItem.price)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-neutral-900">
                  {formatInr(line.menuItem.price * line.quantity)}
                </span>
                <button
                  onClick={() => onRemoveLine(line.menuItem.id)}
                  className="text-xs font-medium text-neutral-400 underline"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-5 pt-3">
          <div className="mb-3 flex justify-between text-base font-bold text-neutral-900">
            <span>Total</span>
            <span>{formatInr(total)}</span>
          </div>

          <p className="mb-1.5 text-xs font-medium text-neutral-600">Payment method</p>
          <div className="mb-4 flex gap-2">
            {(['cash', 'upi', 'card'] as PaymentMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => setPayment(m)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold capitalize ${
                  payment === m ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            onClick={confirm}
            disabled={busy || lines.length === 0}
            className="w-full rounded-xl bg-brand-700 py-3.5 font-semibold text-white active:bg-brand-800 disabled:opacity-60"
          >
            {busy ? 'Saving…' : `Confirm & save · ${formatInr(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
