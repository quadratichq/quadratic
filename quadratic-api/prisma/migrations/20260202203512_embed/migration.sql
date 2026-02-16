-- CreateTable
CREATE TABLE "UnclaimedFile" (
    "id" SERIAL NOT NULL,
    "claim_token" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnclaimedFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnclaimedFile_claim_token_key" ON "UnclaimedFile"("claim_token");

-- CreateIndex
CREATE INDEX "UnclaimedFile_claim_token_idx" ON "UnclaimedFile"("claim_token");

-- CreateIndex
CREATE INDEX "UnclaimedFile_expires_at_idx" ON "UnclaimedFile"("expires_at");

-- CreateTable
CREATE TABLE "Embed" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "file_id" INTEGER NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Embed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Embed_uuid_key" ON "Embed"("uuid");

-- CreateIndex
CREATE INDEX "Embed_file_id_idx" ON "Embed"("file_id");

-- AddForeignKey
ALTER TABLE "Embed" ADD CONSTRAINT "Embed_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
