-- AlterTable
ALTER TABLE "File" ALTER COLUMN "contents" DROP NOT NULL;

-- CreateTable
CREATE TABLE "FileCheckpoint" (
    "id" SERIAL NOT NULL,
    "file_id" INTEGER NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "s3_bucket" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileCheckpoint_file_id_sequence_number_idx" ON "FileCheckpoint"("file_id", "sequence_number");

-- CreateIndex
CREATE UNIQUE INDEX "FileCheckpoint_file_id_sequence_number_key" ON "FileCheckpoint"("file_id", "sequence_number");

-- CreateIndex
CREATE INDEX "File_uuid_idx" ON "File"("uuid");

-- CreateIndex
CREATE INDEX "Team_uuid_idx" ON "Team"("uuid");

-- CreateIndex
CREATE INDEX "User_auth0_id_idx" ON "User"("auth0_id");

-- AddForeignKey
ALTER TABLE "FileCheckpoint" ADD CONSTRAINT "FileCheckpoint_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
