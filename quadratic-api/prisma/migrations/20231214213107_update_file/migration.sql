/*
  Warnings:

  - You are about to drop the column `created_by` on the `FileCheckpoint` table. All the data in the column will be lost.
  - You are about to drop the column `created_date` on the `FileCheckpoint` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "FileCheckpoint" DROP CONSTRAINT "FileCheckpoint_created_by_fkey";

-- AlterTable
ALTER TABLE "FileCheckpoint" DROP COLUMN "created_by",
DROP COLUMN "created_date",
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
