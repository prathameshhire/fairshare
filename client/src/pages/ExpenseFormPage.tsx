import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { useUserFriends } from '../hooks/useUsers'
import { useCreateExpense, useExpense, useUpdateExpense } from '../hooks/useExpenses'
import { useGroups } from '../hooks/useGroups'
import { useAuthStore } from '../store/useAuthStore'
import type { User } from '../types'

// One page, two modes:
//   /expenses/new            → create (Personal by default)
//   /expenses/new?group=<id> → create in that group (set by "Add expense"
//                              link from group detail page)
//   /expenses/:id/edit       → edit (prefilled, group locked)

export function ExpenseFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)

  const currentUser = useAuthStore((s) => s.user)
  const currentUserId = currentUser?.id ?? null

  const { data: friends = [] } = useUserFriends(currentUserId)
  const { data: groups = [] } = useGroups()

  // Edit mode: fetch the existing expense to prefill
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
  // null = Personal expense (no group). String = a specific group's id.
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => {
    const fromUrl = searchParams.get('group')
    return fromUrl || null
  })

  // Prefill when an existing expense loads (edit mode only)
  useEffect(() => {
    if (existingExpense) {
      setDescription(existingExpense.description)
      setAmount(String(existingExpense.amount))
      setParticipantIds(existingExpense.participants.map((p) => p.userId))
      setSelectedGroupId(existingExpense.groupId ?? null)
    }
  }, [existingExpense])

  // Auth guard: only the payer can edit
  useEffect(() => {
    if (isEdit && existingExpense && existingExpense.paidById !== currentUserId) {
      navigate(`/expenses/${id}`, { replace: true })
    }
  }, [isEdit, existingExpense, currentUserId, id, navigate])

  // Find the currently selected group (if any)
  const selectedGroup = selectedGroupId
    ? groups.find((g) => g.id === selectedGroupId)
    : null

  // The pool of people you can pick as participants depends on the "where":
  //   - Personal: yourself + your friends
  //   - Group:    the group's members
  let splitOptions: User[] = []
  if (selectedGroup) {
    splitOptions = selectedGroup.members.map((m) => m.user)
  } else {
    splitOptions = currentUser ? [currentUser, ...friends] : friends
  }

  // When the user switches between Personal/group, previously-selected
  // participants might not exist in the new pool. Reset to just "you" to
  // avoid a stale-and-invalid selection.
  function handleGroupChange(newGroupId: string | null) {
    setSelectedGroupId(newGroupId)
    setParticipantIds(currentUserId ? [currentUserId] : [])
  }

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

    // Build the payload. Only include groupId if one is selected — the
    // server reads its absence as "personal expense" (the dual-mode logic).
    const payload = {
      description: description.trim(),
      amount: Number(amount),
      participantIds,
      ...(selectedGroupId ? { groupId: selectedGroupId } : {}),
    }

    if (isEdit && id) {
      await updateExpense.mutateAsync({ id, data: payload })
      navigate(`/expenses/${id}`)
    } else {
      await createExpense.mutateAsync(payload)
      // After creating in a group, send the user back to that group's page
      // so they see the new expense in context. Otherwise default to list.
      navigate(selectedGroupId ? `/groups/${selectedGroupId}` : '/expenses')
    }
  }

  if (isEdit && loadingExpense) {
    return <div className="flex justify-center py-16 text-gray-400">Loading expense…</div>
  }

  const isSubmitting = createExpense.isPending || updateExpense.isPending
  const isError = createExpense.isError || updateExpense.isError

  return (
    <div className="max-w-lg">
      <Link
        to={isEdit ? `/expenses/${id}` : selectedGroupId ? `/groups/${selectedGroupId}` : '/expenses'}
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

        {/* "Where?" picker — Personal or one of your groups.
            In edit mode this is locked: the group of an existing expense
            can't be changed via edit. */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Where?
          </label>
          {isEdit ? (
            <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
              {selectedGroup ? `Group: ${selectedGroup.name}` : 'Personal'}
              <span className="ml-2 text-xs text-gray-400">(locked)</span>
            </div>
          ) : (
            <select
              value={selectedGroupId ?? ''}
              onChange={(e) => handleGroupChange(e.target.value || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="">Personal (split with friends)</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  Group: {g.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Paid by */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Paid by
          </label>
          <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
            You ({currentUser?.name})
          </div>
        </div>

        {/* Participants */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Split between
          </label>

          {/* Empty-state hints depending on which mode you're in */}
          {!selectedGroup && splitOptions.length === 1 && (
            <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-2">
              You don't have any friends yet —{' '}
              <Link to="/friends" className="text-green-600 hover:underline">
                add some
              </Link>{' '}
              to split with.
            </p>
          )}
          {selectedGroup && splitOptions.length === 1 && (
            <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-2">
              You're the only member of this group —{' '}
              <Link to={`/groups/${selectedGroup.id}`} className="text-green-600 hover:underline">
                invite friends
              </Link>{' '}
              first.
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

          {perPerson && (
            <p className="mt-2 text-sm text-green-700 font-medium">
              ${perPerson} each ({participantIds.length} people)
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-green-600 text-white font-semibold py-2.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 shadow-sm shadow-green-200"
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
