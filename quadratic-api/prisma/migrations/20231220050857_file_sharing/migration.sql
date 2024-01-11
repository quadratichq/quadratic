-- CreateEnum
CREATE TYPE "FileRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- AlterTable
ALTER TABLE "File" ADD COLUMN     "team_id" INTEGER;

-- CreateTable
CREATE TABLE "UserFileRole" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "fileId" INTEGER NOT NULL,
    "role" "FileRole" NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFileRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileInvite" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "file_id" INTEGER NOT NULL,
    "role" "FileRole" NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserFileRole_userId_fileId_key" ON "UserFileRole"("userId", "fileId");

-- CreateIndex
CREATE UNIQUE INDEX "FileInvite_email_file_id_key" ON "FileInvite"("email", "file_id");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFileRole" ADD CONSTRAINT "UserFileRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFileRole" ADD CONSTRAINT "UserFileRole_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileInvite" ADD CONSTRAINT "FileInvite_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
