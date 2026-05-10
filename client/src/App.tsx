import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ExpensesPage } from './pages/ExpensesPage'
import { ExpenseDetailPage } from './pages/ExpenseDetailPage'
import { AddExpensePage } from './pages/AddExpensePage'
import { BalancesPage } from './pages/BalancesPage'
import { FriendsPage } from './pages/FriendsPage'

// How the routing is structured:
//
// /login      → LoginPage    (public — no auth required)
// /register   → RegisterPage (public — no auth required)
// everything else → wrapped in <ProtectedRoute>, which redirects to /login
//              if the user isn't logged in, or shows the page if they are.

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — visible without being logged in */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes — ProtectedRoute checks for a token first */}
        <Route element={<ProtectedRoute />}>
          {/* Layout adds the nav bar; Outlet inside it renders the matched page */}
          <Route element={<Layout />}>
            {/* Redirect root "/" to "/expenses" so there's always a default page */}
            <Route index element={<Navigate to="/expenses" replace />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="expenses/new" element={<AddExpensePage />} />
            <Route path="expenses/:id" element={<ExpenseDetailPage />} />
            <Route path="balances" element={<BalancesPage />} />
            <Route path="friends" element={<FriendsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
