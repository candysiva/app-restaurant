import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { isOwner } from '../lib/types'
import {
  AlertTriangleIcon,
  EmployeeIcon,
  LogoutIcon,
  MenuBookIcon,
  PackageIcon,
  PurchaseIcon,
  TruckIcon,
  UsersIcon,
} from '../components/icons'
import { StaffSheet } from './StaffSheet'
import { CategoriesSheet } from './CategoriesSheet'
import { MenuSheet } from './MenuSheet'
import { VendorsSheet } from './VendorsSheet'
import { MaterialsSheet } from './MaterialsSheet'
import { EmployeesSheet } from './EmployeesSheet'
import { useConfirm } from '../lib/confirm'
import { useCachedFetch } from '../lib/cache'
import { MaterialApi } from '../lib/data'

export function Settings() {
  const { user, signOut } = useAuth()
  const [showMenu, setShowMenu] = useState(false)
  const [showStaff, setShowStaff] = useState(false)
  const [showCategories, setShowCategories] = useState(false)
  const [showVendors, setShowVendors] = useState(false)
  const [showMaterials, setShowMaterials] = useState(false)
  const [showEmployees, setShowEmployees] = useState(false)
  const confirmDialog = useConfirm()
  const { data: materials } = useCachedFetch('materials', MaterialApi.list)
  const lowStockCount = (materials ?? []).filter((m) => m.active && m.currentStock <= m.minStockThreshold).length

  async function handleSignOut() {
    if (await confirmDialog({ title: 'Sign out?', confirmLabel: 'Sign out' })) signOut()
  }

  return (
    <div className="flex min-h-full flex-col bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-neutral-900">More</h1>
      </header>

      <div className="flex-1 space-y-5 p-4">
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">Account</h2>
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="font-medium text-neutral-900">{user?.name}</p>
            <p className="text-sm text-neutral-500">{user?.email}</p>
            <span
              className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                isOwner(user) ? 'bg-brand-50 text-brand-700' : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {isOwner(user) ? 'Owner' : 'Staff'}
            </span>
          </div>
        </section>

        {isOwner(user) && (
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">Shop setup</h2>
            <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
              <button
                onClick={() => setShowMenu(true)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <MenuBookIcon className="h-5 w-5 text-neutral-400" />
                <span className="flex-1 text-sm font-medium text-neutral-900">Menu</span>
                <span className="text-neutral-300">›</span>
              </button>
              <button
                onClick={() => setShowCategories(true)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <MenuBookIcon className="h-5 w-5 text-neutral-400" />
                <span className="flex-1 text-sm font-medium text-neutral-900">Categories</span>
                <span className="text-neutral-300">›</span>
              </button>
              <button
                onClick={() => setShowStaff(true)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <UsersIcon className="h-5 w-5 text-neutral-400" />
                <span className="flex-1 text-sm font-medium text-neutral-900">Staff logins</span>
                <span className="text-neutral-300">›</span>
              </button>
              <button
                onClick={() => setShowVendors(true)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <TruckIcon className="h-5 w-5 text-neutral-400" />
                <span className="flex-1 text-sm font-medium text-neutral-900">Vendors</span>
                <span className="text-neutral-300">›</span>
              </button>
              <Link to="/purchases" className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                <PurchaseIcon className="h-5 w-5 text-neutral-400" />
                <span className="flex-1 text-sm font-medium text-neutral-900">Purchases</span>
                <span className="text-neutral-300">›</span>
              </Link>
              <button
                onClick={() => setShowMaterials(true)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <PackageIcon className="h-5 w-5 text-neutral-400" />
                <span className="flex-1 text-sm font-medium text-neutral-900">Materials &amp; stock</span>
                {lowStockCount > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                    <AlertTriangleIcon className="h-3 w-3" />
                    {lowStockCount}
                  </span>
                )}
                <span className="text-neutral-300">›</span>
              </button>
              <button
                onClick={() => setShowEmployees(true)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <EmployeeIcon className="h-5 w-5 text-neutral-400" />
                <span className="flex-1 text-sm font-medium text-neutral-900">Employees</span>
                <span className="text-neutral-300">›</span>
              </button>
              <Link to="/salaries" className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                <PurchaseIcon className="h-5 w-5 text-neutral-400" />
                <span className="flex-1 text-sm font-medium text-neutral-900">Salaries</span>
                <span className="text-neutral-300">›</span>
              </Link>
            </div>
          </section>
        )}

        <section>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white py-3.5 text-sm font-semibold text-neutral-600 active:bg-neutral-50"
          >
            <LogoutIcon className="h-4 w-4" /> Sign out
          </button>
        </section>
      </div>

      {showMenu && <MenuSheet onClose={() => setShowMenu(false)} />}
      {showStaff && <StaffSheet onClose={() => setShowStaff(false)} />}
      {showCategories && <CategoriesSheet onClose={() => setShowCategories(false)} />}
      {showVendors && <VendorsSheet onClose={() => setShowVendors(false)} />}
      {showMaterials && <MaterialsSheet onClose={() => setShowMaterials(false)} />}
      {showEmployees && <EmployeesSheet onClose={() => setShowEmployees(false)} />}
    </div>
  )
}
