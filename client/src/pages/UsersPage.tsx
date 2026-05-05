import { useState } from 'react'
import { useUsers, useCreateUser } from '../hooks/useUsers'
import { useUserFriendships, useSendFriendRequest, useRespondToFriendRequest } from '../hooks/useFriendships'
import { useAuthStore } from '../store/useAuthStore'
import { UserAvatar } from '../components/UserAvatar'
import type { User, Friendship } from '../types'

// ── Friend request button logic ────────────────────────────────────────────

interface FriendButtonProps {
  targetUser: User
  currentUserId: string
  friendships: Friendship[]
}

function FriendButton({ targetUser, currentUserId, friendships }: FriendButtonProps) {
  const sendRequest = useSendFriendRequest()
  const respond = useRespondToFriendRequest()

  // Find any existing friendship between currentUser and targetUser
  const friendship = friendships.find(
    (f) =>
      (f.requesterId === currentUserId && f.addresseeId === targetUser.id) ||
      (f.requesterId === targetUser.id && f.addresseeId === currentUserId),
  )

  // Already accepted friends
  if (friendship?.status === 'accepted') {
    return (
      <span className="text-xs bg-green-100 text-green-700 font-medium px-2.5 py-1 rounded-full">
        ✓ Friends
      </span>
    )
  }

  // I sent a request, waiting for them to accept
  if (friendship?.status === 'pending' && friendship.requesterId === currentUserId) {
    return (
      <span className="text-xs bg-amber-50 text-amber-600 font-medium px-2.5 py-1 rounded-full border border-amber-200">
        Pending…
      </span>
    )
  }

  // They sent a request to me — show Accept / Decline
  if (friendship?.status === 'pending' && friendship.requesterId === targetUser.id) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => respond.mutate({ id: friendship.id, status: 'accepted' })}
          disabled={respond.isPending}
          className="text-xs bg-green-600 text-white font-medium px-2.5 py-1 rounded-full hover:bg-green-700 transition-colors disabled:opacity-60"
        >
          Accept
        </button>
        <button
          onClick={() => respond.mutate({ id: friendship.id, status: 'declined' })}
          disabled={respond.isPending}
          className="text-xs border border-gray-300 text-gray-500 font-medium px-2.5 py-1 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          Decline
        </button>
      </div>
    )
  }

  // No friendship yet — show Add friend
  return (
    <button
      onClick={() =>
        sendRequest.mutate({ requesterId: currentUserId, addresseeId: targetUser.id })
      }
      disabled={sendRequest.isPending}
      className="text-xs border border-green-500 text-green-700 font-medium px-2.5 py-1 rounded-full hover:bg-green-50 transition-colors disabled:opacity-60"
    >
      {sendRequest.isPending ? '…' : '+ Add friend'}
    </button>
  )
}

// ── User Card ──────────────────────────────────────────────────────────────

interface UserCardProps {
  user: User
  isCurrentUser: boolean
  currentUserId: string | null
  friendships: Friendship[]
}

function UserCard({ user, isCurrentUser, currentUserId, friendships }: UserCardProps) {
  return (
    <div
      className={`bg-white rounded-xl border p-4 transition-colors ${
        isCurrentUser ? 'border-green-400 ring-1 ring-green-200' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <UserAvatar name={user.name} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900">{user.name}</p>
            {isCurrentUser && (
              <span className="text-xs bg-green-100 text-green-700 font-medium px-1.5 py-0.5 rounded-full">
                You
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 truncate">{user.email}</p>
        </div>

        {/* Show friend button only if a current user is selected and it's not themselves */}
        {currentUserId && !isCurrentUser && (
          <FriendButton
            targetUser={user}
            currentUserId={currentUserId}
            friendships={friendships}
          />
        )}
      </div>
    </div>
  )
}

// ── Incoming Requests Banner ───────────────────────────────────────────────

function IncomingRequestsBanner({
  friendships,
  currentUserId,
}: {
  friendships: Friendship[]
  currentUserId: string
}) {
  const incoming = friendships.filter(
    (f) => f.status === 'pending' && f.addresseeId === currentUserId,
  )
  if (incoming.length === 0) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
      <p className="text-sm font-semibold text-amber-800 mb-1">
        {incoming.length === 1 ? '1 friend request' : `${incoming.length} friend requests`}
      </p>
      <p className="text-xs text-amber-600">
        Accept or decline below next to each person.
      </p>
    </div>
  )
}

// ── Users Page ─────────────────────────────────────────────────────────────

export function UsersPage() {
  const { data: users, isLoading, isError } = useUsers()
  const currentUserId = useAuthStore((s) => s.user?.id ?? null)
  const { data: friendships = [] } = useUserFriendships(currentUserId)
  const createUser = useCreateUser()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [showForm, setShowForm] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    await createUser.mutateAsync({ name: name.trim(), email: email.trim() })
    setName('')
    setEmail('')
    setShowForm(false)
  }

  if (isLoading) {
    return <div className="flex justify-center py-16 text-gray-400">Loading people…</div>
  }

  if (isError) {
    return (
      <div className="text-center py-16 text-red-500">
        Could not load users. Is the backend running?
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">People</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add person'}
        </button>
      </div>

      {/* Incoming friend requests banner */}
      {currentUserId && (
        <IncomingRequestsBanner friendships={friendships} currentUserId={currentUserId} />
      )}

      {/* Add user form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl border border-green-200 p-4 mb-5 flex flex-col gap-3"
        >
          <h2 className="font-semibold text-gray-800">New person</h2>
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <button
            type="submit"
            disabled={createUser.isPending}
            className="bg-green-600 text-white font-semibold py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
          >
            {createUser.isPending ? 'Creating…' : 'Create person'}
          </button>
          {createUser.isError && (
            <p className="text-sm text-red-500 text-center">
              Something went wrong. Email may already exist.
            </p>
          )}
        </form>
      )}

      {/* User list */}
      {users?.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">👤</p>
          <p className="font-medium">No people yet — add someone!</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {users?.map((user) => (
          <UserCard
            key={user.id}
            user={user}
            isCurrentUser={user.id === currentUserId}
            currentUserId={currentUserId}
            friendships={friendships}
          />
        ))}
      </div>
    </div>
  )
}
