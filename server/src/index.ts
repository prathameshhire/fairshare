import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { prisma } from './lib/prisma'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware: teach Express to accept JSON request bodies
app.use(cors())
app.use(express.json())

// Health check — confirms the server is running
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Fairshare API is running' })
})

// Get all users
app.get('/api/users', async (_req, res) => {
  const users = await prisma.user.findMany()
  res.json(users)
})

// Create a user
app.post('/api/users', async (req, res) => {
  const { email, name } = req.body
  const user = await prisma.user.create({
    data: { email, name },
  })
  res.status(201).json(user)
})

// Get a single user by ID
app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params
  const user = await prisma.user.findUnique({
    where: { id },
  })
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  res.json(user)
})

// Get all expenses
app.get('/api/expenses', async (_req, res) => {
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
app.get('/api/expenses/:id', async (req, res) => {
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
app.post('/api/expenses', async (req, res) => {
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
app.post('/api/friendships', async (req, res) => {
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
app.patch('/api/friendships/:id', async (req, res) => {
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
app.get('/api/users/:id/friends', async (req, res) => {
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
app.post('/api/settlements', async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
