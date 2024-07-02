/*
  Warnings:

  - You are about to drop the `UserConnectionRole` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `team_id` to the `Connection` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "UserConnectionRole" DROP CONSTRAINT "UserConnectionRole_connectionId_fkey";

-- DropForeignKey
ALTER TABLE "UserConnectionRole" DROP CONSTRAINT "UserConnectionRole_userId_fkey";

-- AlterTable
ALTER TABLE "Connection" ADD COLUMN     "team_id" INTEGER NOT NULL;

-- DropTable
DROP TABLE "UserConnectionRole";

-- DropEnum
DROP TYPE "ConnectionRole";

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
