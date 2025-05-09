-- CreateIndex
CREATE INDEX "AnalyticsAIChat_created_date_idx" ON "AnalyticsAIChat"("created_date");

-- CreateIndex
CREATE INDEX "AnalyticsAIChat_user_id_source_created_date_idx" ON "AnalyticsAIChat"("user_id", "source", "created_date");

-- CreateIndex
CREATE INDEX "AnalyticsAIChatMessage_chat_id_message_type_idx" ON "AnalyticsAIChatMessage"("chat_id", "message_type");

-- CreateIndex
CREATE INDEX "File_owner_team_id_idx" ON "File"("owner_team_id");

-- CreateIndex
CREATE INDEX "File_id_owner_team_id_idx" ON "File"("id", "owner_team_id");
