import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useUserFriends } from '../hooks/useUsers'
import { useCreateExpense, useExpense, useUpdateExpense } from '../hooks/useExpenses'
import { useAuthStore } from '../store/useAuthStore'

// One page, two modes:
//   /expenses/new       → create mode (no `:id` param)
//   /expenses/:id/edit  → edit mode (fetches existing expense, prefills form)
//
// We pick which mutation to fire (create vs update) based on whether we have an id.

export function ExpenseFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const currentUser = useAuthStore((s) => s.user)
  const currentUserId = currentUser?.id ?? null
  const { data: friends = [] } = useUserFriends(currentUserId)
  const splitOptions = currentUser ? [currentUser, ...friends] : friends

  // Edit mode: fetch the existing expense so we can prefill
  const { data: existingExpense, isLoading: loadingExpense } = useExpense(
    isEdit ? id! : '',
  )

  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [participantIds, setParticipantIds] = useState<string[]>(
    currentUserId ? [currentUserId] : [],
  )

  // Prefill the form once the existing expense loads (edit mode only).
  // Without this useEffect, the inputs would be empty even when the data arrives.
  useEffect(() => {
    if (existingExpense) {
      setDescription(existingExpense.description)
      setAmount(String(existingExpense.amount))
      setParticipantIds(existingExpense.participants.map((p) => p.userId))
    }
  }, [existingExpense])

  // Edit-mode authorization check (client-side mirror of the server-side guard):
  // if we're trying to edit an expense we didn't pay for, redirect away.
  // The server will reject anyway, but this avoids showing a form they can't submit.
  useEffect(() => {
    if (isEdit && existingExpense && existingExpense.paidById !== currentUserId) {
      navigate(`/expenses/${id}`, { replace: true })
    }
  }, [isEdit, existingExpense, currentUserId, id, navigate])

  function toggleParticipant(userId: string) {
    setParticipantIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  const perPerson =
    participantIds.length > 0 && Number(amount) > 0
      ? (Number(amount) / participantIds.length).toFixed(2)
      : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!description.trim()) return alert('Please enter a description.')
    if (!amount || Number(amount) <= 0) return alert('Please enter a valid amount.')
    if (participantIds.length === 0) return alert('Please select at least one participant.')

    const payload = {
      description: description.trim(),
      amount: Number(amount),
      participantIds,
    }

    if (isEdit && id) {
      await updateExpense.mutateAsync({ id, data: payload })
      navigate(`/expenses/${id}`)
    } else {
      await createExpense.mutateAsync(payload)
      navigate('/expenses')
    }
  }

  // Edit mode loading state — show a placeholder until the expense data arrives
  if (isEdit && loadingExpense) {
    return <div className="flex justify-center py-16 text-gray-400">Loading expense…</div>
  }

  // Combined "is something happening" flag — disables the submit button during requests
  const isSubmitting = createExpense.isPending || updateExpense.isPending
  const isError = createExpense.isError || updateExpense.isError

  return (
    <div className="max-w-lg">
      {/* Back link — goes to detail in edit mode, list in create mode */}
      <Link
        to={isEdit ? `/expenses/${id}` : '/expenses'}
        className="text-sm text-gray-500 hover:text-green-600 flex items-center gap-1 mb-6"
      >
        ← Back
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isEdit ? 'Edit expense' : 'Add an expense'}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <input
            type="text"
            placeholder="e.g. Dinner at Olive Garden"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Total amount ($)
          </label>
          <input
            type="number"
            placeholder="0.00"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        {/* Paid by — locked to the logged-in user (per V1: only the payer can log) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Paid by
          </label>
          <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
            You ({currentUser?.name})
          </div>
        </div>

        {/* Participants — yourself + your friends only */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Split between
          </label>

          {splitOptions.length === 1 && (
            <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-2">
              You don't have any friends yet — <Link to="/friends" className="text-green-600 hover:underline">add some</Link> to split expenses with them.
            </p>
          )}

          <div className="flex flex-col gap-2">
            {splitOptions.map((u) => (
              <label
                key={u.id}
                className={`flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                  participantIds.includes(u.id)
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={participantIds.includes(u.id)}
                  onChange={() => toggleParticipant(u.id)}
                  className="accent-green-600"
                />
                <span className="text-sm font-medium text-gray-800">
                  {u.name}
                  {u.id === currentUserId && (
                    <span className="ml-2 text-xs text-gray-400">(you)</span>
                  )}
                </span>
              </label>
            ))}
          </div>

          {/* Per-person preview */}
          {perPerson && (
            <p className="mt-2 text-sm text-green-700 font-medium">
              ${perPerson} each ({participantIds.length} people)
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-green-600 text-white font-semibold py-2.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
        >
          {isSubmitting
            ? 'Saving…'
            : isEdit
              ? 'Save changes'
              : 'Save expense'}
        </button>

        {isError && (
          <p className="text-sm text-red-500 text-center">
            Something went wrong. Please try again.
          </p>
        )}
      </form>
    </div>
  )
}
