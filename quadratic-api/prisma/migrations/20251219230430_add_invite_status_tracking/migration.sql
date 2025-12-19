-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DELETED');

-- AlterTable: Add columns with temporary defaults for existing rows
ALTER TABLE "FileInvite" 
ADD COLUMN "invited_by_user_id" INTEGER,
ADD COLUMN "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "updated_date" TIMESTAMP(3);

-- Set updated_date to created_date for existing rows
UPDATE "FileInvite" SET "updated_date" = "created_date" WHERE "updated_date" IS NULL;

-- Make updated_date NOT NULL after backfilling
ALTER TABLE "FileInvite" ALTER COLUMN "updated_date" SET NOT NULL;

-- AlterTable: Add columns with temporary defaults for existing rows
ALTER TABLE "TeamInvite" 
ADD COLUMN "invited_by_user_id" INTEGER,
ADD COLUMN "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "updated_date" TIMESTAMP(3);

-- Set updated_date to created_date for existing rows
UPDATE "TeamInvite" SET "updated_date" = "created_date" WHERE "updated_date" IS NULL;

-- Make updated_date NOT NULL after backfilling
ALTER TABLE "TeamInvite" ALTER COLUMN "updated_date" SET NOT NULL;

-- CreateIndex
CREATE INDEX "FileInvite_file_id_status_idx" ON "FileInvite"("file_id", "status");

-- CreateIndex
CREATE INDEX "TeamInvite_team_id_status_idx" ON "TeamInvite"("team_id", "status");

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileInvite" ADD CONSTRAINT "FileInvite_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
