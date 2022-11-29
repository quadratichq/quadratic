/*
  Warnings:

  - Added the required column `qUserId` to the `QFile` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "QFile" DROP CONSTRAINT "QFile_id_fkey";

-- AlterTable
ALTER TABLE "QFile" ADD COLUMN     "qUserId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "QFile" ADD CONSTRAINT "QFile_qUserId_fkey" FOREIGN KEY ("qUserId") REFERENCES "QUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
