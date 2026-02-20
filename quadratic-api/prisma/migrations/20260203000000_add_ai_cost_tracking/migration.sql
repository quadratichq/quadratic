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
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AICost_pkey" PRIMARY KEY ("id")
);

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

-- AddForeignKey
ALTER TABLE "AICost" ADD CONSTRAINT "AICost_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AICost" ADD CONSTRAINT "AICost_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AICost" ADD CONSTRAINT "AICost_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
