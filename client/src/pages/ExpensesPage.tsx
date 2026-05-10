import { Link } from 'react-router-dom'
import { useExpenses } from '../hooks/useExpenses'
import { UserAvatar } from '../components/UserAvatar'
import type { Expense } from '../types'

function ExpenseCard({ expense }: { expense: Expense }) {
  const date = new Date(expense.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <Link
      to={`/expenses/${expense.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-green-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: description + who paid */}
        <div className="flex items-center gap-3 min-w-0">
          <UserAvatar name={expense.paidBy.name} />
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">{expense.description}</p>
            <p className="text-sm text-gray-500">
              Paid by <span className="font-medium text-gray-700">{expense.paidBy.name}</span>
              {' · '}
              {expense.participants.length} people
            </p>
          </div>
        </div>

        {/* Right: amount + date */}
        <div className="text-right shrink-0">
          <p className="font-semibold text-gray-900">
            ${Number(expense.amount).toFixed(2)}
          </p>
          <p className="text-xs text-gray-400">{date}</p>
        </div>
      </div>

      {/* Participant chips — green for the payer, orange for everyone else */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {expense.participants.map((p) => {
          const isPayer = p.userId === expense.paidById
          return (
            <span
              key={p.id}
              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                isPayer
                  ? 'bg-green-50 text-green-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {p.user.name}
              <span className="opacity-75">${Number(p.amountOwed).toFixed(2)}</span>
            </span>
          )
        })}
      </div>
    </Link>
  )
}

export function ExpensesPage() {
  const { data: expenses, isLoading, isError } = useExpenses()

  if (isLoading) {
    return (
      <div className="flex justify-center py-16 text-gray-400">Loading expenses…</div>
    )
  }

  if (isError) {
    return (
      <div className="text-center py-16 text-red-500">
        Could not load expenses. Is the backend running?
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
        <Link
          to="/expenses/new"
          className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          + Add expense
        </Link>
      </div>

      {/* Empty state */}
      {expenses?.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">💸</p>
          <p className="font-medium">No expenses yet</p>
          <p className="text-sm mt-1">Add one to get started!</p>
        </div>
      )}

      {/* Expense list */}
      <div className="flex flex-col gap-3">
        {expenses?.map((expense) => (
          <ExpenseCard key={expense.id} expense={expense} />
        ))}
      </div>
    </div>
  )
}
