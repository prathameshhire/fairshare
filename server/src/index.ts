import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from './lib/prisma'
import { computeBalancesFor } from './lib/balances'

const app = express()
const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET!

// ── Middleware ─────────────────────────────────────────────────────────────

// CORS — which frontend origins are allowed to call this API from a browser.
//
// We allow:
//   - Any localhost port (for local dev — Vite, alt ports, etc.)
//   - Whatever's in CORS_ALLOWED_ORIGIN env var (set in Railway to your
//     Vercel URL once deployed, e.g. "https://fairshare.vercel.app")
//
// `origin` is a function so we can decide per-request. Returning callback(null, true)
// = allow; callback(null, false) = block.
const allowedOrigins = [
  process.env.CORS_ALLOWED_ORIGIN, // production Vercel URL (set later)
].filter(Boolean) as string[]

app.use(
  cors({
    origin(origin, callback) {
      // No origin (mobile apps, curl, server-to-server) — allow.
      if (!origin) return callback(null, true)
      // Any localhost — allow (dev ergonomics).
      if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true)
      // Production allowlist match — allow.
      if (allowedOrigins.includes(origin)) return callback(null, true)
      // Otherwise — block.
      return callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
  }),
)
app.use(express.json())

// Extend the Express Request type so we can attach the decoded user to it
declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

// requireAuth — verifies the JWT in the Authorization header.
// Attach this to any route that needs a logged-in user.
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' })
    return
  }
  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string }
    req.userId = payload.userId
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ── Auth helpers ───────────────────────────────────────────────────────────

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}

// ── Public routes (no token required) ─────────────────────────────────────

// Health check — confirms the server is running
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Fairshare API is running' })
})

// Register a new account
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body
  if (!name || !email || !password) {
    res.status(400).json({ error: 'name, email and password are required' })
    return
  }

  // Normalize email so users can't accidentally create duplicate-looking accounts
  // (e.g. "Test@Example.com" and "test@example.com" should be the same person)
  const normalizedEmail = email.trim().toLowerCase()

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    res.status(409).json({ error: 'An account with that email already exists' })
    return
  }

  // bcrypt hashes the password with 10 "rounds" of processing.
  // More rounds = harder to brute-force, but slower. 10 is the industry standard.
  const passwordHash = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: { name: name.trim(), email: normalizedEmail, passwordHash },
  })

  const token = signToken(user.id)
  res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
  })
})

// Log in to an existing account
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' })
    return
  }

  // Match the same normalization we use at registration so login is case-insensitive
  const normalizedEmail = email.trim().toLowerCase()
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  // bcrypt.compare hashes the incoming password and checks it against the stored hash
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  const token = signToken(user.id)
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
  })
})

// Return the currently logged-in user (token required)
app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } })
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  res.json({ id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl })
})

// ── Protected routes (token required) ─────────────────────────────────────

// Get all users
app.get('/api/users', requireAuth, async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
  })
  res.json(users)
})

// Get a single user by ID
app.get('/api/users/:id', requireAuth, async (req, res) => {
  const id = req.params.id as string
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
  })
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  res.json(user)
})

// Get all expenses the current user is involved in (as payer OR participant)
app.get('/api/expenses', requireAuth, async (req, res) => {
  const expenses = await prisma.expense.findMany({
    where: {
      OR: [
        // I paid for this expense
        { paidById: req.userId! },
        // I'm one of the participants who owes a share
        // `some` = at least one row in the related `participants` table matches
        { participants: { some: { userId: req.userId! } } },
      ],
    },
    include: {
      paidBy: true,
      participants: {
        include: { user: true },
      },
    },
  })
  res.json(expenses)
})

// Get one expense by ID — only if the current user is involved in it.
// We use findFirst (not findUnique) because we need a compound condition
// (id + access check). If the user isn't involved, we return 404 — NOT 403 —
// so we don't leak the existence of expenses they shouldn't know about.
app.get('/api/expenses/:id', requireAuth, async (req, res) => {
  const id = req.params.id as string
  const expense = await prisma.expense.findFirst({
    where: {
      id,
      OR: [
        { paidById: req.userId! },
        { participants: { some: { userId: req.userId! } } },
      ],
    },
    include: {
      paidBy: true,
      participants: {
        include: { user: true },
      },
    },
  })
  if (!expense) {
    res.status(404).json({ error: 'Expense not found' })
    return
  }

  // Annotate each participant with whether they're "effectively settled" with
  // the payer. The rule: if the participant's overall balance with the payer
  // (across ALL their shared expenses + settlements) is ≤ 0, they're settled.
  //
  // Why this approach: in real Splitwise, settlements are between two people
  // overall — they don't pay back specific expenses. So per-expense "settled"
  // is derived from the relationship-level balance, not stored as a flag.
  //
  // The payer themselves gets `isEffectivelySettled: null` — the concept
  // doesn't apply to them (they didn't owe anyone for this expense; they paid).
  const payerBalances = await computeBalancesFor(expense.paidById)

  const annotatedParticipants = expense.participants.map((p) => {
    if (p.userId === expense.paidById) {
      return { ...p, isEffectivelySettled: null as boolean | null }
    }
    const balanceWithPayer = payerBalances[p.userId]
    // If they don't appear in the payer's balance map, they have no net debt.
    // If they appear with amount > $0.01, they still owe.
    const stillOwes = !!balanceWithPayer && balanceWithPayer.amount > 0.01
    return { ...p, isEffectivelySettled: !stillOwes as boolean | null }
  })

  res.json({ ...expense, participants: annotatedParticipants })
})

// Create an expense and split it evenly among participants.
//
// Two valid modes:
//   1. PERSONAL (no groupId): participants must be the payer or friends of
//      the payer. This is the default casual-split mode.
//   2. GROUP (groupId present): all participants must be members of that
//      group. Group context is purely organizational.
//
// Per V1 product rules, the payer is always the logged-in user — we ignore
// any paidById in the body to prevent impersonation.
app.post('/api/expenses', requireAuth, async (req, res) => {
  const { description, amount, participantIds, groupId } = req.body
  const paidById = req.userId!

  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    res.status(400).json({ error: 'At least one participant is required' })
    return
  }

  // GROUP mode — validate everyone is a member of the group
  if (groupId && typeof groupId === 'string') {
    const payerMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: paidById } },
    })
    if (!payerMembership) {
      res.status(403).json({ error: 'You are not a member of that group' })
      return
    }
    const participantMemberships = await prisma.groupMember.findMany({
      where: { groupId, userId: { in: participantIds } },
    })
    if (participantMemberships.length !== participantIds.length) {
      res.status(400).json({
        error: 'All participants must be members of the group',
      })
      return
    }
  } else {
    // PERSONAL mode — everyone who isn't the payer must be a friend
    const nonSelf = participantIds.filter((id: string) => id !== paidById)
    if (nonSelf.length > 0) {
      // Look up accepted friendships involving the payer + any of these users
      const friendships = await prisma.friendship.findMany({
        where: {
          status: 'accepted',
          OR: [
            { requesterId: paidById, addresseeId: { in: nonSelf } },
            { requesterId: { in: nonSelf }, addresseeId: paidById },
          ],
        },
      })
      // Build the set of friend IDs from those friendships
      const friendIds = new Set(
        friendships.flatMap((f) =>
          f.requesterId === paidById ? [f.addresseeId] : [f.requesterId],
        ),
      )
      // Any participant who isn't us and isn't in friendIds is a stranger
      const strangers = nonSelf.filter((id: string) => !friendIds.has(id))
      if (strangers.length > 0) {
        res.status(403).json({
          error: 'You can only split expenses with friends',
        })
        return
      }
    }
  }

  const amountPerPerson = Math.round((Number(amount) / participantIds.length) * 100) / 100

  const expense = await prisma.expense.create({
    data: {
      description,
      amount,
      paidById,
      // groupId is optional — undefined or null both work
      groupId: groupId || null,
      participants: {
        create: participantIds.map((userId: string) => ({
          userId,
          amountOwed: amountPerPerson,
        })),
      },
    },
    include: {
      paidBy: true,
      participants: {
        include: { user: true },
      },
    },
  })

  res.status(201).json(expense)
})

// Update an expense — only the payer can edit. Replaces description, amount,
// and participants atomically (in a single transaction). The replacement
// strategy is "delete all old participant rows, recreate from new list" —
// simpler than diffing, and we don't lose anything meaningful since the
// `isSettled` flag isn't used in V1.
app.put('/api/expenses/:id', requireAuth, async (req, res) => {
  const id = req.params.id as string
  const { description, amount, participantIds } = req.body

  // Validate input — fail fast before touching the DB
  if (!description || typeof description !== 'string' || !description.trim()) {
    res.status(400).json({ error: 'Description is required' })
    return
  }
  if (!amount || Number(amount) <= 0) {
    res.status(400).json({ error: 'Amount must be greater than 0' })
    return
  }
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    res.status(400).json({ error: 'At least one participant is required' })
    return
  }

  // Fetch + auth check: only the payer can edit
  const existing = await prisma.expense.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: 'Expense not found' })
    return
  }
  if (existing.paidById !== req.userId) {
    res.status(403).json({ error: 'Only the payer can edit this expense' })
    return
  }

  // Validate participants — depending on whether the expense is group-scoped:
  //   - If it has a groupId: everyone must still be a member of that group
  //   - If it's a personal (groupless) expense: everyone (except the payer)
  //     must be a friend of the payer
  if (existing.groupId) {
    const memberships = await prisma.groupMember.findMany({
      where: { groupId: existing.groupId, userId: { in: participantIds } },
    })
    if (memberships.length !== participantIds.length) {
      res.status(400).json({
        error: 'All participants must be members of this group',
      })
      return
    }
  } else {
    const nonSelf = participantIds.filter((id: string) => id !== req.userId!)
    if (nonSelf.length > 0) {
      const friendships = await prisma.friendship.findMany({
        where: {
          status: 'accepted',
          OR: [
            { requesterId: req.userId!, addresseeId: { in: nonSelf } },
            { requesterId: { in: nonSelf }, addresseeId: req.userId! },
          ],
        },
      })
      const friendIds = new Set(
        friendships.flatMap((f) =>
          f.requesterId === req.userId! ? [f.addresseeId] : [f.requesterId],
        ),
      )
      const strangers = nonSelf.filter((id: string) => !friendIds.has(id))
      if (strangers.length > 0) {
        res.status(403).json({
          error: 'You can only split expenses with friends',
        })
        return
      }
    }
  }

  const amountPerPerson = Math.round((Number(amount) / participantIds.length) * 100) / 100

  // Transaction: delete old participants AND update expense + create new participants.
  // If anything fails halfway through, the whole thing rolls back — we never end up
  // in a half-updated state.
  await prisma.$transaction([
    prisma.expenseParticipant.deleteMany({ where: { expenseId: id } }),
    prisma.expense.update({
      where: { id },
      data: {
        description: description.trim(),
        amount,
        participants: {
          create: participantIds.map((userId: string) => ({
            userId,
            amountOwed: amountPerPerson,
          })),
        },
      },
    }),
  ])

  // Re-fetch with full includes so the response shape matches the create endpoint
  const updated = await prisma.expense.findUnique({
    where: { id },
    include: {
      paidBy: true,
      participants: { include: { user: true } },
    },
  })

  res.json(updated)
})

// Delete an expense — only the payer can. Cascades to participant rows in a
// transaction. Returns 204 No Content (the standard for "successful delete,
// nothing to return").
app.delete('/api/expenses/:id', requireAuth, async (req, res) => {
  const id = req.params.id as string

  const existing = await prisma.expense.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: 'Expense not found' })
    return
  }
  if (existing.paidById !== req.userId) {
    res.status(403).json({ error: 'Only the payer can delete this expense' })
    return
  }

  await prisma.$transaction([
    prisma.expenseParticipant.deleteMany({ where: { expenseId: id } }),
    prisma.expense.delete({ where: { id } }),
  ])

  res.status(204).send()
})

// ── Groups ─────────────────────────────────────────────────────────────────
// A Group is a shared context where the same people split expenses together
// (e.g. "Barcelona trip", "Roommates 2026"). Every expense and settlement
// belongs to a group; balances will eventually be scoped per-group.

// List all groups the logged-in user is a member of
app.get('/api/groups', requireAuth, async (req, res) => {
  const groups = await prisma.group.findMany({
    where: {
      members: { some: { userId: req.userId! } },
    },
    include: {
      members: { include: { user: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(groups)
})

// Get one group by ID — only if the logged-in user is a member
app.get('/api/groups/:id', requireAuth, async (req, res) => {
  const id = req.params.id as string
  const group = await prisma.group.findFirst({
    where: {
      id,
      members: { some: { userId: req.userId! } },
    },
    include: {
      members: { include: { user: true } },
    },
  })
  if (!group) {
    // Same pattern as expenses — 404 instead of 403 so we don't leak existence
    res.status(404).json({ error: 'Group not found' })
    return
  }
  res.json(group)
})

// Create a new group. The creator automatically becomes the first member.
app.post('/api/groups', requireAuth, async (req, res) => {
  const { name } = req.body
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Group name is required' })
    return
  }

  // Create the group AND add the creator as a member in one transaction.
  // Without the transaction, a crash between the two ops would leave an
  // orphan group with no members — unreachable by anyone.
  const group = await prisma.group.create({
    data: {
      name: name.trim(),
      members: {
        create: { userId: req.userId! },
      },
    },
    include: {
      members: { include: { user: true } },
    },
  })
  res.status(201).json(group)
})

// Update a group (rename, archive, etc.) — must be a member
app.patch('/api/groups/:id', requireAuth, async (req, res) => {
  const id = req.params.id as string
  const { name, archived } = req.body

  const existing = await prisma.group.findFirst({
    where: {
      id,
      members: { some: { userId: req.userId! } },
    },
  })
  if (!existing) {
    res.status(404).json({ error: 'Group not found' })
    return
  }

  // Build update payload only with the fields the client actually sent
  const data: { name?: string; archivedAt?: Date | null } = {}
  if (typeof name === 'string' && name.trim()) {
    data.name = name.trim()
  }
  if (typeof archived === 'boolean') {
    data.archivedAt = archived ? new Date() : null
  }

  const updated = await prisma.group.update({
    where: { id },
    data,
    include: { members: { include: { user: true } } },
  })
  res.json(updated)
})

// Add a member to a group. The target user must:
//   1. Already exist as a registered user (looked up by email)
//   2. Be a friend of the inviter (no random-stranger invites)
app.post('/api/groups/:id/members', requireAuth, async (req, res) => {
  const id = req.params.id as string
  const { email } = req.body

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email is required' })
    return
  }

  // The inviter must already be a member of this group
  const group = await prisma.group.findFirst({
    where: {
      id,
      members: { some: { userId: req.userId! } },
    },
  })
  if (!group) {
    res.status(404).json({ error: 'Group not found' })
    return
  }

  // Find the user being invited
  const normalizedEmail = email.trim().toLowerCase()
  const invitee = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })
  if (!invitee) {
    res.status(404).json({ error: 'No user is registered with that email' })
    return
  }

  // Friendship check — invitee must already be an accepted friend
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'accepted',
      OR: [
        { requesterId: req.userId!, addresseeId: invitee.id },
        { requesterId: invitee.id, addresseeId: req.userId! },
      ],
    },
  })
  if (!friendship) {
    res.status(403).json({ error: 'You can only invite friends to your groups' })
    return
  }

  // Add — composite primary key prevents duplicates, so we catch P2002
  // ("unique constraint failed") and convert it to a friendly 409
  try {
    await prisma.groupMember.create({
      data: { groupId: id, userId: invitee.id },
    })
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      res.status(409).json({ error: 'That user is already in this group' })
      return
    }
    throw err
  }

  // Return the updated group with all members
  const updated = await prisma.group.findUnique({
    where: { id },
    include: { members: { include: { user: true } } },
  })
  res.status(201).json(updated)
})

// Remove a member from a group. Either:
//   - You're removing yourself (leaving the group), or
//   - You're removing someone else and you're both members
app.delete('/api/groups/:id/members/:userId', requireAuth, async (req, res) => {
  const id = req.params.id as string
  const targetUserId = req.params.userId as string

  // Both the remover AND the target must currently be members
  const group = await prisma.group.findFirst({
    where: {
      id,
      members: { some: { userId: req.userId! } },
    },
  })
  if (!group) {
    res.status(404).json({ error: 'Group not found' })
    return
  }

  await prisma.groupMember.delete({
    where: {
      groupId_userId: { groupId: id, userId: targetUserId },
    },
  })
  res.status(204).send()
})

// ── Friendships ────────────────────────────────────────────────────────────

// Send a friend request by email. We:
//   1. Look up the addressee by email (case-insensitive match via lowercased input)
//   2. Validate: not yourself, not a duplicate of an existing friendship
//   3. Create the friendship — requester always = logged-in user (from JWT)
app.post('/api/friendships', requireAuth, async (req, res) => {
  const { email } = req.body
  const requesterId = req.userId!

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email is required' })
    return
  }

  // Normalize so we don't get tripped up by capitalization or whitespace
  const normalizedEmail = email.trim().toLowerCase()

  const addressee = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })
  if (!addressee) {
    res.status(404).json({ error: 'No user is registered with that email' })
    return
  }

  if (addressee.id === requesterId) {
    res.status(400).json({ error: "You can't add yourself as a friend" })
    return
  }

  // Check for an existing friendship row between these two people (in either
  // direction). How we react depends on its status:
  //   - pending: block — there's already an unanswered request
  //   - accepted: block — they're already friends
  //   - declined: REVIVE — give them a second chance. Update the row in place
  //     so we keep at most one friendship row per pair (no orphan history).
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId, addresseeId: addressee.id },
        { requesterId: addressee.id, addresseeId: requesterId },
      ],
    },
  })

  if (existing) {
    if (existing.status === 'pending') {
      res.status(409).json({ error: 'A friend request is already pending between you two' })
      return
    }
    if (existing.status === 'accepted') {
      res.status(409).json({ error: 'You are already friends with this person' })
      return
    }
    // status === 'declined' (or any other unknown state — treat as "revive")
    // Update direction too: whoever is sending NOW is the new requester.
    const revived = await prisma.friendship.update({
      where: { id: existing.id },
      data: {
        requesterId,
        addresseeId: addressee.id,
        status: 'pending',
      },
      include: {
        requester: true,
        addressee: true,
      },
    })
    res.status(200).json(revived)
    return
  }

  // No prior friendship — create a fresh one.
  const friendship = await prisma.friendship.create({
    data: { requesterId, addresseeId: addressee.id },
    include: {
      requester: true,
      addressee: true,
    },
  })
  res.status(201).json(friendship)
})

// Accept or decline a friend request — only the recipient (addressee) can do this.
// The sender shouldn't be able to "accept" their own request. So we fetch the
// friendship first, verify the current user is the addressee, then update.
app.patch('/api/friendships/:id', requireAuth, async (req, res) => {
  const id = req.params.id as string
  const { status } = req.body

  const existing = await prisma.friendship.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: 'Friendship not found' })
    return
  }
  if (existing.addresseeId !== req.userId) {
    res.status(403).json({ error: 'Only the recipient can accept or decline this request' })
    return
  }

  const friendship = await prisma.friendship.update({
    where: { id },
    data: { status },
    include: {
      requester: true,
      addressee: true,
    },
  })
  res.json(friendship)
})

// Get all accepted friends for a user — you can only view your own friends list.
app.get('/api/users/:id/friends', requireAuth, async (req, res) => {
  const id = req.params.id as string
  if (id !== req.userId) {
    res.status(403).json({ error: 'You can only view your own friends list' })
    return
  }
  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'accepted',
      OR: [
        { requesterId: id },
        { addresseeId: id },
      ],
    },
    include: {
      requester: true,
      addressee: true,
    },
  })

  // Return the other person in each friendship, not the full friendship record
  const friends = friendships.map(f =>
    f.requesterId === id ? f.addressee : f.requester
  )

  res.json(friends)
})

// Record a settlement (someone paying someone back).
//
// Dual-mode like expenses:
//   - PERSONAL (no groupId): the two parties must be friends
//   - GROUP (groupId present): both must be members of that group
//
// You can only record a settlement you're part of (as payer or payee).
app.post('/api/settlements', requireAuth, async (req, res) => {
  const { payerId, payeeId, amount, groupId } = req.body

  if (payerId !== req.userId && payeeId !== req.userId) {
    res.status(403).json({ error: 'You can only record settlements you are part of' })
    return
  }
  if (payerId === payeeId) {
    res.status(400).json({ error: "Payer and payee can't be the same person" })
    return
  }

  if (groupId && typeof groupId === 'string') {
    // GROUP mode — both must be members
    const memberships = await prisma.groupMember.findMany({
      where: { groupId, userId: { in: [payerId, payeeId] } },
    })
    if (memberships.length !== 2) {
      res.status(400).json({
        error: 'Both payer and payee must be members of the group',
      })
      return
    }
  } else {
    // PERSONAL mode — the two parties must be accepted friends
    const otherId = payerId === req.userId ? payeeId : payerId
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { requesterId: req.userId!, addresseeId: otherId },
          { requesterId: otherId, addresseeId: req.userId! },
        ],
      },
    })
    if (!friendship) {
      res.status(403).json({
        error: 'You can only settle with friends',
      })
      return
    }
  }

  const settlement = await prisma.settlement.create({
    data: { payerId, payeeId, amount, groupId: groupId || null },
    include: {
      payer: true,
      payee: true,
    },
  })
  res.status(201).json(settlement)
})

// Get all friendships for a user (both pending and accepted, in both directions).
// You can only view your own.
app.get('/api/users/:id/friendships', requireAuth, async (req, res) => {
  const id = req.params.id as string
  if (id !== req.userId) {
    res.status(403).json({ error: 'You can only view your own friendships' })
    return
  }
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: id },
        { addresseeId: id },
      ],
    },
    include: {
      requester: true,
      addressee: true,
    },
  })
  res.json(friendships)
})

// Compute net balances for a user — who owes whom and how much.
// All the heavy lifting lives in `computeBalancesFor` (lib/balances.ts);
// this route just enforces auth, calls the helper, and trims near-zero
// values out of the response.
app.get('/api/balances/:userId', requireAuth, async (req, res) => {
  const userId = req.params.userId as string
  if (userId !== req.userId) {
    res.status(403).json({ error: 'You can only view your own balances' })
    return
  }

  const balanceMap = await computeBalancesFor(userId)

  // Filter out entries that are basically zero (avoid showing "$0.00 owed")
  // and sort by amount descending so people who owe YOU appear first.
  const balances = Object.values(balanceMap)
    .filter((b) => Math.abs(b.amount) >= 0.01)
    .sort((a, b) => b.amount - a.amount)

  res.json(balances)
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
