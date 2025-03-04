-- CreateEnum
CREATE TYPE "AIChatMessageType" AS ENUM ('user_prompt', 'tool_result');

-- AlterTable
ALTER TABLE "AnalyticsAIChatMessage" ADD COLUMN     "cache_read_tokens" INTEGER,
ADD COLUMN     "cache_write_tokens" INTEGER,
ADD COLUMN     "input_tokens" INTEGER,
ADD COLUMN     "message_type" "AIChatMessageType",
ADD COLUMN     "output_tokens" INTEGER,
ALTER COLUMN "s3_key" DROP NOT NULL;
