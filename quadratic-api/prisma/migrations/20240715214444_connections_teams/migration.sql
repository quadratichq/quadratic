-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('POSTGRES', 'MYSQL');

-- AlterTable
ALTER TABLE "Team" ALTER COLUMN "stripe_customer_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Connection" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "team_id" INTEGER NOT NULL,
    "type" "ConnectionType" NOT NULL,
    "typeDetails" BYTEA NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Connection_uuid_key" ON "Connection"("uuid");

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
