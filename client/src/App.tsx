import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ExpensesPage } from './pages/ExpensesPage'
import { ExpenseDetailPage } from './pages/ExpenseDetailPage'
import { ExpenseFormPage } from './pages/ExpenseFormPage'
import { BalancesPage } from './pages/BalancesPage'
import { FriendsPage } from './pages/FriendsPage'

// Routing structure:
//
// PUBLIC (no auth required):
//   /          → LandingPage  (marketing page; redirects to /expenses if you ARE logged in)
//   /login     → LoginPage
//   /register  → RegisterPage
//
// PROTECTED (require a JWT — ProtectedRoute bounces to /login otherwise):
//   /expenses  /expenses/new  /expenses/:id  /expenses/:id/edit
//   /balances
//   /friends

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected — wrapped in ProtectedRoute, then Layout for the nav bar */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="expenses/new" element={<ExpenseFormPage />} />
            <Route path="expenses/:id" element={<ExpenseDetailPage />} />
            <Route path="expenses/:id/edit" element={<ExpenseFormPage />} />
            <Route path="balances" element={<BalancesPage />} />
            <Route path="friends" element={<FriendsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
