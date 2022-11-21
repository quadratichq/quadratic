-- CreateTable
CREATE TABLE "QUser" (
    "id" SERIAL NOT NULL,
    "auth0_user_id" TEXT,

    CONSTRAINT "QUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QGrid" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" BYTEA,

    CONSTRAINT "QGrid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QUser_auth0_user_id_key" ON "QUser"("auth0_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "QGrid_url_key" ON "QGrid"("url");

-- AddForeignKey
ALTER TABLE "QGrid" ADD CONSTRAINT "QGrid_id_fkey" FOREIGN KEY ("id") REFERENCES "QUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
