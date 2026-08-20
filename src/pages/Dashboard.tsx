import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { OrderApi, OrderItemApi, OtherExpenseApi, SalaryPaymentApi, VendorPaymentApi } from '../lib/data'
import type { Order, OrderItem, OtherExpense, SalaryPayment, VendorPayment } from '../lib/types'
import { dateIso, formatDateLabel, formatInr, round2, todayIso } from '../lib/format'
import { ApiError } from '../lib/api'
import { useCachedFetch } from '../lib/cache'

type Period = 'today' | 'week' | '1m' | '2m' | '3m' | '6m' | '12m' | 'custom'
type ViewMode = 'date' | 'weekday'
type WeekdayFilter = 'all' | number
type Selection = { kind: 'date'; date: string } | { kind: 'weekday'; jsDay: number } | null

const MONTHS_BY_PERIOD: Partial<Record<Period, number>> = { '1m': 1, '2m': 2, '3m': 3, '6m': 6, '12m': 12 }
const PERIOD_LABEL: Record<Period, string> = {
  today: 'Today',
  week: 'Week',
  '1m': '1M',
  '2m': '2M',
  '3m': '3M',
  '6m': '6M',
  '12m': '1Y',
  custom: 'Custom',
}

// Monday-first display order; each entry is the value JS Date#getDay() returns for that weekday.
const WEEKDAYS: { label: string; fullLabel: string; jsDay: number }[] = [
  { label: 'Mon', fullLabel: 'Monday', jsDay: 1 },
  { label: 'Tue', fullLabel: 'Tuesday', jsDay: 2 },
  { label: 'Wed', fullLabel: 'Wednesday', jsDay: 3 },
  { label: 'Thu', fullLabel: 'Thursday', jsDay: 4 },
  { label: 'Fri', fullLabel: 'Friday', jsDay: 5 },
  { label: 'Sat', fullLabel: 'Saturday', jsDay: 6 },
  { label: 'Sun', fullLabel: 'Sunday', jsDay: 0 },
]

function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00`).getDay()
}

const EMPTY_ORDERS: Order[] = []
const EMPTY_LINE_ITEMS: OrderItem[] = []
const EMPTY_VENDOR_PAYMENTS: VendorPayment[] = []
const EMPTY_SALARY_PAYMENTS: SalaryPayment[] = []
const EMPTY_OTHER_EXPENSES: OtherExpense[] = []

interface DashboardData {
  orders: Order[]
  lineItems: OrderItem[]
  vendorPayments: VendorPayment[]
  salaryPayments: SalaryPayment[]
  otherExpenses: OtherExpense[]
}

async function fetchDashboardData(from: string, to: string): Promise<DashboardData> {
  const [orders, lineItems, vendorPayments, salaryPayments, otherExpenses] = await Promise.all([
    OrderApi.listInRange(from, to),
    OrderItemApi.listInRange(from, to),
    VendorPaymentApi.listInRange(from, to),
    SalaryPaymentApi.listInRange(from, to),
    OtherExpenseApi.listInRange(from, to),
  ])
  return { orders, lineItems, vendorPayments, salaryPayments, otherExpenses }
}

const BRAND = '#b91c1c'
const BRAND_LIGHT = '#fee2e2'
const BRAND_MUTED = '#f3a5a5'

// Compact axis labels: full rupee formatting (formatInr) is too wide for a
// mobile Y axis, e.g. "₹1,25,000" — collapse to "₹1.25L" / "₹4.2k" instead.
function formatAxisInr(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(value % 100000 === 0 ? 0 : 1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
  return `₹${value}`
}

function rangeFor(period: Period, customMonths: number): { from: string; to: string; days: string[] } {
  const to = new Date()
  const toIso = todayIso()
  if (period === 'today') return { from: toIso, to: toIso, days: [toIso] }

  if (period === 'week') {
    const days: string[] = []
    for (let i = 6; i >= 0; i--) days.push(dateIso(new Date(to.getTime() - i * 86400000)))
    return { from: days[0], to: toIso, days }
  }

  const months = period === 'custom' ? customMonths : (MONTHS_BY_PERIOD[period] ?? 1)
  const from = new Date(to)
  from.setMonth(from.getMonth() - months)
  from.setDate(from.getDate() + 1)
  const days: string[] = []
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    days.push(dateIso(d))
  }
  return { from: dateIso(from), to: toIso, days }
}

export function Dashboard() {
  const [period, setPeriod] = useState<Period>('today')
  const [customMonths, setCustomMonths] = useState(4)
  const [viewMode, setViewMode] = useState<ViewMode>('date')
  const [weekdayFilter, setWeekdayFilter] = useState<WeekdayFilter>('all')
  const [selection, setSelection] = useState<Selection>(null)

  useEffect(() => setSelection(null), [period, customMonths, viewMode, weekdayFilter])

  function toggleDateSelection(date: string) {
    setSelection((prev) => (prev?.kind === 'date' && prev.date === date ? null : { kind: 'date', date }))
  }

  function toggleWeekdaySelection(jsDay: number) {
    setSelection((prev) => (prev?.kind === 'weekday' && prev.jsDay === jsDay ? null : { kind: 'weekday', jsDay }))
  }

  const { from, to, days } = useMemo(() => rangeFor(period, customMonths), [period, customMonths])

  const cacheKey = period === 'custom' ? `dashboard:custom:${customMonths}` : `dashboard:${period}`
  const {
    data,
    loading,
    error: fetchError,
  } = useCachedFetch(cacheKey, () => fetchDashboardData(from, to))
  const error = fetchError ? (fetchError instanceof ApiError ? fetchError.message : 'Could not load dashboard data') : null

  const orders = data?.orders ?? EMPTY_ORDERS
  const lineItems = data?.lineItems ?? EMPTY_LINE_ITEMS
  const vendorPayments = data?.vendorPayments ?? EMPTY_VENDOR_PAYMENTS
  const salaryPayments = data?.salaryPayments ?? EMPTY_SALARY_PAYMENTS
  const otherExpenses = data?.otherExpenses ?? EMPTY_OTHER_EXPENSES

  const completedOrders = useMemo(() => orders.filter((o) => o.status === 'completed'), [orders])
  const cancelledIds = useMemo(
    () => new Set(orders.filter((o) => o.status === 'cancelled').map((o) => o.id)),
    [orders],
  )
  const validLineItems = useMemo(
    () => lineItems.filter((li) => !cancelledIds.has(li.order.id)),
    [lineItems, cancelledIds],
  )

  const totalSales = completedOrders.reduce((sum, o) => sum + o.total, 0)
  const billCount = completedOrders.length
  const avgBill = billCount > 0 ? totalSales / billCount : 0

  // Cash-basis: what was actually paid out in this period (vendor payments + salary
  // payments + other expenses), not accrued purchase totals — mirrors how Sales already
  // counts an order when it's paid, not when the food is made.
  const totalExpenses =
    vendorPayments.reduce((sum, p) => sum + p.amount, 0) +
    salaryPayments.reduce((sum, p) => sum + p.amount, 0) +
    otherExpenses.reduce((sum, e) => sum + e.amount, 0)
  const netProfit = totalSales - totalExpenses

  const trendData = useMemo(() => {
    const byDay = new Map<string, number>()
    for (const d of days) byDay.set(d, 0)
    for (const o of completedOrders) byDay.set(o.orderDate, (byDay.get(o.orderDate) ?? 0) + o.total)
    return days.map((d) => ({ day: d, label: formatDateLabel(d), sales: byDay.get(d) ?? 0 }))
  }, [days, completedOrders])

  const weekdayAggData = useMemo(() => {
    const sums = new Array(7).fill(0)
    for (const o of completedOrders) sums[weekdayOf(o.orderDate)] += o.total
    return WEEKDAYS.map(({ label, jsDay }) => ({ day: label, label, sales: sums[jsDay], jsDay }))
  }, [completedOrders])

  const weekdayTrendData = useMemo(() => {
    if (weekdayFilter === 'all') return []
    const matchingDates = days.filter((d) => weekdayOf(d) === weekdayFilter)
    const byDate = new Map<string, number>()
    for (const o of completedOrders) byDate.set(o.orderDate, (byDate.get(o.orderDate) ?? 0) + o.total)
    return matchingDates.map((d) => ({ day: d, label: formatDateLabel(d), sales: byDate.get(d) ?? 0 }))
  }, [days, completedOrders, weekdayFilter])

  const weekdayChartData = weekdayFilter === 'all' ? weekdayAggData : weekdayTrendData
  const weekdayChartLabel =
    weekdayFilter === 'all' ? 'By weekday' : `Every ${WEEKDAYS.find((w) => w.jsDay === weekdayFilter)?.fullLabel}`

  const filteredLineItems = useMemo(() => {
    if (!selection) return validLineItems
    if (selection.kind === 'date') return validLineItems.filter((li) => li.orderDate === selection.date)
    return validLineItems.filter((li) => weekdayOf(li.orderDate) === selection.jsDay)
  }, [validLineItems, selection])

  const selectionLabel =
    selection?.kind === 'date'
      ? formatDateLabel(selection.date)
      : selection?.kind === 'weekday'
        ? `Every ${WEEKDAYS.find((w) => w.jsDay === selection.jsDay)?.fullLabel}`
        : null

  const itemStats = useMemo(() => {
    const byItem = new Map<string, { name: string; category: string; revenue: number; qty: number; priceType: string }>()
    for (const li of filteredLineItems) {
      const key = li.itemName
      const existing = byItem.get(key)
      if (existing) {
        existing.revenue += li.lineTotal
        existing.qty += li.quantity
      } else {
        byItem.set(key, {
          name: li.itemName,
          category: li.categoryName,
          revenue: li.lineTotal,
          qty: li.quantity,
          priceType: li.priceType,
        })
      }
    }
    return [...byItem.values()].sort((a, b) => b.revenue - a.revenue)
  }, [filteredLineItems])

  const maxItemRevenue = itemStats[0]?.revenue ?? 0

  return (
    <div className="flex min-h-full flex-col bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <h1 className="text-lg font-bold text-neutral-900">Dashboard</h1>
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
                period === p ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={36}
              value={customMonths}
              onChange={(e) => setCustomMonths(Math.min(36, Math.max(1, Number(e.target.value) || 1)))}
              className="input w-20 py-1.5 text-sm"
            />
            <span className="text-sm text-neutral-500">months back</span>
          </div>
        )}
      </header>

      {error && <p className="m-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading && !error && <p className="p-6 text-center text-sm text-neutral-400">Loading…</p>}

      {!loading && (
        <div className="flex-1 space-y-5 p-4">
          <div className="grid grid-cols-3 gap-2.5">
            <StatTile label="Sales" value={formatInr(totalSales)} />
            <StatTile label="Bills" value={String(billCount)} />
            <StatTile label="Avg / bill" value={formatInr(avgBill)} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <StatTile label="Expenses" value={formatInr(totalExpenses)} />
            <StatTile
              label="Net profit"
              value={formatInr(netProfit)}
              valueClassName={netProfit >= 0 ? 'text-green-600' : 'text-red-600'}
            />
          </div>

          {period !== 'today' && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400">Sales trend</h2>
                <div className="flex rounded-lg bg-neutral-100 p-0.5 text-xs font-medium">
                  <button
                    onClick={() => setViewMode('date')}
                    className={`rounded-md px-2.5 py-1 ${viewMode === 'date' ? 'bg-white text-brand-700 shadow-sm' : 'text-neutral-500'}`}
                  >
                    By date
                  </button>
                  <button
                    onClick={() => setViewMode('weekday')}
                    className={`rounded-md px-2.5 py-1 ${viewMode === 'weekday' ? 'bg-white text-brand-700 shadow-sm' : 'text-neutral-500'}`}
                  >
                    By weekday
                  </button>
                </div>
              </div>

              {viewMode === 'weekday' && (
                <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto pb-1">
                  <button
                    onClick={() => setWeekdayFilter('all')}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                      weekdayFilter === 'all' ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    All days
                  </button>
                  {WEEKDAYS.map(({ label, jsDay }) => (
                    <button
                      key={jsDay}
                      onClick={() => setWeekdayFilter(jsDay)}
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                        weekdayFilter === jsDay ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <TrendChart
                data={viewMode === 'date' ? trendData : weekdayChartData}
                caption={viewMode === 'weekday' ? weekdayChartLabel : undefined}
                selectedKey={
                  viewMode === 'date'
                    ? selection?.kind === 'date'
                      ? selection.date
                      : undefined
                    : weekdayFilter === 'all'
                      ? selection?.kind === 'weekday'
                        ? WEEKDAYS.find((w) => w.jsDay === selection.jsDay)?.label
                        : undefined
                      : selection?.kind === 'date'
                        ? selection.date
                        : undefined
                }
                onBarClick={(entry) => {
                  if (viewMode === 'weekday' && weekdayFilter === 'all') {
                    toggleWeekdaySelection(entry.jsDay!)
                  } else {
                    toggleDateSelection(entry.day)
                  }
                }}
              />
              <p className="mt-1.5 text-center text-[11px] text-neutral-400">Tap a bar to see that day's item-wise sales below.</p>
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400">
                Item-wise sales{selectionLabel && <span className="text-neutral-500"> · {selectionLabel}</span>}
              </h2>
              {selection && (
                <button
                  onClick={() => setSelection(null)}
                  className="text-xs font-medium text-brand-700 underline"
                >
                  Clear
                </button>
              )}
            </div>
            {itemStats.length === 0 ? (
              <p className="rounded-xl border border-neutral-200 bg-white p-4 text-center text-sm text-neutral-400">
                No sales for this selection yet.
              </p>
            ) : (
              <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
                {itemStats.map((item, i) => (
                  <div key={item.name} className="relative overflow-hidden px-4 py-3">
                    <div
                      className="absolute inset-y-0 left-0 bg-brand-50"
                      style={{ width: `${maxItemRevenue > 0 ? (item.revenue / maxItemRevenue) * 100 : 0}%` }}
                      aria-hidden
                    />
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-4 text-xs font-semibold text-neutral-400">{i + 1}</span>
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{item.name}</p>
                          <p className="text-xs text-neutral-500">
                            {item.category} · {round2(item.qty)}
                            {item.priceType === 'per_kg' ? ' kg sold' : ' sold'}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-neutral-900">{formatInr(item.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

interface TrendPoint {
  day: string
  label: string
  sales: number
  jsDay?: number
}

function TrendChart({
  data,
  caption,
  selectedKey,
  onBarClick,
}: {
  data: TrendPoint[]
  caption?: string
  selectedKey?: string
  onBarClick?: (entry: TrendPoint) => void
}) {
  const dense = data.length > 14
  const minWidth = dense ? Math.max(600, data.length * 26) : undefined
  // Card content is ~320px wide on a phone after padding; use that as the
  // budget when the chart isn't scrollable, or the scrollable width otherwise.
  // Space needed per label scales with how long the labels actually are
  // ("Mon" needs far less room than "16 Feb"), so short weekday-abbreviation
  // charts don't get thinned unnecessarily.
  const chartWidth = minWidth ?? 320
  const maxLabelLength = Math.max(1, ...data.map((d) => d.label.length))
  const pxPerLabel = maxLabelLength * 6.5 + 16
  const maxLabels = Math.max(4, Math.floor(chartWidth / pxPerLabel))
  const tickInterval = data.length > maxLabels ? Math.ceil(data.length / maxLabels) - 1 : 0

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      {caption && <p className="mb-1 text-xs text-neutral-400">{caption}</p>}
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-400">No data for this selection.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: minWidth ? `${minWidth}px` : undefined }}>
            <ResponsiveContainer width="100%" height={180} minWidth={minWidth}>
              <BarChart data={data} barCategoryGap={dense ? '20%' : '30%'} margin={{ left: 4, right: 4, top: 4 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                  interval={tickInterval}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  tickFormatter={formatAxisInr}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: BRAND_LIGHT }}
                  formatter={(v) => [formatInr(Number(v)), 'Sales']}
                  labelStyle={{ color: '#111827', fontWeight: 600 }}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Bar
                  dataKey="sales"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                  cursor={onBarClick ? 'pointer' : undefined}
                  onClick={(entry: { payload?: TrendPoint }) => {
                    if (entry.payload) onBarClick?.(entry.payload)
                  }}
                >
                  {data.map((entry) => (
                    <Cell key={entry.day} fill={!selectedKey || entry.day === selectedKey ? BRAND : BRAND_MUTED} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className={`mt-1 text-base font-bold ${valueClassName ?? 'text-neutral-900'}`}>{value}</p>
    </div>
  )
}
