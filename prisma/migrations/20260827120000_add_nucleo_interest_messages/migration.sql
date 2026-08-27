-- CreateTable
CREATE TABLE "nucleo_interest_messages" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "cidade" VARCHAR(255) NOT NULL,
    "mensagem" TEXT NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'new',
    "replied_by" INTEGER,
    "replied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nucleo_interest_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nucleo_interest_messages_status_idx" ON "nucleo_interest_messages"("status");

-- CreateIndex
CREATE INDEX "nucleo_interest_messages_replied_by_idx" ON "nucleo_interest_messages"("replied_by");

-- CreateIndex
CREATE INDEX "nucleo_interest_messages_created_at_idx" ON "nucleo_interest_messages"("created_at");

-- AddForeignKey
ALTER TABLE "nucleo_interest_messages" ADD CONSTRAINT "nucleo_interest_messages_replied_by_fkey" FOREIGN KEY ("replied_by") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
