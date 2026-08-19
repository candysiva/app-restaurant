import { useMemo, useState } from 'react'
import { PurchaseApi, VendorApi } from '../../lib/data'
import type { Purchase } from '../../lib/types'
import { dateIso, formatDateLabel, formatInr, todayIso } from '../../lib/format'
import { ApiError } from '../../lib/api'
import { PlusIcon } from '../../components/icons'
import { useCachedFetch } from '../../lib/cache'
import { PurchaseSheet } from './PurchaseSheet'
import { PurchaseDetailSheet } from './PurchaseDetailSheet'

type RangeTab = 'today' | 'week' | 'all'

const EMPTY_PURCHASES: Purchase[] = []

async function fetchPurchases(range: RangeTab): Promise<Purchase[]> {
  if (range === 'all') return PurchaseApi.listAll()
  const to = todayIso()
  const from = range === 'today' ? to : dateIso(new Date(Date.now() - 6 * 86400000))
  const data = await PurchaseApi.listInRange(from, to)
  return data.sort((a, b) => b.purchaseDatetime.localeCompare(a.purchaseDatetime))
}

export function PurchasesTab() {
  const [range, setRange] = useState<RangeTab>('today')
  const {
    data: rawPurchases,
    loading,
    error: fetchError,
    mutate,
  } = useCachedFetch(`purchases:${range}`, () => fetchPurchases(range))
  const { data: vendors } = useCachedFetch('vendors', VendorApi.list)
  const [adding, setAdding] = useState(false)
  const [viewing, setViewing] = useState<Purchase | null>(null)

  const purchases = rawPurchases ?? EMPTY_PURCHASES
  const error = fetchError ? (fetchError instanceof ApiError ? fetchError.message : 'Could not load purchases') : null
  const activeVendors = useMemo(() => (vendors ?? []).filter((v) => v.active), [vendors])

  const rangeTotal = useMemo(() => purchases.reduce((sum, p) => sum + p.total, 0), [purchases])

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-neutral-200 bg-white px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5">
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
          <button
            onClick={() => setAdding(true)}
            className="flex shrink-0 items-center gap-1 rounded-full bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white active:bg-brand-800"
          >
            <PlusIcon className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

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
        <p className="p-8 text-center text-sm text-neutral-400">No purchases in this period.</p>
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

      {viewing && <PurchaseDetailSheet purchase={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
