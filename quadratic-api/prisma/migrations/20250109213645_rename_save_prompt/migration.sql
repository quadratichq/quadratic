/*
  Warnings:

  - You are about to drop the column `preference_ai_save_user_prompts_enabled` on the `Team` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Team" DROP COLUMN "preference_ai_save_user_prompts_enabled",
ADD COLUMN     "setting_analytics_ai" BOOLEAN NOT NULL DEFAULT true;
