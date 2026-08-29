-- CreateTable
CREATE TABLE "nucleo_membros" (
    "id" SERIAL NOT NULL,
    "nucleoId" INTEGER NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "senha" VARCHAR(255),
    "papel" VARCHAR(50) NOT NULL DEFAULT 'membro',
    "curso" VARCHAR(255),
    "telefone" VARCHAR(20),
    "foto_url" VARCHAR(500),
    "data_entrada" DATE,
    "data_saida" DATE,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ativo',
    "exibir_no_site" BOOLEAN NOT NULL DEFAULT false,
    "consentimento_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nucleo_membros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membro_tokens" (
    "id" SERIAL NOT NULL,
    "membroId" INTEGER NOT NULL,
    "accessToken" VARCHAR(512) NOT NULL,
    "refreshToken" VARCHAR(512) NOT NULL,
    "accessTokenExpires" TIMESTAMP(3) NOT NULL,
    "refreshTokenExpires" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membro_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nucleo_membros_email_key" ON "nucleo_membros"("email");

-- CreateIndex
CREATE INDEX "nucleo_membros_nucleoId_idx" ON "nucleo_membros"("nucleoId");

-- CreateIndex
CREATE INDEX "nucleo_membros_status_idx" ON "nucleo_membros"("status");

-- CreateIndex
CREATE INDEX "membro_tokens_membroId_idx" ON "membro_tokens"("membroId");

-- AddForeignKey
ALTER TABLE "nucleo_membros" ADD CONSTRAINT "nucleo_membros_nucleoId_fkey" FOREIGN KEY ("nucleoId") REFERENCES "Nucleo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membro_tokens" ADD CONSTRAINT "membro_tokens_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "nucleo_membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;
