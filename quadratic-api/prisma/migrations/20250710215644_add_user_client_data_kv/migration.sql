-- AlterTable
ALTER TABLE "User" ADD COLUMN     "client_data_kv" JSONB NOT NULL DEFAULT '{}';
