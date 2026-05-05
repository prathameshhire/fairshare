import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginUser } from '../lib/api'
import { useAuthStore } from '../store/useAuthStore'

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  // Form field state — one piece of state per input
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Loading and error state for the submit button
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    // Prevent the browser's default "refresh the page" behavior on form submit
    e.preventDefault()
    setErrorMessage(null)
    setIsLoading(true)

    try {
      // Call POST /api/auth/login — the server returns { token, user }
      const { token, user } = await loginUser({ email, password })
      // Save both to the auth store (which also persists them to localStorage)
      setAuth(token, user)
      // Redirect to the main app
      navigate('/expenses')
    } catch (err) {
      // err is typed as `unknown` in TypeScript — we cast it to Error to read .message
      setErrorMessage(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    // Full-screen centered layout
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* App name */}
        <h1 className="text-center text-3xl font-bold text-green-600 mb-2">Fairshare</h1>
        <p className="text-center text-sm text-gray-500 mb-8">Sign in to your account</p>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

            {/* Error banner — only shown when errorMessage is set */}
            {errorMessage && (
              <p className="text-sm text-red-500 text-center bg-red-50 border border-red-100 rounded-lg py-2 px-3">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="bg-green-600 text-white font-semibold py-2.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Link to register */}
        <p className="text-center text-sm text-gray-500 mt-5">
          Don't have an account?{' '}
          <Link to="/register" className="text-green-600 font-medium hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
