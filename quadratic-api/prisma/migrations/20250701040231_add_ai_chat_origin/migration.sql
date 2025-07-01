-- CreateEnum
CREATE TYPE "AIChatOrigin" AS ENUM ('marketing_site', 'url_prompt', 'example_prompts', 'fix_with_ai', 'internal', 'tool_call', 'user');

-- AlterTable
ALTER TABLE "AnalyticsAIChat" ADD COLUMN     "origin" "AIChatOrigin";
