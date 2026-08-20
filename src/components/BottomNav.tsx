import { NavLink } from 'react-router-dom'
import { BillIcon, OrdersIcon, StockIcon, DashboardIcon, MoreIcon } from './icons'
import { isOwner } from '../lib/types'
import { useAuth } from '../lib/auth'

const tabs = [
  { to: '/', label: 'Bill', Icon: BillIcon, end: true, ownerOnly: false },
  { to: '/orders', label: 'Orders', Icon: OrdersIcon, end: false, ownerOnly: false },
  { to: '/stock', label: 'Stock', Icon: StockIcon, end: false, ownerOnly: true },
  { to: '/dashboard', label: 'Dashboard', Icon: DashboardIcon, end: false, ownerOnly: true },
  { to: '/settings', label: 'More', Icon: MoreIcon, end: false, ownerOnly: false },
]

export function BottomNav() {
  const { user } = useAuth()
  const visibleTabs = tabs.filter((t) => !t.ownerOnly || isOwner(user))

  return (
    <nav
      className="sticky bottom-0 z-20 flex border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      {visibleTabs.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
              isActive ? 'text-brand-700' : 'text-neutral-400'
            }`
          }
        >
          <Icon className="h-6 w-6" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
