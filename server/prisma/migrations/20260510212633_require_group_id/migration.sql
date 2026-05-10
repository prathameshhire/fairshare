/*
  Warnings:

  - Made the column `groupId` on table `Expense` required. This step will fail if there are existing NULL values in that column.
  - Made the column `groupId` on table `Settlement` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_groupId_fkey";

-- DropForeignKey
ALTER TABLE "Settlement" DROP CONSTRAINT "Settlement_groupId_fkey";

-- AlterTable
ALTER TABLE "Expense" ALTER COLUMN "groupId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Settlement" ALTER COLUMN "groupId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
