import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  useGroup,
  useAddGroupMember,
  useRemoveGroupMember,
} from '../hooks/useGroups'
import { useExpenses } from '../hooks/useExpenses'
import { useAuthStore } from '../store/useAuthStore'
import { UserAvatar } from '../components/UserAvatar'
import type { Expense } from '../types'

// ── Expense card (same shape as ExpensesPage uses, scoped to this group) ──

function ExpenseCard({ expense }: { expense: Expense }) {
  const date = new Date(expense.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <Link
      to={`/expenses/${expense.id}`}
      className="block bg-white rounded-2xl border border-gray-200 p-4 hover:border-green-300 hover:shadow-md hover:shadow-emerald-100/50 transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <UserAvatar name={expense.paidBy.name} />
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">{expense.description}</p>
            <p className="text-sm text-gray-500">
              Paid by{' '}
              <span className="font-medium text-gray-700">{expense.paidBy.name}</span>
              {' · '}
              {expense.participants.length} people
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-semibold text-gray-900">
            ${Number(expense.amount).toFixed(2)}
          </p>
          <p className="text-xs text-gray-400">{date}</p>
        </div>
      </div>
    </Link>
  )
}

// ── Add-member inline form ────────────────────────────────────────────────

function AddMemberForm({ groupId }: { groupId: string }) {
  const addMember = useAddGroupMember(groupId)
  const [email, setEmail] = useState('')
  const [feedback, setFeedback] = useState<
    | { type: 'success'; text: string }
    | { type: 'error'; text: string }
    | null
  >(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setFeedback(null)
    try {
      await addMember.mutateAsync(email.trim())
      setFeedback({ type: 'success', text: `Added ${email.trim()} to the group.` })
      setEmail('')
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not add member',
      })
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm shadow-emerald-100/40 p-5 mb-6">
      <h2 className="font-semibold text-gray-900 mb-1">Invite a friend</h2>
      <p className="text-sm text-gray-500 mb-3">
        Enter their email. They must already be your friend.
      </p>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-shadow"
        />
        <button
          type="submit"
          disabled={addMember.isPending || !email.trim()}
          className="bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 shadow-sm shadow-green-200"
        >
          {addMember.isPending ? 'Adding…' : 'Add'}
        </button>
      </form>

      {feedback && (
        <p
          className={`mt-3 text-sm rounded-lg py-2 px-3 ${
            feedback.type === 'success'
              ? 'text-green-700 bg-green-50 border border-green-100'
              : 'text-red-600 bg-red-50 border border-red-100'
          }`}
        >
          {feedback.text}
        </p>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentUserId = useAuthStore((s) => s.user?.id ?? null)

  const { data: group, isLoading, isError } = useGroup(id ?? '')
  // Reuse the global expenses query and filter to this group.
  // Sufficient for V1; if expense counts get large we'd add a server-side
  // /api/groups/:id/expenses endpoint.
  const { data: allExpenses = [] } = useExpenses()
  const leaveGroup = useRemoveGroupMember(id ?? '')

  if (isLoading) {
    return <div className="flex justify-center py-16 text-gray-400">Loading…</div>
  }

  if (isError || !group) {
    return (
      <div className="text-center py-16">
        <p className="text-red-500 mb-4">Group not found.</p>
        <Link to="/groups" className="text-green-600 hover:underline text-sm">
          ← Back to groups
        </Link>
      </div>
    )
  }

  const groupExpenses = allExpenses.filter((e) => e.groupId === group.id)

  async function handleLeave() {
    const confirmed = confirm(
      'Leave this group? Your past expenses will stay but you won\'t see new activity.',
    )
    if (!confirmed) return
    if (!currentUserId) return
    await leaveGroup.mutateAsync(currentUserId)
    navigate('/groups')
  }

  return (
    <div>
      {/* Top bar with back + leave */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/groups"
          className="text-sm text-gray-500 hover:text-green-600 flex items-center gap-1"
        >
          ← Back to groups
        </Link>
        <button
          onClick={handleLeave}
          disabled={leaveGroup.isPending}
          className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          {leaveGroup.isPending ? 'Leaving…' : 'Leave group'}
        </button>
      </div>

      {/* Group header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          {group.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {group.members.length}{' '}
          {group.members.length === 1 ? 'member' : 'members'} ·{' '}
          {groupExpenses.length}{' '}
          {groupExpenses.length === 1 ? 'expense' : 'expenses'}
        </p>
      </div>

      {/* Members */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Members
        </h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {group.members.map((m) => (
            <div
              key={m.userId}
              className="flex items-center gap-2 bg-white rounded-full border border-gray-200 pr-3 pl-1 py-1"
            >
              <UserAvatar name={m.user.name} size="sm" />
              <span className="text-sm font-medium text-gray-800">
                {m.user.name}
                {m.userId === currentUserId && (
                  <span className="ml-1.5 text-xs text-gray-400">(you)</span>
                )}
              </span>
            </div>
          ))}
        </div>
        <AddMemberForm groupId={group.id} />
      </section>

      {/* Expenses */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Expenses ({groupExpenses.length})
          </h2>
          <Link
            to={`/expenses/new?group=${group.id}`}
            className="text-sm font-semibold text-green-700 hover:text-green-800"
          >
            + Add expense
          </Link>
        </div>

        {groupExpenses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 text-center py-12">
            <p className="text-sm text-gray-500">
              No expenses in this group yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groupExpenses.map((e) => (
              <ExpenseCard key={e.id} expense={e} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
