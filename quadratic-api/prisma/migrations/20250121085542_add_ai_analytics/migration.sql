-- CreateEnum
CREATE TYPE "AIChatSource" AS ENUM ('ai_assistant', 'ai_analyst', 'ai_researcher', 'get_chat_name', 'get_file_name');

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "setting_analytics_ai" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "AnalyticsAIChat" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "file_id" INTEGER NOT NULL,
    "chat_id" TEXT NOT NULL,
    "source" "AIChatSource" NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsAIChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsAIChatMessage" (
    "id" SERIAL NOT NULL,
    "chat_id" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "message_index" INTEGER NOT NULL,
    "s3_key" TEXT NOT NULL,
    "like" BOOLEAN,
    "undo" BOOLEAN,
    "code_run_error" TEXT,
    "response_error" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsAIChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsAIChat_chat_id_key" ON "AnalyticsAIChat"("chat_id");

-- CreateIndex
CREATE INDEX "AnalyticsAIChat_chat_id_idx" ON "AnalyticsAIChat"("chat_id");

-- CreateIndex
CREATE INDEX "AnalyticsAIChat_user_id_idx" ON "AnalyticsAIChat"("user_id");

-- CreateIndex
CREATE INDEX "AnalyticsAIChat_file_id_idx" ON "AnalyticsAIChat"("file_id");

-- CreateIndex
CREATE INDEX "AnalyticsAIChat_source_idx" ON "AnalyticsAIChat"("source");

-- CreateIndex
CREATE INDEX "AnalyticsAIChatMessage_chat_id_message_index_idx" ON "AnalyticsAIChatMessage"("chat_id", "message_index");

-- CreateIndex
CREATE INDEX "AnalyticsAIChatMessage_chat_id_idx" ON "AnalyticsAIChatMessage"("chat_id");

-- CreateIndex
CREATE INDEX "AnalyticsAIChatMessage_model_idx" ON "AnalyticsAIChatMessage"("model");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsAIChatMessage_chat_id_message_index_key" ON "AnalyticsAIChatMessage"("chat_id", "message_index");

-- AddForeignKey
ALTER TABLE "AnalyticsAIChat" ADD CONSTRAINT "AnalyticsAIChat_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsAIChat" ADD CONSTRAINT "AnalyticsAIChat_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsAIChatMessage" ADD CONSTRAINT "AnalyticsAIChatMessage_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "AnalyticsAIChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
