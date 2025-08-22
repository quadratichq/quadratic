-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "stripe_subscription_retention_coupon_id" TEXT;

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");
