import { useState } from 'react'
import { useUserFriendships, useSendFriendRequest, useRespondToFriendRequest } from '../hooks/useFriendships'
import { useAuthStore } from '../store/useAuthStore'
import { UserAvatar } from '../components/UserAvatar'
import type { Friendship, User } from '../types'

// ── Add-friend form ────────────────────────────────────────────────────────

function AddFriendForm() {
  const sendRequest = useSendFriendRequest()
  const [email, setEmail] = useState('')
  // We track success and error separately so the user gets a clear, dismissible
  // confirmation when a request goes through, and a clear error otherwise.
  const [feedback, setFeedback] = useState<
    | { type: 'success'; text: string }
    | { type: 'error'; text: string }
    | null
  >(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFeedback(null)
    if (!email.trim()) return
    try {
      await sendRequest.mutateAsync(email.trim())
      setFeedback({ type: 'success', text: `Friend request sent to ${email.trim()}.` })
      setEmail('')
    } catch (err) {
      // The server's error message ("No user is registered with that email", etc.)
      // gets surfaced directly to the user — no translation needed.
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not send request',
      })
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <h2 className="font-semibold text-gray-800 mb-1">Add a friend</h2>
      <p className="text-sm text-gray-500 mb-3">
        Enter your friend's email address. They must be registered on Fairshare.
      </p>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <button
          type="submit"
          disabled={sendRequest.isPending || !email.trim()}
          className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
        >
          {sendRequest.isPending ? 'Sending…' : 'Send request'}
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

// ── Friend cards (one component per status, for clarity) ───────────────────

function IncomingRequestCard({ friendship }: { friendship: Friendship }) {
  const respond = useRespondToFriendRequest()
  // For an incoming request, the OTHER person is the requester
  const other = friendship.requester

  return (
    <div className="bg-white rounded-xl border border-amber-200 p-4 flex items-center gap-3">
      <UserAvatar name={other.name} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900">{other.name}</p>
        <p className="text-sm text-gray-500 truncate">{other.email}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => respond.mutate({ id: friendship.id, status: 'accepted' })}
          disabled={respond.isPending}
          className="text-xs bg-green-600 text-white font-medium px-3 py-1.5 rounded-full hover:bg-green-700 transition-colors disabled:opacity-60"
        >
          Accept
        </button>
        <button
          onClick={() => respond.mutate({ id: friendship.id, status: 'declined' })}
          disabled={respond.isPending}
          className="text-xs border border-gray-300 text-gray-500 font-medium px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          Decline
        </button>
      </div>
    </div>
  )
}

function FriendCard({ friend, badge }: { friend: User; badge?: 'pending' | null }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <UserAvatar name={friend.name} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900">{friend.name}</p>
        <p className="text-sm text-gray-500 truncate">{friend.email}</p>
      </div>
      {badge === 'pending' && (
        <span className="text-xs bg-amber-50 text-amber-600 font-medium px-2.5 py-1 rounded-full border border-amber-200">
          Pending…
        </span>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export function FriendsPage() {
  const currentUserId = useAuthStore((s) => s.user?.id ?? null)
  const { data: friendships = [], isLoading, isError } = useUserFriendships(currentUserId)

  if (isLoading) {
    return <div className="flex justify-center py-16 text-gray-400">Loading friends…</div>
  }
  if (isError) {
    return (
      <div className="text-center py-16 text-red-500">
        Could not load friends. Is the backend running?
      </div>
    )
  }

  // Bucket the friendships by status + direction.
  // Incoming = pending requests where I'm the addressee (action needed)
  // Sent = pending requests where I'm the requester (waiting on them)
  // Accepted = real friends
  const incoming = friendships.filter(
    (f) => f.status === 'pending' && f.addresseeId === currentUserId,
  )
  const sent = friendships.filter(
    (f) => f.status === 'pending' && f.requesterId === currentUserId,
  )
  const accepted = friendships.filter((f) => f.status === 'accepted')

  // Helper: get the "other" person in a friendship (i.e. not me)
  function otherIn(f: Friendship): User {
    return f.requesterId === currentUserId ? f.addressee : f.requester
  }

  const totalRelationships = incoming.length + sent.length + accepted.length

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Friends</h1>

      <AddFriendForm />

      {/* Empty state — only if there's literally nothing to show */}
      {totalRelationships === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">👥</p>
          <p className="font-medium">You haven't added any friends yet.</p>
          <p className="text-sm mt-1">Add one above to start splitting expenses.</p>
        </div>
      )}

      {/* Incoming friend requests — top of list because they need action */}
      {incoming.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Friend requests ({incoming.length})
          </h2>
          <div className="flex flex-col gap-3">
            {incoming.map((f) => (
              <IncomingRequestCard key={f.id} friendship={f} />
            ))}
          </div>
        </section>
      )}

      {/* Accepted friends */}
      {accepted.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Friends ({accepted.length})
          </h2>
          <div className="flex flex-col gap-3">
            {accepted.map((f) => (
              <FriendCard key={f.id} friend={otherIn(f)} />
            ))}
          </div>
        </section>
      )}

      {/* Outgoing pending requests */}
      {sent.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Sent ({sent.length})
          </h2>
          <div className="flex flex-col gap-3">
            {sent.map((f) => (
              <FriendCard key={f.id} friend={otherIn(f)} badge="pending" />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
