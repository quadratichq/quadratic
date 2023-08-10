/*
  Warnings:

  - Added the required column `userId` to the `QFeedback` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "QFeedback" ADD COLUMN     "userId" INTEGER NOT NULL,
ALTER COLUMN "qUserId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "QFeedback" ADD CONSTRAINT "QFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
