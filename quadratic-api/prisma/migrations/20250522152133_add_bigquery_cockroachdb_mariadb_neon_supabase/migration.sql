-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ConnectionType" ADD VALUE 'BIGQUERY';
ALTER TYPE "ConnectionType" ADD VALUE 'COCKROACHDB';
ALTER TYPE "ConnectionType" ADD VALUE 'MARIADB';
ALTER TYPE "ConnectionType" ADD VALUE 'NEON';
ALTER TYPE "ConnectionType" ADD VALUE 'SUPABASE';
