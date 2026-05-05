import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useUsers } from '../hooks/useUsers'
import { useCreateExpense } from '../hooks/useExpenses'
import { useAuthStore } from '../store/useAuthStore'

export function AddExpensePage() {
  const navigate = useNavigate()
  const { data: users } = useUsers()
  const currentUserId = useAuthStore((s) => s.user?.id ?? null)
  const createExpense = useCreateExpense()

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [paidById, setPaidById] = useState(currentUserId ?? '')
  const [participantIds, setParticipantIds] = useState<string[]>(
    currentUserId ? [currentUserId] : [],
  )

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
    if (!paidById) return alert('Please select who paid.')
    if (participantIds.length === 0) return alert('Please select at least one participant.')

    await createExpense.mutateAsync({
      description: description.trim(),
      amount: Number(amount),
      paidById,
      participantIds,
    })

    navigate('/expenses')
  }

  return (
    <div className="max-w-lg">
      {/* Back link */}
      <Link to="/expenses" className="text-sm text-gray-500 hover:text-green-600 flex items-center gap-1 mb-6">
        ← Back to expenses
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add an expense</h1>

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

        {/* Paid by */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Paid by
          </label>
          <select
            value={paidById}
            onChange={(e) => setPaidById(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
          >
            <option value="">Select person…</option>
            {users?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        {/* Participants */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Split between
          </label>
          <div className="flex flex-col gap-2">
            {users?.map((u) => (
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
                <span className="text-sm font-medium text-gray-800">{u.name}</span>
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
          disabled={createExpense.isPending}
          className="bg-green-600 text-white font-semibold py-2.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
        >
          {createExpense.isPending ? 'Saving…' : 'Save expense'}
        </button>

        {createExpense.isError && (
          <p className="text-sm text-red-500 text-center">
            Something went wrong. Please try again.
          </p>
        )}
      </form>
    </div>
  )
}
