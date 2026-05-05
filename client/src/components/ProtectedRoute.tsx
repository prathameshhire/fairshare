import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'

// ProtectedRoute is a "wrapper" component that sits around the pages that
// require the user to be logged in (Expenses, Balances, People, etc.).
//
// How it works:
//   - It reads the token from the auth store.
//   - If there IS a token → render <Outlet />, which means "render whatever
//     child route is matched" (e.g. ExpensesPage, BalancesPage, etc.)
//   - If there is NO token → redirect to /login automatically.
//
// <Navigate replace> means the /login URL replaces the current history entry
// so pressing the browser Back button won't send the user back to a page
// they can't see.

export function ProtectedRoute() {
  const token = useAuthStore((s) => s.token)

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
