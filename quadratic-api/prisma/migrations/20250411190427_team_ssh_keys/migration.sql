-- AlterTable
ALTER TABLE "Team" 
ADD COLUMN     "ssh_private_key" BYTEA,
ADD COLUMN     "ssh_public_key" BYTEA;
