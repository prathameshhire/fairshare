import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { UserAvatar } from './UserAvatar'
import { LogoMark } from './LogoMark'

export function Layout() {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()

  function handleLogout() {
    clearAuth()
    navigate('/')
  }

  return (
    // Full-page subtle gradient — picks up the emerald tint from the nav and
    // fades down to white, matching the auth pages and the landing aesthetic.
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white">

      {/* ── Top navigation ───────────────────────────────────────────────
          Sticky + frosted-glass + gradient — same recipe as the landing nav
          so the brand feels continuous from marketing → app. */}
      <nav className="sticky top-0 z-40 bg-gradient-to-r from-emerald-100/60 via-green-50/70 to-emerald-100/60 backdrop-blur-md border-b border-emerald-100/60">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-16">
          {/* Brand */}
          <NavLink to="/expenses" className="hover:opacity-90 transition-opacity">
            <LogoMark size="sm" />
          </NavLink>

          {/* Page links */}
          <div className="flex gap-1">
            <NavLink
              to="/expenses"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/70 text-green-700 shadow-sm'
                    : 'text-gray-600 hover:bg-white/40 hover:text-gray-900'
                }`
              }
            >
              Expenses
            </NavLink>
            <NavLink
              to="/balances"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/70 text-green-700 shadow-sm'
                    : 'text-gray-600 hover:bg-white/40 hover:text-gray-900'
                }`
              }
            >
              Balances
            </NavLink>
            <NavLink
              to="/groups"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/70 text-green-700 shadow-sm'
                    : 'text-gray-600 hover:bg-white/40 hover:text-gray-900'
                }`
              }
            >
              Groups
            </NavLink>
            <NavLink
              to="/friends"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/70 text-green-700 shadow-sm'
                    : 'text-gray-600 hover:bg-white/40 hover:text-gray-900'
                }`
              }
            >
              Friends
            </NavLink>
          </div>

          {/* Logged-in user display + logout */}
          <div className="flex items-center gap-2.5">
            {user && <UserAvatar name={user.name} size="sm" />}
            <span className="text-sm font-medium text-gray-800 hidden sm:block">
              {user?.name}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 bg-white/60 border border-gray-200 rounded-md px-2.5 py-1 hover:bg-white hover:text-gray-900 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
