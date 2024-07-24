/*
  Warnings:

  - You are about to drop the column `activated` on the `Team` table. All the data in the column will be lost.
  - Made the column `owner_team_id` on table `File` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_owner_team_id_fkey";

-- AlterTable
ALTER TABLE "File" ALTER COLUMN "owner_team_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "Team" DROP COLUMN "activated";

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_owner_team_id_fkey" FOREIGN KEY ("owner_team_id") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
