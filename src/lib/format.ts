/** Rounds to 2 decimal places, correcting the tiny binary floating-point error that
 * arithmetic like 0.1 + 0.2 or repeated stock additions can leave behind. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(round2(amount))
}

export function formatQty(qty: number, priceType: 'fixed' | 'per_kg'): string {
  return priceType === 'per_kg' ? `${round2(qty)} kg` : `${round2(qty)}`
}

export function formatQtyWithUnit(qty: number, unit: string): string {
  return `${round2(qty)} ${unit}`
}

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function dateIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export function formatDateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })
}
