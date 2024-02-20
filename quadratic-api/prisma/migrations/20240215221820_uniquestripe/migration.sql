/*
  Warnings:

  - A unique constraint covering the columns `[stripe_customer_id]` on the table `Team` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripe_subscription_id]` on the table `Team` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Team_stripe_customer_id_key" ON "Team"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "Team_stripe_subscription_id_key" ON "Team"("stripe_subscription_id");
