-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "AiMemoryEntityType" AS ENUM ('FILE', 'CODE_CELL', 'CONNECTION', 'CHAT_INSIGHT');

-- CreateTable
CREATE TABLE "ai_memory" (
    "id" SERIAL NOT NULL,
    "team_id" INTEGER NOT NULL,
    "file_id" INTEGER,
    "entity_type" "AiMemoryEntityType" NOT NULL,
    "entity_id" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "embedding" vector(768),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_memory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_memory_team_id_entity_type_idx" ON "ai_memory"("team_id", "entity_type");

-- CreateIndex
CREATE INDEX "ai_memory_team_id_file_id_idx" ON "ai_memory"("team_id", "file_id");

-- CreateIndex (unique for upsert deduplication)
CREATE UNIQUE INDEX "ai_memory_team_id_file_id_entity_type_entity_id_key" ON "ai_memory"("team_id", "file_id", "entity_type", "entity_id");

-- CreateIndex (vector similarity search)
CREATE INDEX "ai_memory_embedding_idx" ON "ai_memory" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- AddForeignKey
ALTER TABLE "ai_memory" ADD CONSTRAINT "ai_memory_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memory" ADD CONSTRAINT "ai_memory_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
