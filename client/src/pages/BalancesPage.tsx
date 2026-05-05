import { useState } from 'react'
import { useBalances } from '../hooks/useBalances'
import { useCreateSettlement } from '../hooks/useSettlements'
import { useAuthStore } from '../store/useAuthStore'
import { UserAvatar } from '../components/UserAvatar'
import type { Balance } from '../types'

// ── Settle-Up Modal ────────────────────────────────────────────────────────

interface SettleUpModalProps {
  balance: Balance
  currentUserId: string
  onClose: () => void
}

function SettleUpModal({ balance, currentUserId, onClose }: SettleUpModalProps) {
  const createSettlement = useCreateSettlement()
  const iOweThem = balance.amount < 0

  // Pre-fill with the absolute balance amount, but let the user edit it
  const [amount, setAmount] = useState(Math.abs(balance.amount).toFixed(2))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) return

    await createSettlement.mutateAsync({
      // If I owe them: I am the payer, they are the payee
      // If they owe me: they are the payer, I am the payee
      payerId: iOweThem ? currentUserId : balance.user.id,
      payeeId: iOweThem ? balance.user.id : currentUserId,
      amount: numericAmount,
    })

    onClose()
  }

  return (
    // Dark backdrop — clicking outside closes the modal
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      {/* Modal card — stop click from bubbling up to the backdrop */}
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          <UserAvatar name={balance.user.name} size="lg" />
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Settle up</h2>
            <p className="text-sm text-gray-500">
              {iOweThem
                ? `You → ${balance.user.name}`
                : `${balance.user.name} → You`}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount ($)
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createSettlement.isPending}
              className="flex-1 bg-green-600 text-white font-semibold py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 text-sm"
            >
              {createSettlement.isPending ? 'Recording…' : 'Record payment'}
            </button>
          </div>

          {createSettlement.isError && (
            <p className="text-sm text-red-500 text-center">
              Something went wrong. Please try again.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}

// ── Balance Row ────────────────────────────────────────────────────────────

interface BalanceRowProps {
  balance: Balance
  currentUserId: string
}

function BalanceRow({ balance, currentUserId }: BalanceRowProps) {
  const [showModal, setShowModal] = useState(false)
  const iOweThem = balance.amount < 0
  const absAmount = Math.abs(balance.amount)

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
        <UserAvatar name={balance.user.name} />

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{balance.user.name}</p>
          <p className={`text-sm font-medium ${iOweThem ? 'text-red-500' : 'text-green-600'}`}>
            {iOweThem
              ? `You owe $${absAmount.toFixed(2)}`
              : `Owes you $${absAmount.toFixed(2)}`}
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="shrink-0 text-sm font-medium border border-green-500 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
        >
          Settle up
        </button>
      </div>

      {showModal && (
        <SettleUpModal
          balance={balance}
          currentUserId={currentUserId}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}

// ── Balances Page ──────────────────────────────────────────────────────────

export function BalancesPage() {
  const currentUserId = useAuthStore((s) => s.user?.id ?? null)
  const { data: balances, isLoading, isError } = useBalances(currentUserId)

  if (!currentUserId) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">👤</p>
        <p className="font-medium">Unable to load your balances. Try logging in again.</p>
      </div>
    )
  }

  if (isLoading) {
    return <div className="flex justify-center py-16 text-gray-400">Calculating balances…</div>
  }

  if (isError) {
    return (
      <div className="text-center py-16 text-red-500">
        Could not load balances. Is the backend running?
      </div>
    )
  }

  const owing = balances?.filter((b) => b.amount < 0) ?? []
  const owed = balances?.filter((b) => b.amount > 0) ?? []
  const totalOwing = owing.reduce((sum, b) => sum + Math.abs(b.amount), 0)
  const totalOwed = owed.reduce((sum, b) => sum + b.amount, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Balances</h1>

      {/* Summary cards */}
      {balances && balances.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
            <p className="text-xs text-red-400 uppercase tracking-wide font-medium mb-1">You owe</p>
            <p className="text-2xl font-bold text-red-600">${totalOwing.toFixed(2)}</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
            <p className="text-xs text-green-500 uppercase tracking-wide font-medium mb-1">You're owed</p>
            <p className="text-2xl font-bold text-green-600">${totalOwed.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* All settled up */}
      {balances?.length === 0 && (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🎉</p>
          <p className="font-semibold text-gray-800 text-lg">You're all settled up!</p>
          <p className="text-sm text-gray-400 mt-1">No outstanding balances.</p>
        </div>
      )}

      {/* People you owe */}
      {owing.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            You owe
          </h2>
          <div className="flex flex-col gap-3">
            {owing.map((b) => (
              <BalanceRow key={b.user.id} balance={b} currentUserId={currentUserId} />
            ))}
          </div>
        </section>
      )}

      {/* People who owe you */}
      {owed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Owed to you
          </h2>
          <div className="flex flex-col gap-3">
            {owed.map((b) => (
              <BalanceRow key={b.user.id} balance={b} currentUserId={currentUserId} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
