-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ai_languages" TEXT[] DEFAULT ARRAY[]::TEXT[];
