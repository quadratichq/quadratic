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
