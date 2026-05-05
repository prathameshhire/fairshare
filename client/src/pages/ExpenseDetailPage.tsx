import { useParams, Link } from 'react-router-dom'
import { useExpense } from '../hooks/useExpenses'
import { UserAvatar } from '../components/UserAvatar'

export function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: expense, isLoading, isError } = useExpense(id ?? '')

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

  const totalSettled = expense.participants.filter((p) => p.isSettled).length
  const allSettled = totalSettled === expense.participants.length

  return (
    <div className="max-w-lg">
      {/* Back link */}
      <Link to="/expenses" className="text-sm text-gray-500 hover:text-green-600 flex items-center gap-1 mb-6">
        ← Back to expenses
      </Link>

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
          <span className="text-xs text-gray-400">
            {totalSettled}/{expense.participants.length} settled
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {expense.participants.map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              <UserAvatar name={p.user.name} size="sm" />
              <span className={`flex-1 text-sm font-medium ${p.isSettled ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                {p.user.name}
              </span>
              <span className={`text-sm font-semibold ${p.isSettled ? 'text-gray-400' : 'text-gray-900'}`}>
                ${Number(p.amountOwed).toFixed(2)}
              </span>
              {p.isSettled ? (
                <span className="text-xs text-emerald-500 font-medium">Settled</span>
              ) : (
                <span className="text-xs text-amber-500 font-medium">Owes</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
