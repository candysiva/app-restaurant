import { useEffect, useMemo, useState } from 'react'
import {
  MaterialApi,
  PurchaseApi,
  PurchaseItemApi,
  VendorApi,
  VendorPaymentApi,
  recordVendorPayment,
  submitPurchase,
  type PurchaseLine,
} from '../lib/data'
import type { PaymentMethod, Purchase, PurchaseItem, Vendor, VendorPayment } from '../lib/types'
import { dateIso, formatDateLabel, formatInr, formatQtyWithUnit, todayIso } from '../lib/format'
import { ApiError } from '../lib/api'
import { CloseIcon, PlusIcon } from '../components/icons'
import { useCachedFetch } from '../lib/cache'

type RangeTab = 'today' | 'week' | 'all'
type StatusFilter = 'all' | Purchase['paymentStatus']

const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: 'All',
  unpaid: 'Unpaid',
  partial: 'Partially paid',
  paid: 'Paid',
}

const EMPTY_PURCHASES: Purchase[] = []

async function fetchPurchases(range: RangeTab): Promise<Purchase[]> {
  if (range === 'all') return PurchaseApi.listAll()
  const to = todayIso()
  const from = range === 'today' ? to : dateIso(new Date(Date.now() - 6 * 86400000))
  const data = await PurchaseApi.listInRange(from, to)
  return data.sort((a, b) => b.purchaseDatetime.localeCompare(a.purchaseDatetime))
}

export function Purchases() {
  const [range, setRange] = useState<RangeTab>('today')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const {
    data: rawPurchases,
    loading,
    error: fetchError,
    mutate,
  } = useCachedFetch(`purchases:${range}`, () => fetchPurchases(range))
  const { data: vendors } = useCachedFetch('vendors', VendorApi.list)
  const [adding, setAdding] = useState(false)
  const [viewing, setViewing] = useState<Purchase | null>(null)

  const allPurchases = rawPurchases ?? EMPTY_PURCHASES
  const purchases = useMemo(
    () => (statusFilter === 'all' ? allPurchases : allPurchases.filter((p) => p.paymentStatus === statusFilter)),
    [allPurchases, statusFilter],
  )
  const error = fetchError ? (fetchError instanceof ApiError ? fetchError.message : 'Could not load purchases') : null
  const activeVendors = useMemo(() => (vendors ?? []).filter((v) => v.active), [vendors])

  const rangeTotal = useMemo(() => purchases.reduce((sum, p) => sum + p.total, 0), [purchases])

  return (
    <div className="flex min-h-full flex-col bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-neutral-900">Purchases</h1>
          <button
            onClick={() => setAdding(true)}
            className="flex shrink-0 items-center gap-1 rounded-full bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white active:bg-brand-800"
          >
            <PlusIcon className="h-4 w-4" /> Add
          </button>
        </div>
        <div className="mt-2 flex gap-1.5">
          {(['today', 'week', 'all'] as RangeTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setRange(t)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                range === t ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {t === 'today' ? 'Today' : t === 'week' ? 'Last 7 days' : 'All'}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5 overflow-x-auto">
          {(['all', 'unpaid', 'partial', 'paid'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                statusFilter === s ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {STATUS_FILTER_LABEL[s]}
            </button>
          ))}
        </div>
      </header>

      {purchases.length > 0 && (
        <div className="flex items-center justify-between bg-brand-50 px-4 py-2.5 text-sm">
          <span className="text-neutral-600">
            {purchases.length} purchase{purchases.length === 1 ? '' : 's'}
          </span>
          <span className="font-bold text-brand-700">{formatInr(rangeTotal)}</span>
        </div>
      )}

      {error && <p className="m-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading && purchases.length === 0 && !error && (
        <p className="p-6 text-center text-sm text-neutral-400">Loading…</p>
      )}
      {!loading && purchases.length === 0 && (
        <p className="p-8 text-center text-sm text-neutral-400">
          {statusFilter === 'all'
            ? 'No purchases in this period.'
            : `No ${STATUS_FILTER_LABEL[statusFilter].toLowerCase()} purchases in this period.`}
        </p>
      )}

      <div className="flex-1 divide-y divide-neutral-100 px-4">
        {purchases.map((p) => (
          <button
            key={p.id}
            onClick={() => setViewing(p)}
            className="flex w-full items-center justify-between py-3 text-left"
          >
            <div>
              <p className="font-medium text-neutral-900">
                #{p.purchaseNumber} <span className="text-xs font-normal text-neutral-400">{p.vendor.name}</span>
              </p>
              <p className="text-xs text-neutral-500">
                {formatDateLabel(p.purchaseDate)} · {p.itemCount} item{p.itemCount === 1 ? '' : 's'}
                {p.paymentStatus !== 'paid' && (
                  <span className="ml-1.5 text-red-500">
                    · {p.paymentStatus === 'partial' ? 'Partially paid' : 'Unpaid'}
                  </span>
                )}
              </p>
            </div>
            <span className="font-semibold text-neutral-900">{formatInr(p.total)}</span>
          </button>
        ))}
      </div>

      {adding && (
        <PurchaseSheet
          vendors={activeVendors}
          onClose={() => setAdding(false)}
          onSaved={(purchase) => {
            mutate((prev) => [purchase, ...(prev ?? [])])
            setAdding(false)
          }}
        />
      )}

      {viewing && (
        <PurchaseDetailSheet
          purchase={viewing}
          onClose={() => setViewing(null)}
          onUpdated={(updated) => {
            setViewing(updated)
            mutate((prev) => (prev ?? []).map((p) => (p.id === updated.id ? updated : p)))
          }}
        />
      )}
    </div>
  )
}

function Blocked({ onClose, message }: { onClose: () => void; message: string }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-[480px] md:max-w-[600px] rounded-t-2xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">New purchase</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{message}</p>
      </div>
    </div>
  )
}

function PurchaseSheet({
  vendors,
  onClose,
  onSaved,
}: {
  vendors: Vendor[]
  onClose: () => void
  onSaved: (purchase: Purchase) => void
}) {
  const { data: materials } = useCachedFetch('materials', MaterialApi.list)
  const activeMaterials = useMemo(() => (materials ?? []).filter((m) => m.active), [materials])

  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? '')
  const [purchaseDate, setPurchaseDate] = useState(todayIso())
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<PurchaseLine[]>([])
  const [payNow, setPayNow] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')

  const [materialId, setMaterialId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)

  function addLine() {
    const material = activeMaterials.find((m) => m.id === materialId)
    const qty = Number(quantity)
    const price = Number(unitPrice)
    if (!material || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) return
    setLines((prev) => [...prev, { material, quantity: qty, unitPrice: price }])
    setMaterialId('')
    setQuantity('')
    setUnitPrice('')
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    setError(null)
    const vendor = vendors.find((v) => v.id === vendorId)
    if (!vendor || lines.length === 0) {
      setError('Pick a vendor and add at least one material line')
      return
    }
    setBusy(true)
    try {
      const purchase = await submitPurchase(vendor, lines, {
        purchaseDate,
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
        initialPayment: Number(payNow) || 0,
        paymentMethod,
      })
      onSaved(purchase)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the purchase')
      setBusy(false)
    }
  }

  if (vendors.length === 0) {
    return <Blocked onClose={onClose} message="Add a vendor first — More → Vendors — before recording a purchase." />
  }
  if (materials !== null && activeMaterials.length === 0) {
    return (
      <Blocked onClose={onClose} message="Add a material first — More → Materials — before recording a purchase." />
    )
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[90dvh] w-full max-w-[480px] md:max-w-[600px] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 p-5 pb-3">
          <h2 className="text-base font-bold text-neutral-900">New purchase</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-3">
          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Vendor</span>
              <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block flex-1">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Date</span>
              <input
                type="date"
                className="input"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </label>
          </div>

          {lines.length > 0 && (
            <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
              {lines.map((line, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{line.material.name}</p>
                    <p className="text-xs text-neutral-500">
                      {formatQtyWithUnit(line.quantity, line.material.unit)} × {formatInr(line.unitPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-neutral-900">
                      {formatInr(line.quantity * line.unitPrice)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="text-xs font-medium text-neutral-400 underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-dashed border-neutral-300 p-3">
            <p className="text-xs font-medium text-neutral-600">Add a material line</p>
            <select className="input" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
              <option value="">Select material</option>
              {activeMaterials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.unit})
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                className="input"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Quantity"
              />
              <input
                className="input"
                inputMode="decimal"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="Price / unit"
              />
            </div>
            <button
              type="button"
              onClick={addLine}
              disabled={!materialId || !quantity || !unitPrice}
              className="w-full rounded-lg bg-neutral-100 py-2 text-sm font-semibold text-neutral-600 active:bg-neutral-200 disabled:opacity-40"
            >
              + Add line
            </button>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Due date (optional)</span>
            <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Notes (optional)</span>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <div className="space-y-2 rounded-xl bg-neutral-50 p-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Pay now (optional)</span>
              <input
                className="input"
                inputMode="decimal"
                value={payNow}
                onChange={(e) => setPayNow(e.target.value)}
                placeholder="Leave blank if paying later"
              />
            </label>
            {Number(payNow) > 0 && (
              <div className="flex gap-2">
                {(['cash', 'upi', 'card'] as PaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize ${
                      paymentMethod === m ? 'bg-brand-700 text-white' : 'bg-white text-neutral-600'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 pt-3">
          <div className="mb-3 flex justify-between text-base font-bold text-neutral-900">
            <span>Total</span>
            <span>{formatInr(total)}</span>
          </div>
          {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={busy || lines.length === 0}
            className="w-full rounded-xl bg-brand-700 py-3.5 font-semibold text-white active:bg-brand-800 disabled:opacity-60"
          >
            {busy ? 'Saving…' : `Save purchase · ${formatInr(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

const STATUS_LABEL: Record<Purchase['paymentStatus'], string> = {
  unpaid: 'Unpaid',
  partial: 'Partially paid',
  paid: 'Paid',
}

function PurchaseDetailSheet({
  purchase,
  onClose,
  onUpdated,
}: {
  purchase: Purchase
  onClose: () => void
  onUpdated: (purchase: Purchase) => void
}) {
  const [lines, setLines] = useState<PurchaseItem[] | null>(null)
  const [payments, setPayments] = useState<VendorPayment[] | null>(null)
  const [paying, setPaying] = useState(false)

  function loadPayments() {
    VendorPaymentApi.listByPurchase(purchase.id).then((list) =>
      setPayments(list.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))),
    )
  }

  useEffect(() => {
    PurchaseItemApi.listByPurchase(purchase.id).then(setLines)
    loadPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchase.id])

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[85dvh] w-full max-w-[480px] md:max-w-[600px] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 p-5 pb-3">
          <div>
            <h2 className="text-base font-bold text-neutral-900">Purchase #{purchase.purchaseNumber}</h2>
            <p className="text-xs text-neutral-500">
              {purchase.vendor.name} · {formatDateLabel(purchase.purchaseDate)}
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
                <p className="text-sm font-medium text-neutral-900">{line.materialName}</p>
                <p className="text-xs text-neutral-500">
                  {formatQtyWithUnit(line.quantity, line.unit)} × {formatInr(line.unitPrice)}
                </p>
              </div>
              <span className="text-sm font-semibold text-neutral-900">{formatInr(line.lineTotal)}</span>
            </div>
          ))}

          {payments && payments.length > 0 && (
            <div className="mt-3">
              <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-neutral-400">Payments</h3>
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b border-neutral-50 py-2">
                  <p className="text-xs text-neutral-500">
                    {formatDateLabel(p.paymentDate)} · {p.paymentMethod.toUpperCase()}
                  </p>
                  <span className="text-sm font-semibold text-neutral-900">{formatInr(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 pt-3">
          <div className="mb-1.5 flex justify-between text-base font-bold text-neutral-900">
            <span>Total</span>
            <span>{formatInr(purchase.total)}</span>
          </div>
          <div className="mb-1.5 flex items-center justify-between text-sm text-neutral-500">
            <span>Payment status</span>
            <span
              className={`font-semibold ${purchase.paymentStatus === 'paid' ? 'text-green-600' : 'text-red-600'}`}
            >
              {STATUS_LABEL[purchase.paymentStatus]}
              {purchase.balanceDue > 0 && ` · ${formatInr(purchase.balanceDue)} due`}
            </span>
          </div>
          {purchase.dueDate && (
            <div className="mb-1.5 flex items-center justify-between text-sm text-neutral-500">
              <span>Due date</span>
              <span>{formatDateLabel(purchase.dueDate)}</span>
            </div>
          )}
          {purchase.notes && <p className="mb-2 text-sm text-neutral-500">{purchase.notes}</p>}

          {purchase.paymentStatus !== 'paid' && (
            <button
              onClick={() => setPaying(true)}
              className="mt-1 w-full rounded-xl bg-brand-700 py-3 font-semibold text-white active:bg-brand-800"
            >
              Record payment
            </button>
          )}
        </div>
      </div>

      {paying && (
        <RecordPaymentSheet
          purchase={purchase}
          onClose={() => setPaying(false)}
          onSaved={(updated) => {
            onUpdated(updated)
            loadPayments()
            setPaying(false)
          }}
        />
      )}
    </div>
  )
}

function RecordPaymentSheet({
  purchase,
  onClose,
  onSaved,
}: {
  purchase: Purchase
  onClose: () => void
  onSaved: (purchase: Purchase) => void
}) {
  const [amount, setAmount] = useState(String(purchase.balanceDue))
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [paymentDate, setPaymentDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsedAmount = Number(amount)
  const valid = amount.trim() !== '' && Number.isFinite(parsedAmount) && parsedAmount > 0

  async function handleSubmit() {
    if (!valid) return
    setError(null)
    setBusy(true)
    try {
      const updated = await recordVendorPayment(purchase, parsedAmount, {
        paymentMethod,
        paymentDate,
        notes: notes.trim() || undefined,
      })
      onSaved(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the payment')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-[480px] md:max-w-[600px] rounded-t-2xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">Record payment</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-sm text-neutral-500">{formatInr(purchase.balanceDue)} due to {purchase.vendor.name}</p>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Amount</span>
            <input
              className="input"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </label>
          <div>
            <span className="mb-1 block text-xs font-medium text-neutral-600">Payment method</span>
            <div className="flex gap-2">
              {(['cash', 'upi', 'card'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold capitalize ${
                    paymentMethod === m ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Date</span>
            <input
              type="date"
              className="input"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Notes (optional)</span>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={busy || !valid}
            className="w-full rounded-xl bg-brand-700 py-3 font-semibold text-white active:bg-brand-800 disabled:opacity-40"
          >
            {busy ? 'Saving…' : `Record ${formatInr(parsedAmount || 0)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
