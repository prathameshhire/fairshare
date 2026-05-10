import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { registerUser } from '../lib/api'
import { useAuthStore } from '../store/useAuthStore'
import { LogoMark } from '../components/LogoMark'

export function RegisterPage() {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Already-logged-in guard: if you somehow reach /register while signed in
  // (typed URL, back button, bookmark), bounce to the app. Same pattern
  // used in LoginPage.
  if (token) {
    return <Navigate to="/expenses" replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords don't match.")
      return
    }

    setIsLoading(true)
    try {
      // We intentionally DON'T call setAuth here — even though the server
      // returns a token, we discard it and require the user to log in
      // manually with their new credentials. This forces them to confirm
      // their password while it's fresh in their head.
      //
      // We pass { justRegistered, email } via React Router state so the
      // login page can pre-fill the email and show a "Account created!"
      // banner. router state survives navigation but not external links.
      await registerUser({ name, email, password })
      // Pass name + email through router state — the login page uses both
      // to pre-fill the form and personalize the success banner.
      navigate('/login', { state: { justRegistered: true, email, name } })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-emerald-50 flex flex-col">

      {/* Back-to-home link */}
      <header className="px-6 pt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-green-700 transition-colors"
        >
          ← Back to home
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">

          <div className="flex flex-col items-center mb-7">
            <LogoMark size="md" withWordmark={false} />
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Create your account</h1>
            <p className="text-sm text-gray-500 mt-1">
              Start splitting expenses in seconds.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg shadow-emerald-100/50 border border-gray-100 p-7">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-shadow"
                />
              </div>

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
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-shadow"
                />
                <p className="text-xs text-gray-400 mt-1">At least 6 characters.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
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
                {isLoading ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-green-700 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
