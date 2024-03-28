/*
  Warnings:

  - You are about to drop the column `team_id` on the `File` table. All the data in the column will be lost.
  - Added the required column `creator_user_id` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_ownerUserId_fkey";

-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_team_id_fkey";

-- AlterTable
ALTER TABLE "File" DROP COLUMN "team_id",
-- ADD COLUMN     "creator_user_id" INTEGER NOT NULL,
ADD COLUMN     "owner_team_id" INTEGER,
ALTER COLUMN "ownerUserId" DROP NOT NULL;

-- Stuff from David
ALTER TABLE "File"
ADD COLUMN "creator_user_id" INTEGER;
UPDATE "File"
SET "creator_user_id" = "ownerUserId";
ALTER TABLE "File"
ALTER COLUMN "creator_user_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_owner_team_id_fkey" FOREIGN KEY ("owner_team_id") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
