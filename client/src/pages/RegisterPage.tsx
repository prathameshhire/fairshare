import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser } from '../lib/api'
import { useAuthStore } from '../store/useAuthStore'

export function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Confirm password — has to match `password` before we hit the server.
  // This prevents a typo'd password silently locking the user out of an account
  // they never knew they made.
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    // Client-side validation — fail fast before bothering the server
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
      // Call POST /api/auth/register — server creates the account and returns { token, user }
      const { token, user } = await registerUser({ name, email, password })
      setAuth(token, user)
      navigate('/expenses')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <h1 className="text-center text-3xl font-bold text-green-600 mb-2">Fairshare</h1>
        <p className="text-center text-sm text-gray-500 mb-8">Create your account</p>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

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
              {isLoading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-green-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
