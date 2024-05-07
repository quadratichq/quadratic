/*
  Warnings:

  - You are about to drop the column `database` on the `Connection` table. All the data in the column will be lost.
  - You are about to drop the column `secretArn` on the `Connection` table. All the data in the column will be lost.
  - You are about to drop the `ConnectionRunResult` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `typeDetails` to the `Connection` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `Connection` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('POSTGRES', 'MYSQL');

-- DropForeignKey
ALTER TABLE "ConnectionRunResult" DROP CONSTRAINT "ConnectionRunResult_connectionId_fkey";

-- AlterTable
ALTER TABLE "Connection" DROP COLUMN "database",
DROP COLUMN "secretArn",
ADD COLUMN     "typeDetails" JSONB NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "ConnectionType" NOT NULL;

-- DropTable
DROP TABLE "ConnectionRunResult";
