import { useEffect, useState } from 'react'
import { PurchaseItemApi } from '../../lib/data'
import type { Purchase, PurchaseItem } from '../../lib/types'
import { formatDateLabel, formatInr, formatQtyWithUnit } from '../../lib/format'
import { CloseIcon } from '../../components/icons'

const STATUS_LABEL: Record<Purchase['paymentStatus'], string> = {
  unpaid: 'Unpaid',
  partial: 'Partially paid',
  paid: 'Paid',
}

export function PurchaseDetailSheet({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  const [lines, setLines] = useState<PurchaseItem[] | null>(null)

  useEffect(() => {
    PurchaseItemApi.listByPurchase(purchase.id).then(setLines)
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
            <div className="flex items-center justify-between text-sm text-neutral-500">
              <span>Due date</span>
              <span>{formatDateLabel(purchase.dueDate)}</span>
            </div>
          )}
          {purchase.notes && <p className="mt-2 text-sm text-neutral-500">{purchase.notes}</p>}
        </div>
      </div>
    </div>
  )
}
