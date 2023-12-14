-- CreateTable
CREATE TABLE "FileCheckpoint" (
    "id" SERIAL NOT NULL,
    "file_id" INTEGER NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER NOT NULL,

    CONSTRAINT "FileCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileCheckpoint_file_id_sequence_number_key" ON "FileCheckpoint"("file_id", "sequence_number");

-- AddForeignKey
ALTER TABLE "FileCheckpoint" ADD CONSTRAINT "FileCheckpoint_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileCheckpoint" ADD CONSTRAINT "FileCheckpoint_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
