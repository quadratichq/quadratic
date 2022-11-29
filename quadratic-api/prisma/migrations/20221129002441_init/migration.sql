-- CreateTable
CREATE TABLE "QUser" (
    "id" SERIAL NOT NULL,
    "auth0_user_id" TEXT,

    CONSTRAINT "QUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QFile" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" BYTEA,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QUser_auth0_user_id_key" ON "QUser"("auth0_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "QFile_url_key" ON "QFile"("url");

-- AddForeignKey
ALTER TABLE "QFile" ADD CONSTRAINT "QFile_id_fkey" FOREIGN KEY ("id") REFERENCES "QUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
