import type {
  User,
  Expense,
  Friendship,
  Settlement,
  Balance,
  CreateExpenseInput,
  CreateSettlementInput,
} from '../types'
import { useAuthStore } from '../store/useAuthStore'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// ── Core request helper ────────────────────────────────────────────────────
//
// Every API call goes through here. Two things happen automatically:
//   1. Content-Type is set to JSON (so the server knows how to parse the body)
//   2. If a JWT token is saved in the auth store, it's attached as an
//      Authorization header — this is how the server knows who is calling.
//
// "Bearer" is just a naming convention for this kind of token. The word
// "bearer" means "whoever holds this token is allowed in."

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  // getState() reads the Zustand store without needing to be inside a React component
  const token = useAuthStore.getState().token

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      // Only add the Authorization header when we actually have a token
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── Auth ───────────────────────────────────────────────────────────────────

export const loginUser = (data: { email: string; password: string }) =>
  request<{ token: string; user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const registerUser = (data: { name: string; email: string; password: string }) =>
  request<{ token: string; user: User }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const getMe = () => request<User>('/api/auth/me')

// ── Users ──────────────────────────────────────────────────────────────────

export const getUsers = () => request<User[]>('/api/users')

export const getUser = (id: string) => request<User>(`/api/users/${id}`)

export const getUserFriends = (userId: string) =>
  request<User[]>(`/api/users/${userId}/friends`)

export const getUserFriendships = (userId: string) =>
  request<Friendship[]>(`/api/users/${userId}/friendships`)

// ── Expenses ───────────────────────────────────────────────────────────────

export const getExpenses = () => request<Expense[]>('/api/expenses')

export const getExpense = (id: string) =>
  request<Expense>(`/api/expenses/${id}`)

export const createExpense = (data: CreateExpenseInput) =>
  request<Expense>('/api/expenses', { method: 'POST', body: JSON.stringify(data) })

// ── Friendships ────────────────────────────────────────────────────────────

export const createFriendship = (requesterId: string, addresseeId: string) =>
  request<Friendship>('/api/friendships', {
    method: 'POST',
    body: JSON.stringify({ requesterId, addresseeId }),
  })

export const updateFriendship = (id: string, status: 'accepted' | 'declined') =>
  request<Friendship>(`/api/friendships/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })

// ── Balances ───────────────────────────────────────────────────────────────

export const getBalances = (userId: string) =>
  request<Balance[]>(`/api/balances/${userId}`)

// ── Settlements ────────────────────────────────────────────────────────────

export const createSettlement = (data: CreateSettlementInput) =>
  request<Settlement>('/api/settlements', {
    method: 'POST',
    body: JSON.stringify(data),
  })
