import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { OrderApi, OrderItemApi } from '../lib/data'
import type { Order, OrderItem } from '../lib/types'
import { dateIso, formatDateLabel, formatInr, todayIso } from '../lib/format'
import { ApiError } from '../lib/api'

type Period = 'today' | 'week' | 'month'

const BRAND = '#b91c1c'
const BRAND_LIGHT = '#fee2e2'

function rangeFor(period: Period): { from: string; to: string; days: string[] } {
  const to = new Date()
  const toIso = todayIso()
  if (period === 'today') return { from: toIso, to: toIso, days: [toIso] }

  if (period === 'week') {
    const days: string[] = []
    for (let i = 6; i >= 0; i--) days.push(dateIso(new Date(to.getTime() - i * 86400000)))
    return { from: days[0], to: toIso, days }
  }

  const firstOfMonth = new Date(to.getFullYear(), to.getMonth(), 1)
  const days: string[] = []
  for (let d = new Date(firstOfMonth); d <= to; d.setDate(d.getDate() + 1)) {
    days.push(dateIso(d))
  }
  return { from: dateIso(firstOfMonth), to: toIso, days }
}

export function Dashboard() {
  const [period, setPeriod] = useState<Period>('today')
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [lineItems, setLineItems] = useState<OrderItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { from, to, days } = useMemo(() => rangeFor(period), [period])

  useEffect(() => {
    setOrders(null)
    setLineItems(null)
    setError(null)
    Promise.all([OrderApi.listInRange(from, to), OrderItemApi.listInRange(from, to)])
      .then(([o, li]) => {
        setOrders(o)
        setLineItems(li)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load dashboard data'))
  }, [from, to])

  const completedOrders = useMemo(() => (orders ?? []).filter((o) => o.status === 'completed'), [orders])
  const cancelledIds = useMemo(
    () => new Set((orders ?? []).filter((o) => o.status === 'cancelled').map((o) => o.id)),
    [orders],
  )
  const validLineItems = useMemo(
    () => (lineItems ?? []).filter((li) => !cancelledIds.has(li.order.id)),
    [lineItems, cancelledIds],
  )

  const totalSales = completedOrders.reduce((sum, o) => sum + o.total, 0)
  const billCount = completedOrders.length
  const avgBill = billCount > 0 ? totalSales / billCount : 0

  const trendData = useMemo(() => {
    const byDay = new Map<string, number>()
    for (const d of days) byDay.set(d, 0)
    for (const o of completedOrders) byDay.set(o.orderDate, (byDay.get(o.orderDate) ?? 0) + o.total)
    return days.map((d) => ({ day: d, label: formatDateLabel(d), sales: byDay.get(d) ?? 0 }))
  }, [days, completedOrders])

  const itemStats = useMemo(() => {
    const byItem = new Map<string, { name: string; category: string; revenue: number; qty: number; priceType: string }>()
    for (const li of validLineItems) {
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
  }, [validLineItems])

  const maxItemRevenue = itemStats[0]?.revenue ?? 0
  const loading = orders === null || lineItems === null

  return (
    <div className="flex min-h-full flex-col bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-neutral-900">Dashboard</h1>
        <div className="mt-2 flex gap-1.5">
          {(['today', 'week', 'month'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                period === p ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {p === 'today' ? 'Today' : p === 'week' ? 'This week' : 'This month'}
            </button>
          ))}
        </div>
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

          {period !== 'today' && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">Sales trend</h2>
              <div className="rounded-xl border border-neutral-200 bg-white p-3">
                <div className={period === 'month' ? 'min-w-[600px]' : ''} style={{ overflowX: 'auto' }}>
                  <ResponsiveContainer width="100%" height={180} minWidth={period === 'month' ? 600 : undefined}>
                    <BarChart data={trendData} barCategoryGap={period === 'month' ? '20%' : '30%'}>
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                        axisLine={{ stroke: '#e5e7eb' }}
                        tickLine={false}
                        interval={period === 'month' ? 2 : 0}
                      />
                      <Tooltip
                        cursor={{ fill: BRAND_LIGHT }}
                        formatter={(v) => [formatInr(Number(v)), 'Sales']}
                        labelStyle={{ color: '#111827', fontWeight: 600 }}
                        contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                      />
                      <Bar dataKey="sales" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">Item-wise sales</h2>
            {itemStats.length === 0 ? (
              <p className="rounded-xl border border-neutral-200 bg-white p-4 text-center text-sm text-neutral-400">
                No sales in this period yet.
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
                            {item.category} · {item.qty}
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

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-base font-bold text-neutral-900">{value}</p>
    </div>
  )
}
