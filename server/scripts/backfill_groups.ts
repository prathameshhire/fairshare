// One-off backfill script: assigns every existing expense and settlement
// to a "Default" group. Run AFTER the `add_groups_nullable` migration and
// BEFORE the migration that makes groupId NOT NULL.
//
// Usage (from the server directory):
//   npx ts-node scripts/backfill_groups.ts
//
// Idempotent — safe to run multiple times. Uses findFirst + skipDuplicates
// so re-runs don't error out on existing data.

import { prisma } from '../src/lib/prisma'

async function main() {
  console.log('Starting backfill…')

  // 1. Find or create the Default group
  let defaultGroup = await prisma.group.findFirst({
    where: { name: 'Default' },
  })
  if (!defaultGroup) {
    defaultGroup = await prisma.group.create({
      data: { name: 'Default' },
    })
    console.log(`✓ Created Default group: ${defaultGroup.id}`)
  } else {
    console.log(`✓ Default group already exists: ${defaultGroup.id}`)
  }

  // 2. Add every user as a member of the Default group.
  // `createMany` + `skipDuplicates` avoids errors if some are already members
  // (the composite primary key on GroupMember enforces uniqueness).
  const allUsers = await prisma.user.findMany({ select: { id: true } })
  const memberInserts = await prisma.groupMember.createMany({
    data: allUsers.map((u) => ({
      groupId: defaultGroup!.id,
      userId: u.id,
    })),
    skipDuplicates: true,
  })
  console.log(
    `✓ Added ${memberInserts.count} new members (${allUsers.length} total users)`,
  )

  // 3. Assign all groupId-less expenses to the Default group
  const expensesResult = await prisma.expense.updateMany({
    where: { groupId: null },
    data: { groupId: defaultGroup.id },
  })
  console.log(`✓ Backfilled ${expensesResult.count} expenses`)

  // 4. Same for settlements
  const settlementsResult = await prisma.settlement.updateMany({
    where: { groupId: null },
    data: { groupId: defaultGroup.id },
  })
  console.log(`✓ Backfilled ${settlementsResult.count} settlements`)

  console.log('\nBackfill complete. Now safe to make groupId NOT NULL.')
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
