export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  createdAt: string
}

export interface ExpenseParticipant {
  id: string
  expenseId: string
  userId: string
  amountOwed: string   // Prisma Decimal serializes to string in JSON
  isSettled: boolean
  createdAt: string
  user: User
}

export interface Expense {
  id: string
  description: string
  amount: string       // Prisma Decimal serializes to string in JSON
  currency: string
  paidById: string
  splitType: string
  createdAt: string
  paidBy: User
  participants: ExpenseParticipant[]
}

export interface Friendship {
  id: string
  requesterId: string
  addresseeId: string
  status: string
  createdAt: string
  requester: User
  addressee: User
}

export interface Settlement {
  id: string
  payerId: string
  payeeId: string
  amount: string       // Prisma Decimal serializes to string in JSON
  createdAt: string
  payer: User
  payee: User
}

export interface CreateExpenseInput {
  description: string
  amount: number
  // Note: paidById is NOT in this shape. The server reads it from the JWT —
  // the logged-in user is always the payer.
  participantIds: string[]
}

export interface CreateSettlementInput {
  payerId: string
  payeeId: string
  amount: number
}

// Computed by GET /api/balances/:userId
// positive amount = other person owes current user
// negative amount = current user owes other person
export interface Balance {
  user: User
  amount: number
}
