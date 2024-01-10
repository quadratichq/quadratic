/*
  Warnings:

  - The values [OWNER] on the enum `FileRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `fileId` on the `UserFileRole` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `UserFileRole` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[user_id,file_id]` on the table `UserFileRole` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `file_id` to the `UserFileRole` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `UserFileRole` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "FileRole_new" AS ENUM ('EDITOR', 'VIEWER');
ALTER TABLE "UserFileRole" ALTER COLUMN "role" TYPE "FileRole_new" USING ("role"::text::"FileRole_new");
ALTER TABLE "FileInvite" ALTER COLUMN "role" TYPE "FileRole_new" USING ("role"::text::"FileRole_new");
ALTER TYPE "FileRole" RENAME TO "FileRole_old";
ALTER TYPE "FileRole_new" RENAME TO "FileRole";
DROP TYPE "FileRole_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "UserFileRole" DROP CONSTRAINT "UserFileRole_fileId_fkey";

-- DropForeignKey
ALTER TABLE "UserFileRole" DROP CONSTRAINT "UserFileRole_userId_fkey";

-- DropIndex
DROP INDEX "UserFileRole_userId_fileId_key";

-- AlterTable
ALTER TABLE "UserFileRole" DROP COLUMN "fileId",
DROP COLUMN "userId",
ADD COLUMN     "file_id" INTEGER NOT NULL,
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "UserFileRole_user_id_file_id_key" ON "UserFileRole"("user_id", "file_id");

-- AddForeignKey
ALTER TABLE "UserFileRole" ADD CONSTRAINT "UserFileRole_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFileRole" ADD CONSTRAINT "UserFileRole_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
