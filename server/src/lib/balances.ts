import { prisma } from './prisma'

// What we store per "other user" in the balance map.
// `amount` is how much THAT person owes the user we computed for.
//   positive → other user owes us
//   negative → we owe them
export type BalanceEntry = {
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
    createdAt: Date
  }
  amount: number
}

export type BalanceMap = Record<string, BalanceEntry>

/**
 * Compute net balances between `userId` and every other user they share
 * expenses or settlements with.
 *
 *   amount > 0  → that other user owes `userId` this much
 *   amount < 0  → `userId` owes that other user this much
 *   amount ≈ 0  → square (settled)
 *
 * Returns the FULL map (no filtering or sorting). Callers that show this to
 * the user (e.g. /api/balances/:userId) typically filter out near-zero values.
 *
 * The `/api/expenses/:id` endpoint uses the unfiltered map to decide whether
 * each participant is "settled" relative to the payer.
 */
export async function computeBalancesFor(userId: string): Promise<BalanceMap> {
  // Run the three queries in parallel — they don't depend on each other,
  // so there's no reason to wait for one before starting the next.
  const [paidExpenses, myParticipations, settlements] = await Promise.all([
    // Q1: expenses I paid for, with every participant (so we know who owes me)
    prisma.expense.findMany({
      where: { paidById: userId },
      include: { participants: { include: { user: true } } },
    }),
    // Q2: expense-participant rows where I'm listed as owing
    prisma.expenseParticipant.findMany({
      where: { userId },
      include: { expense: { include: { paidBy: true } } },
    }),
    // Q3: settlements I'm part of (either side)
    prisma.settlement.findMany({
      where: { OR: [{ payerId: userId }, { payeeId: userId }] },
      include: { payer: true, payee: true },
    }),
  ])

  const acc: BalanceMap = {}

  // Step 1: expenses I paid → each non-me participant owes me their share
  for (const expense of paidExpenses) {
    for (const p of expense.participants) {
      if (p.userId !== userId) {
        const id = p.userId
        if (acc[id]) acc[id].amount += Number(p.amountOwed)
        else acc[id] = { user: p.user, amount: Number(p.amountOwed) }
      }
    }
  }

  // Step 2: expenses others paid → I owe the payer my share
  for (const p of myParticipations) {
    if (p.expense.paidById !== userId) {
      const id = p.expense.paidById
      const delta = -Number(p.amountOwed)
      if (acc[id]) acc[id].amount += delta
      else acc[id] = { user: p.expense.paidBy, amount: delta }
    }
  }

  // Step 3: offset by actual settlements
  //
  // If I (userId) paid them in a settlement, that's a credit toward my balance
  // with them — it REDUCES what I owe them, or makes them owe me.
  // If they paid me, the opposite: REDUCES what they owe me.
  for (const s of settlements) {
    const amount = Number(s.amount)
    if (s.payerId === userId) {
      const id = s.payeeId
      if (acc[id]) acc[id].amount += amount
      else acc[id] = { user: s.payee, amount }
    } else {
      const id = s.payerId
      if (acc[id]) acc[id].amount -= amount
      else acc[id] = { user: s.payer, amount: -amount }
    }
  }

  return acc
}
