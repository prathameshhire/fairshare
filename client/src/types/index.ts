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
  isSettled: boolean   // Legacy DB flag — never written to in V1, kept for schema compatibility
  createdAt: string
  user: User
  // Computed by GET /api/expenses/:id (NOT by GET /api/expenses).
  // Tells you whether THIS participant has effectively settled with the payer
  // based on their full shared history. `null` for the payer themselves.
  isEffectivelySettled?: boolean | null
}

export interface Expense {
  id: string
  description: string
  amount: string       // Prisma Decimal serializes to string in JSON
  currency: string
  paidById: string
  splitType: string
  // Optional — null for personal (groupless) expenses
  groupId: string | null
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
  groupId: string | null
  createdAt: string
  payer: User
  payee: User
}

// A Group is a shared expense context (Barcelona trip, Roommates 2026, etc.)
// Every expense and settlement belongs to one.
export interface Group {
  id: string
  name: string
  archivedAt: string | null
  createdAt: string
  members: GroupMember[]
}

export interface GroupMember {
  groupId: string
  userId: string
  joinedAt: string
  user: User
}

export interface CreateExpenseInput {
  description: string
  amount: number
  // Note: paidById is NOT in this shape. The server reads it from the JWT —
  // the logged-in user is always the payer.
  participantIds: string[]
  // Optional — omit for a personal (groupless) expense
  groupId?: string
}

export interface CreateSettlementInput {
  payerId: string
  payeeId: string
  amount: number
  // Optional — omit for a personal (groupless) settlement
  groupId?: string
}

// Computed by GET /api/balances/:userId
// positive amount = other person owes current user
// negative amount = current user owes other person
export interface Balance {
  user: User
  amount: number
}
