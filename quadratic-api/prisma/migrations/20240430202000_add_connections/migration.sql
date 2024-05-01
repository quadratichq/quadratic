/*
  Warnings:

  - You are about to drop the column `secretArn` on the `Connection` table. All the data in the column will be lost.
  - You are about to drop the `ConnectionRunResult` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ConnectionRunResult" DROP CONSTRAINT "ConnectionRunResult_connectionId_fkey";

-- AlterTable
ALTER TABLE "Connection" DROP COLUMN "secretArn";

-- DropTable
DROP TABLE "ConnectionRunResult";
