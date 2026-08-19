import { useState } from 'react'
import { PurchasesTab } from './expenses/PurchasesTab'
import { StockTab } from './expenses/StockTab'

type ExpenseTab = 'purchases' | 'stock'

const TABS: { id: ExpenseTab; label: string }[] = [
  { id: 'purchases', label: 'Purchases' },
  { id: 'stock', label: 'Stock' },
]

export function Expenses() {
  const [tab, setTab] = useState<ExpenseTab>('purchases')

  return (
    <div className="flex min-h-full flex-col bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-neutral-900">Expenses</h1>
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
                tab === t.id ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'purchases' && <PurchasesTab />}
      {tab === 'stock' && <StockTab />}
    </div>
  )
}
