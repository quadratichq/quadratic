-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "AiMemoryEntityType" AS ENUM ('FILE', 'CODE_CELL', 'DATA_TABLE', 'SHEET_TABLE', 'CONNECTION', 'CHAT_INSIGHT');

-- CreateEnum
CREATE TYPE "AiMemoryScope" AS ENUM ('file', 'team');

-- CreateTable
CREATE TABLE "ai_memory" (
    "id" SERIAL NOT NULL,
    "team_id" INTEGER NOT NULL,
    "file_id" INTEGER,
    "entity_type" "AiMemoryEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL DEFAULT '',
    "scope" "AiMemoryScope" NOT NULL DEFAULT 'file',
    "topic" TEXT,
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

-- CreateTable
CREATE TABLE "ai_memory_link" (
    "id" SERIAL NOT NULL,
    "source_id" INTEGER NOT NULL,
    "target_id" INTEGER NOT NULL,
    "relationship" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_memory_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_memory_team_id_entity_type_idx" ON "ai_memory"("team_id", "entity_type");

-- CreateIndex
CREATE INDEX "ai_memory_team_id_file_id_idx" ON "ai_memory"("team_id", "file_id");

-- CreateIndex
CREATE INDEX "ai_memory_team_id_scope_idx" ON "ai_memory"("team_id", "scope");

-- CreateIndex
CREATE INDEX "ai_memory_team_id_topic_idx" ON "ai_memory"("team_id", "topic");

-- CreateIndex (unique for upsert deduplication, COALESCE handles NULLs)
CREATE UNIQUE INDEX "ai_memory_dedup_idx" ON "ai_memory"("team_id", COALESCE("file_id", -1), "entity_type", "entity_id");

-- CreateIndex (vector similarity search)
CREATE INDEX "ai_memory_embedding_idx" ON "ai_memory" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- CreateIndex
CREATE INDEX "ai_memory_link_source_id_idx" ON "ai_memory_link"("source_id");

-- CreateIndex
CREATE INDEX "ai_memory_link_target_id_idx" ON "ai_memory_link"("target_id");

-- CreateIndex (unique for deduplication)
CREATE UNIQUE INDEX "ai_memory_link_source_id_target_id_key" ON "ai_memory_link"("source_id", "target_id");

-- AddForeignKey
ALTER TABLE "ai_memory" ADD CONSTRAINT "ai_memory_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memory" ADD CONSTRAINT "ai_memory_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memory_link" ADD CONSTRAINT "ai_memory_link_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "ai_memory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memory_link" ADD CONSTRAINT "ai_memory_link_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "ai_memory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
