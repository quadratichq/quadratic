-- CreateEnum
CREATE TYPE "EduStatus" AS ENUM ('INELIGIBLE', 'ENROLLED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "edu_status" "EduStatus";
