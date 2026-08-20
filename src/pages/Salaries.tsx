import { useMemo, useState } from 'react'
import { EmployeeApi, SalaryPaymentApi } from '../lib/data'
import type { Employee, PaymentMethod, SalaryPayment } from '../lib/types'
import { dateIso, formatDateLabel, formatInr, todayIso } from '../lib/format'
import { ApiError } from '../lib/api'
import { CloseIcon, PlusIcon } from '../components/icons'
import { useCachedFetch } from '../lib/cache'

type RangeTab = 'today' | 'week' | 'all'

const EMPTY_PAYMENTS: SalaryPayment[] = []

async function fetchSalaryPayments(range: RangeTab): Promise<SalaryPayment[]> {
  if (range === 'all') {
    const all = await SalaryPaymentApi.listInRange('2000-01-01', '2999-12-31')
    return all
  }
  const to = todayIso()
  const from = range === 'today' ? to : dateIso(new Date(Date.now() - 6 * 86400000))
  return SalaryPaymentApi.listInRange(from, to)
}

export function Salaries() {
  const [range, setRange] = useState<RangeTab>('today')
  const {
    data: rawPayments,
    loading,
    error: fetchError,
    mutate,
  } = useCachedFetch(`salary-payments:${range}`, () => fetchSalaryPayments(range))
  const { data: employees } = useCachedFetch('employees', EmployeeApi.list)
  const [adding, setAdding] = useState(false)

  const payments = rawPayments ?? EMPTY_PAYMENTS
  const error = fetchError ? (fetchError instanceof ApiError ? fetchError.message : 'Could not load salary payments') : null
  const activeEmployees = useMemo(() => (employees ?? []).filter((e) => e.active), [employees])

  const rangeTotal = useMemo(() => payments.reduce((sum, p) => sum + p.amount, 0), [payments])

  return (
    <div className="flex min-h-full flex-col bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-neutral-900">Salaries</h1>
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
      </header>

      {payments.length > 0 && (
        <div className="flex items-center justify-between bg-brand-50 px-4 py-2.5 text-sm">
          <span className="text-neutral-600">
            {payments.length} payment{payments.length === 1 ? '' : 's'}
          </span>
          <span className="font-bold text-brand-700">{formatInr(rangeTotal)}</span>
        </div>
      )}

      {error && <p className="m-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading && payments.length === 0 && !error && (
        <p className="p-6 text-center text-sm text-neutral-400">Loading…</p>
      )}
      {!loading && payments.length === 0 && (
        <p className="p-8 text-center text-sm text-neutral-400">No salary payments in this period.</p>
      )}

      <div className="flex-1 divide-y divide-neutral-100 px-4">
        {payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-neutral-900">{p.employee.name}</p>
              <p className="text-xs text-neutral-500">
                {formatDateLabel(p.periodStart)} – {formatDateLabel(p.periodEnd)} · {p.paymentMethod.toUpperCase()}
              </p>
            </div>
            <span className="font-semibold text-neutral-900">{formatInr(p.amount)}</span>
          </div>
        ))}
      </div>

      {adding && (
        <SalaryPaymentSheet
          employees={activeEmployees}
          onClose={() => setAdding(false)}
          onSaved={(payment) => {
            mutate((prev) => [payment, ...(prev ?? [])])
            setAdding(false)
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
          <h2 className="text-base font-bold text-neutral-900">Record salary payment</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{message}</p>
      </div>
    </div>
  )
}

function SalaryPaymentSheet({
  employees,
  onClose,
  onSaved,
}: {
  employees: Employee[]
  onClose: () => void
  onSaved: (payment: SalaryPayment) => void
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '')
  const employee = employees.find((e) => e.id === employeeId)

  const [amount, setAmount] = useState(employee ? String(employee.payRate) : '')
  const [periodStart, setPeriodStart] = useState(todayIso())
  const [periodEnd, setPeriodEnd] = useState(todayIso())
  const [paymentDate, setPaymentDate] = useState(todayIso())
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleEmployeeChange(id: string) {
    setEmployeeId(id)
    const emp = employees.find((e) => e.id === id)
    if (emp) setAmount(String(emp.payRate))
  }

  const parsedAmount = Number(amount)
  const valid = employee && amount.trim() !== '' && Number.isFinite(parsedAmount) && parsedAmount > 0 && periodStart && periodEnd

  async function handleSubmit() {
    if (!valid || !employee) return
    setError(null)
    setBusy(true)
    try {
      const payment = await SalaryPaymentApi.create({
        employee: { id: employee.id },
        amount: parsedAmount,
        periodStart,
        periodEnd,
        paymentDate,
        paymentMethod,
        notes: notes.trim() || undefined,
      })
      onSaved({ ...payment, employee: { id: employee.id, name: employee.name, payFrequency: employee.payFrequency } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the payment')
      setBusy(false)
    }
  }

  if (employees.length === 0) {
    return <Blocked onClose={onClose} message="Add an employee first — More → Employees — before recording a salary payment." />
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[90dvh] w-full max-w-[480px] md:max-w-[600px] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 p-5 pb-3">
          <h2 className="text-base font-bold text-neutral-900">Record salary payment</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Employee</span>
            <select className="input" value={employeeId} onChange={(e) => handleEmployeeChange(e.target.value)}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Amount</span>
            <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>

          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Period start</span>
              <input type="date" className="input" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </label>
            <label className="block flex-1">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Period end</span>
              <input type="date" className="input" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Payment date</span>
            <input type="date" className="input" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
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
            {busy ? 'Saving…' : `Record ${formatInr(parsedAmount || 0)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
