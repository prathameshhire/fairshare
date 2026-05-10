// Wipe every row from every table while keeping the schema intact.
// Used to "start from scratch" without rerunning migrations.
//
// Usage (from the server directory):
//   npx ts-node scripts/wipe_data.ts
//
// Idempotent — running it again on an empty database is a no-op (all counts
// will just be 0).
//
// Order matters: children before parents because foreign keys block deletion
// of a parent row that still has children referencing it.

import { prisma } from '../src/lib/prisma'

async function main() {
  console.log('Wiping all data…\n')

  // 1. ExpenseParticipant → references Expense and User
  const ep = await prisma.expenseParticipant.deleteMany()
  console.log(`✓ Deleted ${ep.count} expense participants`)

  // 2. Settlement → references User and Group
  const s = await prisma.settlement.deleteMany()
  console.log(`✓ Deleted ${s.count} settlements`)

  // 3. Expense → references User and Group (now safe; its participants are gone)
  const e = await prisma.expense.deleteMany()
  console.log(`✓ Deleted ${e.count} expenses`)

  // 4. GroupMember → references Group and User
  const gm = await prisma.groupMember.deleteMany()
  console.log(`✓ Deleted ${gm.count} group memberships`)

  // 5. Group → no more children pointing at it
  const g = await prisma.group.deleteMany()
  console.log(`✓ Deleted ${g.count} groups`)

  // 6. Friendship → references User (in two directions)
  const f = await prisma.friendship.deleteMany()
  console.log(`✓ Deleted ${f.count} friendships`)

  // 7. User → last, now that nothing references it
  const u = await prisma.user.deleteMany()
  console.log(`✓ Deleted ${u.count} users`)

  console.log('\nAll data wiped. Register fresh accounts to start over.')
}

main()
  .catch((err) => {
    console.error('Wipe failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
