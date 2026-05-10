import { useState } from 'react'
import { useUserFriendships, useSendFriendRequest, useRespondToFriendRequest } from '../hooks/useFriendships'
import { useAuthStore } from '../store/useAuthStore'
import { UserAvatar } from '../components/UserAvatar'
import type { Friendship, User } from '../types'

// ── Add-friend form ────────────────────────────────────────────────────────

function AddFriendForm() {
  const sendRequest = useSendFriendRequest()
  const [email, setEmail] = useState('')
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
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not send request',
      })
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm shadow-emerald-100/40 p-5 mb-6">
      <h2 className="font-semibold text-gray-900 mb-1">Add a friend</h2>
      <p className="text-sm text-gray-500 mb-3">
        Enter your friend's email address. They must be registered on Fairshare.
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
          disabled={sendRequest.isPending || !email.trim()}
          className="bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 shadow-sm shadow-green-200"
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

// ── Friend cards ───────────────────────────────────────────────────────────

function IncomingRequestCard({ friendship }: { friendship: Friendship }) {
  const respond = useRespondToFriendRequest()
  const other = friendship.requester

  return (
    // The amber accent makes incoming requests visually pop — they need action.
    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm shadow-amber-100/40 p-4 flex items-center gap-3">
      <UserAvatar name={other.name} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900">{other.name}</p>
        <p className="text-sm text-gray-500 truncate">{other.email}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => respond.mutate({ id: friendship.id, status: 'accepted' })}
          disabled={respond.isPending}
          className="text-xs bg-green-600 text-white font-semibold px-3.5 py-1.5 rounded-full hover:bg-green-700 transition-colors disabled:opacity-60 shadow-sm shadow-green-200"
        >
          Accept
        </button>
        <button
          onClick={() => respond.mutate({ id: friendship.id, status: 'declined' })}
          disabled={respond.isPending}
          className="text-xs border border-gray-300 text-gray-500 font-medium px-3.5 py-1.5 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          Decline
        </button>
      </div>
    </div>
  )
}

function FriendCard({ friend, badge }: { friend: User; badge?: 'pending' | null }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3 hover:shadow-md hover:shadow-emerald-100/50 transition-shadow">
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

// ── "No friends yet" empty-state SVG ───────────────────────────────────────

function PeopleIcon() {
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
      {/* Two stylized people side by side */}
      <circle cx="9" cy="9" r="3" />
      <path d="M3 20 c0-3.3 2.7-6 6-6 s6 2.7 6 6" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M14 17 c1-1.5 2-2.5 3-2.5 s3 1 3 4" />
    </svg>
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

  const incoming = friendships.filter(
    (f) => f.status === 'pending' && f.addresseeId === currentUserId,
  )
  const sent = friendships.filter(
    (f) => f.status === 'pending' && f.requesterId === currentUserId,
  )
  const accepted = friendships.filter((f) => f.status === 'accepted')

  function otherIn(f: Friendship): User {
    return f.requesterId === currentUserId ? f.addressee : f.requester
  }

  const totalRelationships = incoming.length + sent.length + accepted.length

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-6">Friends</h1>

      <AddFriendForm />

      {/* Empty state */}
      {totalRelationships === 0 && (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-500 mb-4">
            <PeopleIcon />
          </div>
          <p className="font-semibold text-gray-800">You haven't added any friends yet.</p>
          <p className="text-sm text-gray-500 mt-1">
            Add one above to start splitting expenses.
          </p>
        </div>
      )}

      {/* Incoming friend requests */}
      {incoming.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
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
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
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
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
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
