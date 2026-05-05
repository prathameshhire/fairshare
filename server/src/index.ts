import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from './lib/prisma'

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

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    res.status(409).json({ error: 'An account with that email already exists' })
    return
  }

  // bcrypt hashes the password with 10 "rounds" of processing.
  // More rounds = harder to brute-force, but slower. 10 is the industry standard.
  const passwordHash = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: { name, email, passwordHash },
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

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.passwordHash) {
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
  const { id } = req.params
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

// Get all expenses
app.get('/api/expenses', requireAuth, async (_req, res) => {
  const expenses = await prisma.expense.findMany({
    include: {
      paidBy: true,
      participants: {
        include: { user: true },
      },
    },
  })
  res.json(expenses)
})

// Get one expense by ID
app.get('/api/expenses/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const expense = await prisma.expense.findUnique({
    where: { id },
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
  res.json(expense)
})

// Create an expense and split it evenly among participants
app.post('/api/expenses', requireAuth, async (req, res) => {
  const { description, amount, paidById, participantIds } = req.body

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

// Send a friend request
app.post('/api/friendships', requireAuth, async (req, res) => {
  const { requesterId, addresseeId } = req.body
  const friendship = await prisma.friendship.create({
    data: { requesterId, addresseeId },
    include: {
      requester: true,
      addressee: true,
    },
  })
  res.status(201).json(friendship)
})

// Accept or decline a friend request
app.patch('/api/friendships/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const { status } = req.body
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

// Get all accepted friends for a user
app.get('/api/users/:id/friends', requireAuth, async (req, res) => {
  const { id } = req.params
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

// Record a settlement (someone paying someone back)
app.post('/api/settlements', requireAuth, async (req, res) => {
  const { payerId, payeeId, amount } = req.body
  const settlement = await prisma.settlement.create({
    data: { payerId, payeeId, amount },
    include: {
      payer: true,
      payee: true,
    },
  })
  res.status(201).json(settlement)
})

// Get all friendships for a user (both pending and accepted, in both directions)
app.get('/api/users/:id/friendships', requireAuth, async (req, res) => {
  const { id } = req.params
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

// Compute net balances for a user — who owes whom and how much
// Positive amount = the other person owes the current user
// Negative amount = the current user owes the other person
app.get('/api/balances/:userId', requireAuth, async (req, res) => {
  const { userId } = req.params

  // Query 1: all expenses this user paid, with every participant
  const paidExpenses = await prisma.expense.findMany({
    where: { paidById: userId },
    include: {
      participants: { include: { user: true } },
    },
  })

  // Query 2: all expense-participant rows where this user is listed as owing
  const myParticipations = await prisma.expenseParticipant.findMany({
    where: { userId },
    include: {
      expense: { include: { paidBy: true } },
    },
  })

  // Query 3: all settlements this user was part of
  const settlements = await prisma.settlement.findMany({
    where: {
      OR: [{ payerId: userId }, { payeeId: userId }],
    },
    include: { payer: true, payee: true },
  })

  // Balance accumulator: otherUserId → { user, amount }
  // positive = they owe current user; negative = current user owes them
  type BalanceEntry = { user: object; amount: number }
  const acc: Record<string, BalanceEntry> = {}

  // Step 1: expenses I paid — each non-me participant owes me their share
  for (const expense of paidExpenses) {
    for (const p of expense.participants) {
      if (p.userId !== userId) {
        const id = p.userId
        if (acc[id]) {
          acc[id].amount += Number(p.amountOwed)
        } else {
          acc[id] = { user: p.user, amount: Number(p.amountOwed) }
        }
      }
    }
  }

  // Step 2: expenses others paid — I owe the payer my share
  for (const p of myParticipations) {
    if (p.expense.paidById !== userId) {
      const id = p.expense.paidById
      const delta = -Number(p.amountOwed)
      if (acc[id]) {
        acc[id].amount += delta
      } else {
        acc[id] = { user: p.expense.paidBy, amount: delta }
      }
    }
  }

  // Step 3: offset by actual settlement payments
  for (const s of settlements) {
    const amount = Number(s.amount)
    if (s.payerId === userId) {
      const id = s.payeeId
      if (acc[id]) { acc[id].amount += amount } else { acc[id] = { user: s.payee, amount } }
    } else {
      const id = s.payerId
      if (acc[id]) { acc[id].amount -= amount } else { acc[id] = { user: s.payer, amount: -amount } }
    }
  }

  const balances = Object.values(acc)
    .filter((b) => Math.abs(b.amount) >= 0.01)
    .sort((a, b) => (b.amount as number) - (a.amount as number))

  res.json(balances)
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
