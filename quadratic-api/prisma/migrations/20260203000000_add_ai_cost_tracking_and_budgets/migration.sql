-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'PRO', 'BUSINESS');

-- CreateTable
CREATE TABLE "AICost" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "file_id" INTEGER,
    "cost" DOUBLE PRECISION NOT NULL,
    "model" TEXT NOT NULL,
    "source" "AIChatSource" NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_read_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_write_tokens" INTEGER NOT NULL DEFAULT 0,
    "overage_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AICost_pkey" PRIMARY KEY ("id")
);

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

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "plan_type" "PlanType",
ADD COLUMN     "allow_overage_payments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "team_monthly_budget_limit" DOUBLE PRECISION,
ADD COLUMN     "stripe_current_period_start" TIMESTAMP(3),
ADD COLUMN     "stripe_overage_item_id" TEXT,
ADD COLUMN     "stripe_overage_billed_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stripe_overage_billed_period_start" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AICost_user_id_idx" ON "AICost"("user_id");

-- CreateIndex
CREATE INDEX "AICost_team_id_idx" ON "AICost"("team_id");

-- CreateIndex
CREATE INDEX "AICost_user_id_team_id_created_date_idx" ON "AICost"("user_id", "team_id", "created_date");

-- CreateIndex
CREATE INDEX "AICost_created_date_idx" ON "AICost"("created_date");

-- CreateIndex
CREATE INDEX "AICost_team_id_created_date_idx" ON "AICost"("team_id", "created_date");

-- CreateIndex
CREATE INDEX "AICost_team_id_created_date_overage_enabled_idx" ON "AICost"("team_id", "created_date", "overage_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "UserBudgetLimit_user_id_team_id_key" ON "UserBudgetLimit"("user_id", "team_id");

-- CreateIndex
CREATE INDEX "UserBudgetLimit_team_id_idx" ON "UserBudgetLimit"("team_id");

-- AddForeignKey
ALTER TABLE "AICost" ADD CONSTRAINT "AICost_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AICost" ADD CONSTRAINT "AICost_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AICost" ADD CONSTRAINT "AICost_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBudgetLimit" ADD CONSTRAINT "UserBudgetLimit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBudgetLimit" ADD CONSTRAINT "UserBudgetLimit_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
