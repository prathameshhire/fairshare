import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useGroups, useCreateGroup } from '../hooks/useGroups'
import type { Group } from '../types'

// ── Create-group modal ─────────────────────────────────────────────────────

function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const createGroup = useCreateGroup()
  const [name, setName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setErrorMessage(null)
    try {
      await createGroup.mutateAsync(name.trim())
      onClose()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not create group')
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl shadow-emerald-200/40 w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-bold text-gray-900 text-lg mb-1">Create a group</h2>
        <p className="text-sm text-gray-500 mb-5">
          Group your expenses around a trip, household, or any shared context.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Group name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="e.g. Barcelona trip"
              className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-shadow"
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-red-600 text-center bg-red-50 border border-red-100 rounded-lg py-2 px-3">
              {errorMessage}
            </p>
          )}

          <div className="flex gap-3 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createGroup.isPending || !name.trim()}
              className="flex-1 bg-green-600 text-white font-semibold py-2.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 text-sm shadow-sm shadow-green-200"
            >
              {createGroup.isPending ? 'Creating…' : 'Create group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Group card on the list ─────────────────────────────────────────────────

function GroupCard({ group }: { group: Group }) {
  return (
    <Link
      to={`/groups/${group.id}`}
      className="block bg-white rounded-2xl border border-gray-200 p-4 hover:border-green-300 hover:shadow-md hover:shadow-emerald-100/50 transition-all"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{group.name}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {group.members.length}{' '}
            {group.members.length === 1 ? 'member' : 'members'}
          </p>
        </div>
        <span className="text-sm text-gray-300">→</span>
      </div>
    </Link>
  )
}

// ── Empty-state icon ───────────────────────────────────────────────────────

function GroupsIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Two overlapping rounded squares — same brand mark, line version */}
      <rect x="3" y="7" width="11" height="11" rx="3" />
      <rect x="10" y="6" width="11" height="11" rx="3" />
    </svg>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export function GroupsPage() {
  const { data: groups, isLoading, isError } = useGroups()
  const [showCreateModal, setShowCreateModal] = useState(false)

  if (isLoading) {
    return (
      <div className="flex justify-center py-16 text-gray-400">Loading groups…</div>
    )
  }

  if (isError) {
    return (
      <div className="text-center py-16 text-red-500">
        Could not load groups. Is the backend running?
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Groups</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm shadow-green-200"
        >
          + New group
        </button>
      </div>

      {/* Empty state */}
      {groups?.length === 0 && (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-500 mb-4">
            <GroupsIcon />
          </div>
          <p className="font-semibold text-gray-800">No groups yet</p>
          <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
            Create a group for a trip, household, or any shared context.
            Or skip groups entirely — you can still split with friends directly.
          </p>
        </div>
      )}

      {/* List */}
      <div className="flex flex-col gap-3">
        {groups?.map((g) => (
          <GroupCard key={g.id} group={g} />
        ))}
      </div>

      {showCreateModal && (
        <CreateGroupModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  )
}
