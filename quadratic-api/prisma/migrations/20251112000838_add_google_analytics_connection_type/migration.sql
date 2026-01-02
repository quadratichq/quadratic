/*
  Warnings:

  - A unique constraint covering the columns `[connection_id]` on the table `SyncedConnection` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "SyncedConnection_connection_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "SyncedConnection_connection_id_key" ON "SyncedConnection"("connection_id");
