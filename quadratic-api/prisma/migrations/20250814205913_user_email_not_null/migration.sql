/*
  Warnings:

  - Made the column `email` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- First update any NULL emails
UPDATE "User" SET email = CONCAT('missing_email_-', "auth0_id", '@quadratichq.com') WHERE email IS NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");
