import { NavLink } from 'react-router-dom'
import { BillIcon, MenuBookIcon, OrdersIcon, DashboardIcon } from './icons'

const tabs = [
  { to: '/', label: 'Bill', Icon: BillIcon, end: true },
  { to: '/menu', label: 'Menu', Icon: MenuBookIcon, end: false },
  { to: '/orders', label: 'Orders', Icon: OrdersIcon, end: false },
  { to: '/dashboard', label: 'Dashboard', Icon: DashboardIcon, end: false },
]

export function BottomNav() {
  return (
    <nav
      className="sticky bottom-0 z-20 flex border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      {tabs.map(({ to, label, Icon, end }) => (
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
