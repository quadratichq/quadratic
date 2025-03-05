/*
  Warnings:

  - You are about to drop the `QFile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QUser` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "QFile" DROP CONSTRAINT "QFile_qUserId_fkey";

-- DropTable
DROP TABLE "QFile";

-- DropTable
DROP TABLE "QUser";
