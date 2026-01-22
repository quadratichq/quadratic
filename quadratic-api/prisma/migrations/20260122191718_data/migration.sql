-- CreateEnum
CREATE TYPE "DataAssetType" AS ENUM ('CSV', 'EXCEL', 'PARQUET', 'PDF', 'JSON', 'OTHER');

-- CreateTable
CREATE TABLE "DataAsset" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "DataAssetType" NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "s3_bucket" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_date" TIMESTAMP(3),
    "creator_user_id" INTEGER NOT NULL,
    "owner_user_id" INTEGER,
    "owner_team_id" INTEGER NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "DataAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataAsset_uuid_key" ON "DataAsset"("uuid");

-- CreateIndex
CREATE INDEX "DataAsset_uuid_idx" ON "DataAsset"("uuid");

-- CreateIndex
CREATE INDEX "DataAsset_owner_team_id_idx" ON "DataAsset"("owner_team_id");

-- CreateIndex
CREATE INDEX "DataAsset_owner_user_id_idx" ON "DataAsset"("owner_user_id");

-- CreateIndex
CREATE INDEX "DataAsset_type_idx" ON "DataAsset"("type");

-- CreateIndex
CREATE INDEX "DataAsset_deleted_idx" ON "DataAsset"("deleted");

-- AddForeignKey
ALTER TABLE "DataAsset" ADD CONSTRAINT "DataAsset_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataAsset" ADD CONSTRAINT "DataAsset_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataAsset" ADD CONSTRAINT "DataAsset_owner_team_id_fkey" FOREIGN KEY ("owner_team_id") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
