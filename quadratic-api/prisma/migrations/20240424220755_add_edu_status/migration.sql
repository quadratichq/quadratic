/*
  Warnings:

  - A unique constraint covering the columns `[edu_status]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "EduStatus" AS ENUM ('INELIGIBLE', 'ENROLLED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "edu_status" "EduStatus";

-- CreateIndex
CREATE UNIQUE INDEX "User_edu_status_key" ON "User"("edu_status");
