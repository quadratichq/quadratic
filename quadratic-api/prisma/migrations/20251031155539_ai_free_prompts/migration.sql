-- CreateTable
CREATE TABLE "TutorialBonusPrompt" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "prompts_awarded" INTEGER NOT NULL,
    "awarded_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorialBonusPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TutorialBonusPrompt_user_id_category_key" ON "TutorialBonusPrompt"("user_id", "category");

-- AddForeignKey
ALTER TABLE "TutorialBonusPrompt" ADD CONSTRAINT "TutorialBonusPrompt_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
