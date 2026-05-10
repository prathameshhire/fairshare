import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useExpense, useDeleteExpense } from '../hooks/useExpenses'
import { useAuthStore } from '../store/useAuthStore'
import { UserAvatar } from '../components/UserAvatar'

// ── Delete confirmation modal ──────────────────────────────────────────────

function DeleteConfirmModal({
  expenseDescription,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  expenseDescription: string
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-bold text-gray-900 text-lg mb-2">Delete this expense?</h2>
        <p className="text-sm text-gray-600 mb-5">
          "<span className="font-medium">{expenseDescription}</span>" will be permanently removed.
          Anyone who owed money for it will no longer see it in their balances.
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 bg-red-600 text-white font-semibold py-2 rounded-lg hover:bg-red-700 transition-colors text-sm disabled:opacity-60"
          >
            {isDeleting ? 'Deleting…' : 'Yes, delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export function ExpenseDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { data: expense, isLoading, isError } = useExpense(id ?? '')
  const currentUserId = useAuthStore((s) => s.user?.id ?? null)
  const deleteExpense = useDeleteExpense()

  const [showDeleteModal, setShowDeleteModal] = useState(false)

  if (isLoading) {
    return <div className="flex justify-center py-16 text-gray-400">Loading…</div>
  }

  if (isError || !expense) {
    return (
      <div className="text-center py-16">
        <p className="text-red-500 mb-4">Expense not found.</p>
        <Link to="/expenses" className="text-green-600 hover:underline text-sm">
          ← Back to expenses
        </Link>
      </div>
    )
  }

  const date = new Date(expense.createdAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Edit/Delete are only shown to the payer — non-payers see a read-only view.
  // The server enforces this too, but hiding the buttons avoids a confusing UX
  // where someone clicks a button only to get a 403 error.
  const isPayer = currentUserId === expense.paidById

  const nonPayerParticipants = expense.participants.filter(
    (p) => p.userId !== expense.paidById,
  )

  const settledCount = nonPayerParticipants.filter(
    (p) => p.isEffectivelySettled === true,
  ).length
  const allSettled =
    nonPayerParticipants.length > 0 && settledCount === nonPayerParticipants.length

  async function handleDelete() {
    try {
      await deleteExpense.mutateAsync(id!)
      navigate('/expenses')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete expense')
      setShowDeleteModal(false)
    }
  }

  return (
    <div className="max-w-lg">
      {/* Top bar — back link on left, edit/delete on right (payer only) */}
      <div className="flex items-center justify-between mb-6">
        <Link to="/expenses" className="text-sm text-gray-500 hover:text-green-600 flex items-center gap-1">
          ← Back to expenses
        </Link>

        {isPayer && (
          <div className="flex gap-2">
            <Link
              to={`/expenses/${expense.id}/edit`}
              className="text-sm border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Edit
            </Link>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="text-sm border border-red-300 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-start gap-4">
          <UserAvatar name={expense.paidBy.name} size="lg" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{expense.description}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{date}</p>
            <p className="text-sm text-gray-600 mt-1">
              Paid by <span className="font-semibold text-gray-800">{expense.paidBy.name}</span>
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-bold text-gray-900">
              ${Number(expense.amount).toFixed(2)}
            </p>
            <p className="text-xs text-gray-400 uppercase tracking-wide">{expense.currency}</p>
          </div>
        </div>

        {allSettled && (
          <div className="mt-4 text-center text-sm text-emerald-600 font-medium bg-emerald-50 rounded-lg py-2">
            ✓ Fully settled
          </div>
        )}
      </div>

      {/* Split breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Split ({expense.splitType})</h2>
          {nonPayerParticipants.length > 0 && (
            <span className="text-xs text-gray-400">
              {settledCount}/{nonPayerParticipants.length} settled
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {expense.participants.map((p) => {
            const isPayerRow = p.userId === expense.paidById

            if (isPayerRow) {
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <UserAvatar name={p.user.name} size="sm" />
                  <span className="flex-1 text-sm font-medium text-gray-800">
                    {p.user.name}
                    <span className="ml-2 text-xs text-gray-400">(payer)</span>
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    Paid ${Number(expense.amount).toFixed(2)}
                  </span>
                </div>
              )
            }

            const settled = p.isEffectivelySettled === true
            return (
              <div key={p.id} className="flex items-center gap-3">
                <UserAvatar name={p.user.name} size="sm" />
                <span
                  className={`flex-1 text-sm font-medium ${
                    settled ? 'text-gray-400 line-through' : 'text-gray-800'
                  }`}
                >
                  {p.user.name}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    settled ? 'text-gray-400' : 'text-gray-900'
                  }`}
                >
                  ${Number(p.amountOwed).toFixed(2)}
                </span>
                {settled ? (
                  <span className="text-xs text-emerald-500 font-medium">Settled</span>
                ) : (
                  <span className="text-xs text-amber-500 font-medium">Owes</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          expenseDescription={expense.description}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          isDeleting={deleteExpense.isPending}
        />
      )}
    </div>
  )
}
