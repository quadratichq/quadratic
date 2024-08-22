-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "client_data_kv" JSONB NOT NULL DEFAULT '{}';
