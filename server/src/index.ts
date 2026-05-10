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

app.use(cors())
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
// Per V1 product rules: only the payer can log an expense. So we force
// paidById to the logged-in user's ID — we IGNORE whatever the client sends.
// This prevents a malicious client from creating an expense in someone else's name.
app.post('/api/expenses', requireAuth, async (req, res) => {
  const { description, amount, participantIds } = req.body
  const paidById = req.userId!

  const amountPerPerson = Math.round((Number(amount) / participantIds.length) * 100) / 100

  const expense = await prisma.expense.create({
    data: {
      description,
      amount,
      paidById,
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
// You can only record a settlement that you yourself are part of —
// either you paid someone, or someone paid you.
app.post('/api/settlements', requireAuth, async (req, res) => {
  const { payerId, payeeId, amount } = req.body

  if (payerId !== req.userId && payeeId !== req.userId) {
    res.status(403).json({ error: 'You can only record settlements you are part of' })
    return
  }
  if (payerId === payeeId) {
    res.status(400).json({ error: "Payer and payee can't be the same person" })
    return
  }

  const settlement = await prisma.settlement.create({
    data: { payerId, payeeId, amount },
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
