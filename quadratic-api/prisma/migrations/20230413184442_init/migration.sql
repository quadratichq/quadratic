-- CreateTable
CREATE TABLE "QUser" (
    "id" SERIAL NOT NULL,
    "auth0_user_id" TEXT,

    CONSTRAINT "QUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QFile" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contents" JSONB NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qUserId" INTEGER NOT NULL,

    CONSTRAINT "QFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QUser_auth0_user_id_key" ON "QUser"("auth0_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "QFile_uuid_key" ON "QFile"("uuid");

-- AddForeignKey
ALTER TABLE "QFile" ADD CONSTRAINT "QFile_qUserId_fkey" FOREIGN KEY ("qUserId") REFERENCES "QUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
