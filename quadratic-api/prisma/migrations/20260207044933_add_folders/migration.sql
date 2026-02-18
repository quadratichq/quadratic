-- AlterTable
ALTER TABLE "File" ADD COLUMN     "folder_id" INTEGER;

-- CreateTable
CREATE TABLE "Folder" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_folder_id" INTEGER,
    "owner_user_id" INTEGER,
    "owner_team_id" INTEGER NOT NULL,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Folder_uuid_key" ON "Folder"("uuid");

-- CreateIndex
CREATE INDEX "Folder_uuid_idx" ON "Folder"("uuid");

-- CreateIndex
CREATE INDEX "Folder_owner_team_id_idx" ON "Folder"("owner_team_id");

-- CreateIndex
CREATE INDEX "Folder_parent_folder_id_idx" ON "Folder"("parent_folder_id");

-- CreateIndex
CREATE INDEX "File_folder_id_idx" ON "File"("folder_id");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parent_folder_id_fkey" FOREIGN KEY ("parent_folder_id") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_owner_team_id_fkey" FOREIGN KEY ("owner_team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
