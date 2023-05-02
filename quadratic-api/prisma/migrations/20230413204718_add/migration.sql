-- AlterTable
ALTER TABLE "QFile" ADD COLUMN     "times_updated" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "version" TEXT;
