-- AlterTable
ALTER TABLE "FileCheckpoint" ADD COLUMN     "transactions_hash" TEXT;

-- CreateIndex
CREATE INDEX "FileCheckpoint_file_id_transactions_hash_idx" ON "FileCheckpoint"("file_id", "transactions_hash");

