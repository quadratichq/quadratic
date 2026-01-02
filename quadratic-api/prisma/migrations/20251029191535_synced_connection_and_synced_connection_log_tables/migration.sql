-- CreateEnum
CREATE TYPE "SyncedConnectionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "SyncedConnectionLogStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "SyncedConnection" (
    "id" SERIAL NOT NULL,
    "connection_id" INTEGER NOT NULL,
    "percent_completed" INTEGER NOT NULL DEFAULT 0,
    "status" "SyncedConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "updated_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncedConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncedConnectionLog" (
    "id" SERIAL NOT NULL,
    "synced_connection_id" INTEGER NOT NULL,
    "run_id" TEXT NOT NULL,
    "synced_dates" DATE[] DEFAULT ARRAY[]::DATE[],
    "status" "SyncedConnectionLogStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncedConnectionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncedConnection_connection_id_idx" ON "SyncedConnection"("connection_id");

-- CreateIndex
CREATE INDEX "SyncedConnection_status_idx" ON "SyncedConnection"("status");

-- CreateIndex
CREATE INDEX "SyncedConnectionLog_synced_connection_id_idx" ON "SyncedConnectionLog"("synced_connection_id");

-- CreateIndex
CREATE INDEX "SyncedConnectionLog_status_idx" ON "SyncedConnectionLog"("status");

-- CreateIndex
CREATE INDEX "SyncedConnectionLog_run_id_created_date_idx" ON "SyncedConnectionLog"("run_id", "created_date" DESC);

-- CreateIndex
CREATE INDEX "SyncedConnectionLog_created_date_idx" ON "SyncedConnectionLog"("created_date" DESC);

-- AddForeignKey
ALTER TABLE "SyncedConnection" ADD CONSTRAINT "SyncedConnection_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncedConnectionLog" ADD CONSTRAINT "SyncedConnectionLog_synced_connection_id_fkey" FOREIGN KEY ("synced_connection_id") REFERENCES "SyncedConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
