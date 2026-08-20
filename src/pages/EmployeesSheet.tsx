import { useEffect, useState, type FormEvent } from 'react'
import { EmployeeApi } from '../lib/data'
import type { Employee, PayFrequency } from '../lib/types'
import { formatInr } from '../lib/format'
import { ApiError } from '../lib/api'
import { CloseIcon, TrashIcon } from '../components/icons'
import { useConfirm } from '../lib/confirm'

const FREQUENCIES: { value: PayFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

export function EmployeesSheet({ onClose }: { onClose: () => void }) {
  const [employees, setEmployees] = useState<Employee[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [payRate, setPayRate] = useState('')
  const [payFrequency, setPayFrequency] = useState<PayFrequency>('daily')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)

  function load() {
    EmployeeApi.list()
      .then((es) => setEmployees(es.sort((a, b) => a.name.localeCompare(b.name))))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load employees'))
  }

  useEffect(load, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const rate = Number(payRate)
    if (!name.trim() || !rate || rate <= 0) return
    setError(null)
    setBusy(true)
    try {
      const created = await EmployeeApi.create({ name: name.trim(), payFrequency, payRate: rate })
      setEmployees((prev) => [...(prev ?? []), created].sort((a, b) => a.name.localeCompare(b.name)))
      setName('')
      setPayRate('')
      setPayFrequency('daily')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add employee')
    } finally {
      setBusy(false)
    }
  }

  const activeEmployees = (employees ?? []).filter((emp) => emp.active)
  const inactiveEmployees = (employees ?? []).filter((emp) => !emp.active)

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[85dvh] w-full max-w-[480px] md:max-w-[600px] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 p-5 pb-3">
          <h2 className="text-base font-bold text-neutral-900">Employees</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {error && <p className="my-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {employees === null && !error && <p className="py-6 text-center text-sm text-neutral-400">Loading…</p>}
          {employees?.length === 0 && (
            <p className="py-6 text-center text-sm text-neutral-400">No employees yet — add one below.</p>
          )}
          {activeEmployees.map((emp) => (
            <EmployeeRow key={emp.id} employee={emp} onClick={() => setEditing(emp)} />
          ))}
          {inactiveEmployees.length > 0 && (
            <>
              <h3 className="mb-1 mt-3 text-xs font-bold uppercase tracking-wide text-neutral-400">Inactive</h3>
              {inactiveEmployees.map((emp) => (
                <EmployeeRow key={emp.id} employee={emp} onClick={() => setEditing(emp)} />
              ))}
            </>
          )}
        </div>

        <div className="p-5 pt-3">
          <form onSubmit={handleAdd} className="space-y-2">
            <div className="flex gap-2">
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Employee name"
              />
              <input
                className="input w-24"
                type="number"
                inputMode="decimal"
                value={payRate}
                onChange={(e) => setPayRate(e.target.value)}
                placeholder="Pay rate"
              />
            </div>
            <div className="flex gap-2">
              <select
                className="input flex-1"
                value={payFrequency}
                onChange={(e) => setPayFrequency(e.target.value as PayFrequency)}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={busy || !name.trim() || !payRate}
                className="shrink-0 rounded-xl bg-brand-700 px-5 py-2.5 font-semibold text-white active:bg-brand-800 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </form>
        </div>
      </div>

      {editing && (
        <EditEmployeeSheet
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setEmployees((prev) => prev?.map((emp) => (emp.id === updated.id ? updated : emp)).sort((a, b) => a.name.localeCompare(b.name)) ?? null)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function EmployeeRow({ employee, onClick }: { employee: Employee; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between border-b border-neutral-50 py-3 text-left ${!employee.active ? 'opacity-40' : ''}`}
    >
      <div>
        <p className="text-sm font-medium text-neutral-900">{employee.name}</p>
        {employee.role && <p className="text-xs text-neutral-500">{employee.role}</p>}
      </div>
      <span className="text-xs font-medium text-neutral-500">
        {formatInr(employee.payRate)} / {employee.payFrequency}
      </span>
    </button>
  )
}

function EditEmployeeSheet({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee
  onClose: () => void
  onSaved: (emp: Employee) => void
}) {
  const [name, setName] = useState(employee.name)
  const [phone, setPhone] = useState(employee.phone ?? '')
  const [role, setRole] = useState(employee.role ?? '')
  const [payFrequency, setPayFrequency] = useState<PayFrequency>(employee.payFrequency)
  const [payRate, setPayRate] = useState(String(employee.payRate))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmDialog = useConfirm()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const rate = Number(payRate)
    if (!name.trim() || !rate || rate <= 0) return
    setError(null)
    setBusy(true)
    try {
      const updated = await EmployeeApi.update(employee.id, {
        name: name.trim(),
        phone: phone.trim(),
        role: role.trim(),
        payFrequency,
        payRate: rate,
      })
      onSaved({ ...employee, ...updated })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save employee')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    const ok = await confirmDialog({
      title: `Remove "${employee.name}"?`,
      message: 'This hides them from future salary payments but keeps past payment history intact.',
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      const updated = await EmployeeApi.update(employee.id, { active: false })
      onSaved({ ...employee, ...updated })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove employee')
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
          <h2 className="text-base font-bold text-neutral-900">Edit employee</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Phone</span>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Role</span>
            <input className="input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Cook" />
          </label>
          <div className="flex gap-2">
            <label className="block flex-1">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Pay frequency</span>
              <select className="input" value={payFrequency} onChange={(e) => setPayFrequency(e.target.value as PayFrequency)}>
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block flex-1">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Pay rate (₹)</span>
              <input className="input" type="number" inputMode="decimal" value={payRate} onChange={(e) => setPayRate(e.target.value)} />
            </label>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex gap-2 pt-1">
            {employee.active && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="flex items-center justify-center rounded-xl border border-red-200 px-4 py-3 text-red-600 active:bg-red-50 disabled:opacity-60"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            )}
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-xl bg-brand-700 py-3 font-semibold text-white active:bg-brand-800 disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>

          {!employee.active && (
            <button
              type="button"
              onClick={async () => {
                setBusy(true)
                try {
                  const updated = await EmployeeApi.update(employee.id, { active: true })
                  onSaved({ ...employee, ...updated })
                } finally {
                  setBusy(false)
                }
              }}
              className="w-full pt-1 text-center text-sm font-medium text-neutral-500 underline"
            >
              Reactivate employee
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
