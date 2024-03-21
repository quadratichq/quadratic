/*
  Warnings:

  - Added the required column `stripe_customer_id` to the `Team` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'PAST_DUE', 'CANCELED', 'UNPAID', 'PAUSED');

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "stripe_current_period_end" TIMESTAMP(3),
ADD COLUMN     "stripe_customer_id" TEXT NOT NULL,
ADD COLUMN     "stripe_subscription_id" TEXT,
ADD COLUMN     "stripe_subscription_status" "SubscriptionStatus";
