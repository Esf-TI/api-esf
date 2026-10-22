-- CreateTable
CREATE TABLE "auditoria_logs" (
    "id" SERIAL NOT NULL,
    "ator_tipo" VARCHAR(20) NOT NULL,
    "ator_id" INTEGER,
    "ator_nome" VARCHAR(255),
    "ator_papel" VARCHAR(50),
    "nucleo_id" INTEGER,
    "acao" VARCHAR(100) NOT NULL,
    "entidade" VARCHAR(50) NOT NULL,
    "entidade_id" INTEGER,
    "antes" JSONB,
    "depois" JSONB,
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nucleo_atividades" (
    "id" SERIAL NOT NULL,
    "nucleoId" INTEGER NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "coluna" VARCHAR(30) NOT NULL DEFAULT 'a_fazer',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "responsavelId" INTEGER,
    "prazo" DATE,
    "autor_tipo" VARCHAR(20) NOT NULL,
    "autor_id" INTEGER NOT NULL,
    "autor_nome" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nucleo_atividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards_nacionais" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "coluna" VARCHAR(30) NOT NULL DEFAULT 'a_fazer',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "responsavel_nome" VARCHAR(255),
    "prazo" DATE,
    "nucleo_id" INTEGER,
    "autor_tipo" VARCHAR(20) NOT NULL,
    "autor_id" INTEGER NOT NULL,
    "autor_nome" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_nacionais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auditoria_logs_entidade_entidade_id_idx" ON "auditoria_logs"("entidade", "entidade_id");

-- CreateIndex
CREATE INDEX "auditoria_logs_nucleo_id_idx" ON "auditoria_logs"("nucleo_id");

-- CreateIndex
CREATE INDEX "auditoria_logs_created_at_idx" ON "auditoria_logs"("created_at");

-- CreateIndex
CREATE INDEX "auditoria_logs_ator_tipo_ator_id_idx" ON "auditoria_logs"("ator_tipo", "ator_id");

-- CreateIndex
CREATE INDEX "nucleo_atividades_nucleoId_idx" ON "nucleo_atividades"("nucleoId");

-- CreateIndex
CREATE INDEX "nucleo_atividades_coluna_idx" ON "nucleo_atividades"("coluna");

-- CreateIndex
CREATE INDEX "nucleo_atividades_responsavelId_idx" ON "nucleo_atividades"("responsavelId");

-- CreateIndex
CREATE INDEX "cards_nacionais_coluna_idx" ON "cards_nacionais"("coluna");

-- CreateIndex
CREATE INDEX "cards_nacionais_nucleo_id_idx" ON "cards_nacionais"("nucleo_id");

-- AddForeignKey
ALTER TABLE "nucleo_atividades" ADD CONSTRAINT "nucleo_atividades_nucleoId_fkey" FOREIGN KEY ("nucleoId") REFERENCES "Nucleo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nucleo_atividades" ADD CONSTRAINT "nucleo_atividades_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "nucleo_membros"("id") ON DELETE SET NULL ON UPDATE CASCADE;
