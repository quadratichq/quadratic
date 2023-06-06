-- CreateTable
CREATE TABLE "QFeedback" (
    "id" SERIAL NOT NULL,
    "feedback" TEXT NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qUserId" INTEGER NOT NULL,

    CONSTRAINT "QFeedback_pkey" PRIMARY KEY ("id")
);
