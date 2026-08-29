-- CreateTable
CREATE TABLE "projeto_tarefas" (
    "id" SERIAL NOT NULL,
    "projetoId" INTEGER NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "coluna" VARCHAR(30) NOT NULL DEFAULT 'a_fazer',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "responsavelId" INTEGER,
    "prazo" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projeto_tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projeto_tarefas_projetoId_idx" ON "projeto_tarefas"("projetoId");

-- CreateIndex
CREATE INDEX "projeto_tarefas_coluna_idx" ON "projeto_tarefas"("coluna");

-- CreateIndex
CREATE INDEX "projeto_tarefas_responsavelId_idx" ON "projeto_tarefas"("responsavelId");

-- AddForeignKey
ALTER TABLE "projeto_tarefas" ADD CONSTRAINT "projeto_tarefas_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projeto_tarefas" ADD CONSTRAINT "projeto_tarefas_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "nucleo_membros"("id") ON DELETE SET NULL ON UPDATE CASCADE;
