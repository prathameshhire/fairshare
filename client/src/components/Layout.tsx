import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { UserAvatar } from './UserAvatar'

export function Layout() {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()

  function handleLogout() {
    // Wipe the token and user from the store (and from localStorage)
    clearAuth()
    // Send the user to the login page
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top navigation bar */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
          {/* App name / logo */}
          <span className="font-bold text-green-600 text-lg tracking-tight">
            Fairshare
          </span>

          {/* Page links */}
          <div className="flex gap-1">
            <NavLink
              to="/expenses"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-100'
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
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              Balances
            </NavLink>
            <NavLink
              to="/users"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              People
            </NavLink>
          </div>

          {/* Logged-in user display + logout */}
          <div className="flex items-center gap-2.5">
            {user && <UserAvatar name={user.name} size="sm" />}
            <span className="text-sm font-medium text-gray-700 hidden sm:block">
              {user?.name}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 border border-gray-200 rounded-md px-2.5 py-1 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </nav>

      {/* Page content — <Outlet /> is where React Router renders the current page */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
