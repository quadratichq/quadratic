-- CreateEnum
CREATE TYPE "ScheduledTaskStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "ScheduledTaskLogStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "ScheduledTask" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "file_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "cron_expression" TEXT NOT NULL,
    "next_run_time" TIMESTAMP(3) NOT NULL,
    "last_run_time" TIMESTAMP(3),
    "status" "ScheduledTaskStatus" NOT NULL DEFAULT 'ACTIVE',
    "operations" BYTEA NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledTaskLog" (
    "id" SERIAL NOT NULL,
    "scheduled_task_id" INTEGER NOT NULL,
    "run_id" TEXT NOT NULL,
    "status" "ScheduledTaskLogStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledTaskLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledTask_uuid_key" ON "ScheduledTask"("uuid");

-- CreateIndex
CREATE INDEX "ScheduledTask_uuid_idx" ON "ScheduledTask"("uuid");

-- CreateIndex
CREATE INDEX "ScheduledTask_file_id_idx" ON "ScheduledTask"("file_id");

-- CreateIndex
CREATE INDEX "ScheduledTask_user_id_idx" ON "ScheduledTask"("user_id");

-- CreateIndex
CREATE INDEX "ScheduledTaskLog_scheduled_task_id_idx" ON "ScheduledTaskLog"("scheduled_task_id");

-- CreateIndex
CREATE INDEX "ScheduledTaskLog_status_idx" ON "ScheduledTaskLog"("status");

-- CreateIndex
CREATE INDEX "ScheduledTaskLog_run_id_created_date_desc_idx" ON "ScheduledTaskLog"("run_id", "created_date DESC");

-- CreateIndex
CREATE INDEX "ScheduledTaskLog_created_date_desc_idx" ON "ScheduledTaskLog"("created_date DESC");

-- AddForeignKey
ALTER TABLE "ScheduledTask" ADD CONSTRAINT "ScheduledTask_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledTask" ADD CONSTRAINT "ScheduledTask_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledTaskLog" ADD CONSTRAINT "ScheduledTaskLog_scheduled_task_id_fkey" FOREIGN KEY ("scheduled_task_id") REFERENCES "ScheduledTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
