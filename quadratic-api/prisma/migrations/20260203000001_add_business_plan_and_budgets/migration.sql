-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'PRO', 'BUSINESS');

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "plan_type" "PlanType",
ADD COLUMN     "allow_overage_payments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "team_monthly_budget_limit" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "UserBudgetLimit" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "monthly_budget_limit" DOUBLE PRECISION NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBudgetLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserBudgetLimit_user_id_team_id_key" ON "UserBudgetLimit"("user_id", "team_id");

-- CreateIndex
CREATE INDEX "UserBudgetLimit_team_id_idx" ON "UserBudgetLimit"("team_id");

-- CreateIndex
CREATE INDEX "UserBudgetLimit_user_id_team_id_idx" ON "UserBudgetLimit"("user_id", "team_id");

-- AddForeignKey
ALTER TABLE "UserBudgetLimit" ADD CONSTRAINT "UserBudgetLimit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBudgetLimit" ADD CONSTRAINT "UserBudgetLimit_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
