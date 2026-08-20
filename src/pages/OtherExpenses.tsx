import { useMemo, useState } from 'react'
import { ExpenseCategoryApi, OtherExpenseApi, sortCategories } from '../lib/data'
import type { CategoryItem, OtherExpense, PaymentMethod } from '../lib/types'
import { dateIso, formatDateLabel, formatInr, round2, todayIso } from '../lib/format'
import { ApiError } from '../lib/api'
import { CloseIcon, PlusIcon, TrashIcon } from '../components/icons'
import { useCachedFetch } from '../lib/cache'
import { useConfirm } from '../lib/confirm'

type RangeTab = 'today' | 'week' | 'all'

const EMPTY_EXPENSES: OtherExpense[] = []

async function fetchExpenses(range: RangeTab): Promise<OtherExpense[]> {
  const to = todayIso()
  const from = range === 'today' ? to : range === 'week' ? dateIso(new Date(Date.now() - 6 * 86400000)) : '2000-01-01'
  return OtherExpenseApi.listInRange(from, to)
}

export function OtherExpenses() {
  const [range, setRange] = useState<RangeTab>('today')
  const {
    data: rawExpenses,
    loading,
    error: fetchError,
    mutate,
  } = useCachedFetch(`other-expenses:${range}`, () => fetchExpenses(range))
  const { data: rawCategories } = useCachedFetch('expense-categories', ExpenseCategoryApi.list)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<OtherExpense | null>(null)

  const expenses = rawExpenses ?? EMPTY_EXPENSES
  const categories = useMemo(() => sortCategories(rawCategories ?? []), [rawCategories])
  const noCategories = rawCategories !== null && rawCategories.length === 0
  const error = fetchError ? (fetchError instanceof ApiError ? fetchError.message : 'Could not load expenses') : null

  const rangeTotal = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses])

  return (
    <div className="flex min-h-full flex-col bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-neutral-900">Other expenses</h1>
          <button
            onClick={() => setAdding(true)}
            disabled={noCategories}
            className="flex shrink-0 items-center gap-1 rounded-full bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white active:bg-brand-800 disabled:opacity-40"
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
      </header>

      {noCategories && (
        <p className="m-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Add an expense category first — More → Expense categories — before logging an expense.
        </p>
      )}

      {expenses.length > 0 && (
        <div className="flex items-center justify-between bg-brand-50 px-4 py-2.5 text-sm">
          <span className="text-neutral-600">
            {expenses.length} expense{expenses.length === 1 ? '' : 's'}
          </span>
          <span className="font-bold text-brand-700">{formatInr(rangeTotal)}</span>
        </div>
      )}

      {error && <p className="m-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading && expenses.length === 0 && !error && (
        <p className="p-6 text-center text-sm text-neutral-400">Loading…</p>
      )}
      {!loading && expenses.length === 0 && (
        <p className="p-8 text-center text-sm text-neutral-400">No expenses in this period.</p>
      )}

      <div className="flex-1 divide-y divide-neutral-100 px-4">
        {expenses.map((e) => (
          <button
            key={e.id}
            onClick={() => setEditing(e)}
            className="flex w-full items-center justify-between py-3 text-left"
          >
            <div>
              <p className="font-medium text-neutral-900">
                {e.category?.name ?? 'Uncategorized'}
                {e.payee && <span className="text-xs font-normal text-neutral-400"> · {e.payee}</span>}
              </p>
              <p className="text-xs text-neutral-500">
                {formatDateLabel(e.expenseDate)} · {e.paymentMethod.toUpperCase()}
              </p>
            </div>
            <span className="font-semibold text-neutral-900">{formatInr(e.amount)}</span>
          </button>
        ))}
      </div>

      {adding && (
        <OtherExpenseSheet
          categories={categories}
          onClose={() => setAdding(false)}
          onSaved={(expense) => {
            mutate((prev) => [expense, ...(prev ?? [])])
            setAdding(false)
          }}
        />
      )}

      {editing && (
        <EditOtherExpenseSheet
          expense={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            mutate((prev) => (prev ?? []).map((e) => (e.id === updated.id ? updated : e)))
            setEditing(null)
          }}
          onDeleted={(id) => {
            mutate((prev) => (prev ?? []).filter((e) => e.id !== id))
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function OtherExpenseSheet({
  categories,
  onClose,
  onSaved,
}: {
  categories: CategoryItem[]
  onClose: () => void
  onSaved: (expense: OtherExpense) => void
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(todayIso())
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [payee, setPayee] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsedAmount = round2(Number(amount))
  const category = categories.find((c) => c.id === categoryId)
  const valid = amount.trim() !== '' && Number.isFinite(parsedAmount) && parsedAmount > 0 && !!category

  async function handleSubmit() {
    if (!valid || !category) return
    setError(null)
    setBusy(true)
    try {
      const expense = await OtherExpenseApi.create({
        category,
        amount: parsedAmount,
        expenseDate,
        paymentMethod,
        payee: payee.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      onSaved(expense)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the expense')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[90dvh] w-full max-w-[480px] md:max-w-[600px] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 p-5 pb-3">
          <h2 className="text-base font-bold text-neutral-900">Add expense</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Category</span>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.length === 0 && <option value="">No categories yet</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Amount</span>
            <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Date</span>
            <input type="date" className="input" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
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
            <span className="mb-1 block text-xs font-medium text-neutral-600">Payee (optional)</span>
            <input className="input" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="e.g. TNEB" />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Notes (optional)</span>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>

        <div className="p-5 pt-3">
          {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={busy || !valid}
            className="w-full rounded-xl bg-brand-700 py-3.5 font-semibold text-white active:bg-brand-800 disabled:opacity-60"
          >
            {busy ? 'Saving…' : `Save · ${formatInr(parsedAmount || 0)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditOtherExpenseSheet({
  expense,
  categories,
  onClose,
  onSaved,
  onDeleted,
}: {
  expense: OtherExpense
  categories: CategoryItem[]
  onClose: () => void
  onSaved: (expense: OtherExpense) => void
  onDeleted: (id: string) => void
}) {
  const [categoryId, setCategoryId] = useState(expense.category?.id ?? categories[0]?.id ?? '')
  const [amount, setAmount] = useState(String(expense.amount))
  const [expenseDate, setExpenseDate] = useState(expense.expenseDate)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(expense.paymentMethod)
  const [payee, setPayee] = useState(expense.payee ?? '')
  const [notes, setNotes] = useState(expense.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmDialog = useConfirm()

  const parsedAmount = round2(Number(amount))
  const category = categories.find((c) => c.id === categoryId)
  const valid = amount.trim() !== '' && Number.isFinite(parsedAmount) && parsedAmount > 0 && !!category

  async function handleSubmit() {
    if (!valid || !category) return
    setError(null)
    setBusy(true)
    try {
      const updated = await OtherExpenseApi.update(expense.id, {
        category,
        amount: parsedAmount,
        expenseDate,
        paymentMethod,
        payee: payee.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      onSaved({ ...expense, ...updated })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save changes')
      setBusy(false)
    }
  }

  async function handleDelete() {
    const ok = await confirmDialog({
      title: 'Delete this expense?',
      message: 'This removes the expense record permanently. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    setError(null)
    setBusy(true)
    try {
      await OtherExpenseApi.remove(expense.id)
      onDeleted(expense.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete this expense')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[90dvh] w-full max-w-[480px] md:max-w-[600px] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 p-5 pb-3">
          <h2 className="text-base font-bold text-neutral-900">Edit expense</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Category</span>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {expense.category && !categories.some((c) => c.id === expense.category!.id) && (
                <option value={expense.category.id}>{expense.category.name}</option>
              )}
              {categories.length === 0 && !expense.category && <option value="">No categories yet</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Amount</span>
            <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Date</span>
            <input type="date" className="input" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
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
            <span className="mb-1 block text-xs font-medium text-neutral-600">Payee (optional)</span>
            <input className="input" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="e.g. TNEB" />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Notes (optional)</span>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>

        <div className="p-5 pt-3">
          {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={busy}
              className="flex items-center justify-center rounded-xl border border-red-200 px-4 py-3 text-red-600 active:bg-red-50 disabled:opacity-60"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
            <button
              onClick={handleSubmit}
              disabled={busy || !valid}
              className="flex-1 rounded-xl bg-brand-700 py-3 font-semibold text-white active:bg-brand-800 disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
