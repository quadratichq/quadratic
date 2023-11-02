-- CreateEnum
CREATE TYPE "ConnectionRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateTable
CREATE TABLE "Connection" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_date" TIMESTAMP(3),
    "type" TEXT NOT NULL,
    "database" JSONB NOT NULL,
    "secretArn" TEXT NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserConnectionRole" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "connectionId" INTEGER NOT NULL,
    "role" "ConnectionRole" NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserConnectionRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserConnectionRole_userId_connectionId_key" ON "UserConnectionRole"("userId", "connectionId");

-- AddForeignKey
ALTER TABLE "UserConnectionRole" ADD CONSTRAINT "UserConnectionRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConnectionRole" ADD CONSTRAINT "UserConnectionRole_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
