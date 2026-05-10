import { useState } from 'react'
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { loginUser } from '../lib/api'
import { useAuthStore } from '../store/useAuthStore'
import { LogoMark } from '../components/LogoMark'

// Shape of the router state RegisterPage passes when it sends users here
// after a successful signup.
type LoginLocationState = {
  justRegistered?: boolean
  email?: string
  name?: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore((s) => s.setAuth)
  const token = useAuthStore((s) => s.token)

  // If we arrived here from /register, the state will tell us — and give us
  // the email + name to pre-fill the form and personalize the banner.
  const fromRegister = (location.state ?? null) as LoginLocationState | null

  const [email, setEmail] = useState(fromRegister?.email ?? '')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // We show the "account created" banner once per arrival from /register.
  // If the user submits a bad login attempt, we hide the banner to make
  // room for the error — the success message is no longer the most
  // relevant thing to show them.
  const [showRegisteredBanner, setShowRegisteredBanner] = useState(
    Boolean(fromRegister?.justRegistered),
  )

  // Already-logged-in guard: anyone who reaches /login while authenticated
  // gets redirected to the app. Important: this must come AFTER every
  // useState/useNavigate/etc. — React requires hooks to run in the same
  // order on every render, so we can't conditionally skip them.
  if (token) {
    return <Navigate to="/expenses" replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)
    setIsLoading(true)
    try {
      const { token, user } = await loginUser({ email, password })
      setAuth(token, user)
      navigate('/expenses')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Login failed')
      // Once they've tried to log in (and failed), the registration banner
      // is no longer relevant — hide it so the error gets the user's focus.
      setShowRegisteredBanner(false)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    // Gradient background mirrors the landing page so the auth screens feel
    // like part of the same product, not a separate utility.
    <div className="min-h-screen bg-gradient-to-b from-white to-emerald-50 flex flex-col">

      {/* Slim top bar with a back-to-home link */}
      <header className="px-6 pt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-green-700 transition-colors"
        >
          ← Back to home
        </Link>
      </header>

      {/* Center the card vertically in the remaining viewport */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">

          {/* Logo + brand on top, then a friendly headline */}
          <div className="flex flex-col items-center mb-7">
            <LogoMark size="md" withWordmark={false} />
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-sm text-gray-500 mt-1">
              Sign in to keep splitting expenses.
            </p>
          </div>

          {/* The form card itself */}
          <div className="bg-white rounded-2xl shadow-lg shadow-emerald-100/50 border border-gray-100 p-7">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              {/* Success banner — shown only when the user just registered.
                  If we got their name through router state, use the first
                  word (so "Alice Smith" greets as "Welcome, Alice"). Falls
                  back to a generic message if the name is missing. */}
              {showRegisteredBanner && (
                <p className="text-sm text-green-700 text-center bg-green-50 border border-green-100 rounded-lg py-2 px-3">
                  {fromRegister?.name
                    ? `Welcome, ${fromRegister.name.trim().split(' ')[0]}! Sign in to continue.`
                    : 'Account created. Sign in to continue.'}
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-shadow"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-shadow"
                />
              </div>

              {errorMessage && (
                <p className="text-sm text-red-600 text-center bg-red-50 border border-red-100 rounded-lg py-2 px-3">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="mt-2 bg-green-600 text-white font-semibold py-2.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 shadow-sm shadow-green-200"
              >
                {isLoading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-green-700 font-semibold hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
